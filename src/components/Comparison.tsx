import { useMemo, useState } from 'react';
import { analyze, type Analysis } from '../lib/analysis';
import { csvFromTable, MIME, saveFile, toBlob, xlsxFromTable } from '../lib/export';
import { euro, monthYear, number2, percent, signedEuro, years } from '../lib/format';
import { balanceAfterYears } from '../lib/loan';
import { compareOffers, type Offer } from '../lib/offers';
import type { AppState, SavedScenario } from '../lib/state';
import { BarsChart, LinesChart, SERIES } from './Charts';
import type { Patch } from './Settings';
import { Badge, Button, Card, InfoTip, Note, NumberBox, ScoreBar, Segmented, Select } from './ui';

const TYPE_LABEL = { annuitaet: 'Annuität', raten: 'Ratentilgung', endfaellig: 'Endfällig' } as const;

function ExportButtons({ name, title, head, body, note }: { name: string; title: string; head: string[]; body: string[][]; note: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const run = async (kind: 'pdf' | 'xlsx' | 'csv') => {
    setMessage(null);
    try {
      const blob = kind === 'pdf' ? toBlob((await import('../lib/pdf')).pdfFromTable(title, [], head, body, note), MIME.pdf) : kind === 'xlsx' ? toBlob(xlsxFromTable(title, head, body), MIME.xlsx) : toBlob(csvFromTable(head, body), MIME.csv);
      setMessage(await saveFile(`${name}.${kind}`, blob));
    } catch {
      setMessage('Der Export konnte nicht erstellt werden.');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {message && <span role="status" className="text-[13px] text-muted">{message}</span>}
      <Button onClick={() => run('pdf')}>PDF</Button>
      <Button onClick={() => run('xlsx')}>Excel</Button>
      <Button onClick={() => run('csv')}>CSV</Button>
    </div>
  );
}

/** Vergleichstabelle: Kriterien in Zeilen, Varianten in Spalten; bester Wert grün. */
function CompareTable({ columns, rows }: { columns: string[]; rows: { label: string; values: string[]; nums?: number[]; best?: 'min' | 'max'; sub?: string[] }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm" style={{ minWidth: `${190 + columns.length * 150}px` }}>
        <thead>
          <tr className="bg-surface2">
            <th scope="col" className="px-3 py-2 text-left font-semibold" />
            {columns.map((c, i) => <th scope="col" key={i} className="px-3 py-2 text-right font-semibold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const best = r.nums && r.best && new Set(r.nums).size > 1 ? (r.best === 'max' ? Math.max(...r.nums) : Math.min(...r.nums)) : null;
            return (
              <tr key={r.label} className="border-t border-line align-top">
                <td className="px-3 py-2">{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={`num px-3 py-2 text-right ${best !== null && r.nums![i] === best ? 'font-semibold text-good' : 'font-medium'}`}>
                    {v}{r.sub?.[i] && <span className="block text-[12px] font-normal text-muted">{r.sub[i]}</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Kreditangebote ----------
function OfferEditor({ o, set, onCopy, onDelete, canDelete, color }: { o: Offer; set: (p: Partial<Offer>) => void; onCopy: () => void; onDelete: () => void; canDelete: boolean; color: string }) {
  const id = `angebot-${o.id}`;
  const f = 'flex flex-col gap-1 text-[13px] text-muted';
  const num = (key: keyof Offer, label: string, min: number, max: number, unit: string, decimals = 0) => (
    <div className={f}><label htmlFor={`${id}-${key}`}>{label}</label>
      <NumberBox id={`${id}-${key}`} width="w-full" value={o[key] as number} min={min} max={max} decimals={decimals} unit={unit} onChange={(v) => set({ [key]: v } as Partial<Offer>)} />
    </div>
  );
  return (
    <div className="min-w-0 rounded-xl border border-line p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
        <input id={`${id}-name`} aria-label="Name des Angebots" value={o.name} maxLength={40} onChange={(e) => set({ name: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-accent" />
        <button type="button" title="Duplizieren" aria-label={`${o.name} duplizieren`} onClick={onCopy} className="rounded-lg px-2 py-1 text-muted hover:text-accent">⧉</button>
        <button type="button" title="Löschen" aria-label={`${o.name} löschen`} onClick={onDelete} disabled={!canDelete} className="rounded-lg px-2 py-1 text-muted hover:text-bad disabled:opacity-30">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {num('amount', 'Kreditbetrag', 1000, 5000000, '€')}
        {num('termYears', 'Laufzeit', 1, 40, 'Jahre')}
        <div className={f}><label htmlFor={`${id}-type`}>Kreditart</label>
          <Select id={`${id}-type`} value={o.type} onChange={(v) => set({ type: v })} options={(Object.keys(TYPE_LABEL) as Offer['type'][]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
        </div>
        <div className={f}><label htmlFor={`${id}-mode`}>Zinsbindung</label>
          <Select id={`${id}-mode`} value={o.mode} onChange={(v) => set({ mode: v })} options={[{ value: 'fix', label: 'Fix gesamte Laufzeit' }, { value: 'variabel', label: 'Fix, dann variabel' }]} />
        </div>
        {num('fixRate', o.mode === 'fix' ? 'Nominalzins' : 'Fixzins', 0, 15, '%', 3)}
        {o.mode === 'variabel' && num('fixYears', 'Fixzinsdauer', 1, o.termYears, 'Jahre')}
        {o.mode === 'variabel' && num('variableRate', 'Danach variabel (Annahme)', 0, 15, '%', 3)}
        {num('setupPercent', 'Bearbeitungsgebühr', 0, 5, '%', 2)}
        {num('setupEuro', 'Einmalige Kosten', 0, 50000, '€')}
        {num('accountMonthly', 'Kontoführung / Monat', 0, 100, '€', 2)}
        {num('otherMonthly', 'Pflichtkosten / Monat', 0, 500, '€', 2)}
        {num('extraFreePercent', 'Sondertilgung frei / Jahr', 0, 100, '%')}
        {num('prepayFeePercent', 'Entschädigung', 0, 5, '%', 2)}
      </div>
    </div>
  );
}

function OfferCompare({ s, patch, a }: { s: AppState; patch: Patch; a: Analysis }) {
  const offers = s.offers;
  const set = (id: string, p: Partial<Offer>) => patch({ offers: offers.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  const newId = () => `o${Date.now().toString(36)}${Math.round(Math.random() * 999)}`;
  const metrics = useMemo(() => compareOffers(offers), [offers]);
  const fromCalculator = (): Offer => ({
    id: newId(), name: 'Mein Kredit aus dem Rechner', amount: Math.round(a.fin.loan), termYears: a.s.termYears, type: a.s.loanType, mode: a.variable ? 'variabel' : 'fix',
    fixRate: a.s.fixRate, fixYears: Math.min(a.s.fixYears, a.s.termYears), variableRate: a.s.variableRate, setupPercent: 0, setupEuro: Math.round(a.loanInput.oneTimeCosts ?? 0),
    accountMonthly: a.s.fees.accountMonthly, otherMonthly: a.s.fees.insuranceMonthly, extraFreePercent: a.s.extraLimitPercent || 100, prepayFeePercent: a.s.prepayFeePercent,
  });
  const cols = metrics.map((m) => m.offer.name || 'Ohne Namen');
  const rows = [
    { label: 'Kreditbetrag', values: metrics.map((m) => euro(m.offer.amount)) },
    { label: 'Nominalzins', values: metrics.map((m) => percent(m.offer.fixRate, 3)), nums: metrics.map((m) => m.offer.fixRate), best: 'min' as const },
    { label: 'Effektivzins', values: metrics.map((m) => (m.result.apr === null ? '–' : percent(m.result.apr, 2))), nums: metrics.map((m) => m.result.apr ?? Infinity), best: 'min' as const },
    { label: 'Monatsrate am Anfang', values: metrics.map((m) => euro(m.result.firstPayment)), nums: metrics.map((m) => m.result.firstPayment), best: 'min' as const },
    { label: 'Fixzinsdauer', values: metrics.map((m) => (m.variable ? (m.offer.fixYears === 1 ? '1 Jahr' : `${m.offer.fixYears} Jahre`) : 'gesamte Laufzeit')) },
    { label: 'Variable Zinsbedingungen', values: metrics.map((m) => (m.variable ? `danach ${percent(m.offer.variableRate, 3)} (Annahme)` : 'keine')), sub: metrics.map((m) => (m.paymentAfterFix !== null ? `Rate dann ${euro(m.paymentAfterFix)}` : '')) },
    { label: 'Laufzeit', values: metrics.map((m) => years(m.result.months)) },
    { label: 'Bearbeitungsgebühren', values: metrics.map((m) => euro((m.offer.amount * m.offer.setupPercent) / 100 + m.offer.setupEuro)) },
    { label: 'Kontoführung und Pflichtkosten gesamt', values: metrics.map((m) => euro(m.result.rows.reduce((x, r) => x + r.fees, 0))) },
    { label: 'Sondertilgung', values: metrics.map((m) => (m.offer.extraFreePercent >= 100 ? 'unbegrenzt' : m.offer.extraFreePercent > 0 ? `${m.offer.extraFreePercent} % pro Jahr frei` : 'nicht vorgesehen')), sub: metrics.map((m) => (m.offer.prepayFeePercent > 0 ? `sonst ${percent(m.offer.prepayFeePercent)} Entschädigung` : 'keine Entschädigung')) },
    { label: 'Restschuld nach der Fixzinsphase', values: metrics.map((m) => (m.balanceAfterFix === null ? '–' : euro(m.balanceAfterFix))) },
    { label: 'Gesamtzinsen', values: metrics.map((m) => euro(m.result.totalInterest)), nums: metrics.map((m) => m.result.totalInterest), best: 'min' as const },
    { label: 'Gesamtkosten (Zinsen + Gebühren)', values: metrics.map((m) => euro(m.result.totalCost)), nums: metrics.map((m) => m.result.totalCost), best: 'min' as const, sub: metrics.map((m) => (m.costDiff > 0 ? `${signedEuro(m.costDiff)} zum günstigsten` : 'günstigstes Angebot')) },
    { label: 'Rückzahlungssumme', values: metrics.map((m) => euro(m.result.grandTotal)), nums: metrics.map((m) => m.result.grandTotal), best: 'min' as const },
  ];
  const balanceData = useMemo(() => {
    const n = Math.max(...metrics.map((m) => m.result.years.length), 0);
    return [Object.fromEntries([['jahr', 0], ...metrics.map((m, i) => [`${i + 1}. ${m.offer.name}`, m.offer.amount])]),
      ...Array.from({ length: n }, (_, y) => Object.fromEntries([['jahr', y + 1], ...metrics.map((m, i) => [`${i + 1}. ${m.offer.name}`, m.result.years[y]?.balance ?? 0])]))];
  }, [metrics]);
  const sameAmount = new Set(offers.map((o) => o.amount)).size === 1;

  return (
    <div className="flex flex-col gap-4">
      <Card title="Kreditangebote vergleichen" action={
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => patch({ offers: [...offers, fromCalculator()] })}>Aktuellen Kredit übernehmen</Button>
          <Button variant="primary" onClick={() => patch({ offers: [...offers, { ...offers[offers.length - 1], id: newId(), name: `Angebot ${offers.length + 1}` }] })} disabled={offers.length >= 8}>+ Angebot hinzufügen</Button>
        </div>}>
        <p className="mb-3 text-sm text-muted">Trage die Angebote deiner Banken ein. Die drei Startangebote sind erfundene Beispiele und keine echten Konditionen. Deine Eingaben werden automatisch in diesem Browser gespeichert.</p>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {offers.map((o, i) => (
            <OfferEditor key={o.id} o={o} color={SERIES[i % SERIES.length]} set={(p) => set(o.id, p)} canDelete={offers.length > 1}
              onCopy={() => patch({ offers: [...offers, { ...o, id: newId(), name: `${o.name} (Kopie)` }] })} onDelete={() => patch({ offers: offers.filter((x) => x.id !== o.id) })} />
          ))}
        </div>
      </Card>

      <Card title="Ergebnis im Vergleich" action={<ExportButtons name="kredit-pilot-kreditvergleich" title="Kreditvergleich" head={['Kriterium', ...cols]} body={rows.map((r) => [r.label, ...r.values])}
        note="Vergleich nach eigenen Angaben. Variable Zinsen sind Annahmen. Kein verbindliches Angebot und keine Empfehlung." />}>
        <CompareTable columns={cols} rows={rows} />
        {!sameAmount && <p className="mt-2 text-[13px] text-muted">Die Kreditbeträge unterscheiden sich. Vergleiche dann vor allem den Effektivzins, nicht die Summen.</p>}
      </Card>

      <Card title="Bewertung in drei getrennten Punkten" action={<Badge>Keine Empfehlung</Badge>}>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr className="bg-surface2 text-left">
              <th scope="col" className="px-3 py-2 font-semibold">Angebot</th>
              <th scope="col" className="px-3 py-2 font-semibold">Kosten<InfoTip term="Bewertung Kosten" text="Nach dem Effektivzins: der niedrigste erhält 5, der höchste 1, dazwischen linear." /></th>
              <th scope="col" className="px-3 py-2 font-semibold">Flexibilität<InfoTip term="Bewertung Flexibilität" text="1 Punkt Grundwert, bis zu 3 Punkte für das Sondertilgungsrecht (unbegrenzt 3, ab 10 % pro Jahr 2, darunter 1) und 1 Punkt, wenn keine Entschädigung anfällt." /></th>
              <th scope="col" className="px-3 py-2 font-semibold">Zinssicherheit<InfoTip term="Bewertung Zinssicherheit" text="5 bei Fixzins über die gesamte Laufzeit, 1 bei vollständig variablem Zins, dazwischen nach dem Anteil der variablen Jahre." /></th>
            </tr></thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={m.offer.id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />{m.offer.name}</td>
                  <td className="px-3 py-2"><ScoreBar value={m.scoreCost} label="Kosten" /></td>
                  <td className="px-3 py-2"><ScoreBar value={m.scoreFlex} label="Flexibilität" /></td>
                  <td className="px-3 py-2"><ScoreBar value={m.scoreRisk} label="Zinssicherheit" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>Die drei Punkte werden bewusst nicht zu einer Gesamtnote verrechnet. Ein Angebot mit der niedrigsten Rate ist nicht automatisch das beste: Ein variabler Zins ist heute oft günstiger, trägt aber das Risiko steigender Zinsen. Was dir wichtiger ist, entscheidest du.</Note>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <BarsChart title="Kosten je Angebot" stacked data={metrics.map((m, i) => ({ name: `${i + 1}`, Zinsen: m.result.totalInterest, Gebühren: m.result.totalFees }))}
          bars={[{ key: 'Zinsen', color: 'var(--zins)' }, { key: 'Gebühren', color: 'var(--alt)' }]} foot={`Angebote in der Reihenfolge der Eingabe: ${metrics.map((m, i) => `${i + 1} = ${m.offer.name}`).join(', ')}`} />
        <LinesChart title="Restschuld je Angebot" data={balanceData} xKey="jahr" xLabel="Kreditjahr" tooltipTitle={(l) => (l === 0 ? 'Beginn' : `Ende Jahr ${l}`)}
          lines={metrics.map((m, i) => ({ key: `${i + 1}. ${m.offer.name}` }))} />
      </div>
    </div>
  );
}

// ---------- Szenarien: gespeicherte Finanzierungen und schnelle Varianten ----------
type Variant = 'laufzeit' | 'zins' | 'eigenkapital' | 'sondertilgung' | 'zinsbindung';

function ScenarioCompare({ raw, a, projects }: { raw: AppState; a: Analysis; projects: SavedScenario[] }) {
  const [selected, setSelected] = useState<string[]>(() => projects.slice(0, 3).map((p) => p.id));
  const [variant, setVariant] = useState<Variant>('laufzeit');
  const chosen = projects.filter((p) => selected.includes(p.id)).slice(0, 4);

  // Schnelle Varianten des aktuellen Kredits, ohne etwas speichern zu müssen.
  const variants = useMemo((): { name: string; state: AppState }[] => {
    const s = { ...raw, viewMode: 'erweitert' as const };
    const t = raw.termYears;
    if (variant === 'laufzeit') return [...new Set([Math.max(5, t - 10), Math.max(5, t - 5), t, Math.min(40, t + 5)])].map((y) => ({ name: `${y} Jahre`, state: { ...s, termYears: y, fixYears: Math.min(s.fixYears, y), termMode: 'laufzeit' as const } }));
    if (variant === 'zins') return [-1, 0, 1, 2].map((d) => ({ name: percent(Math.max(0, raw.fixRate + d)), state: { ...s, fixRate: Math.max(0, raw.fixRate + d) } }));
    if (variant === 'eigenkapital') return [...new Set([0, Math.round(raw.price * 0.1), raw.equity, Math.round(raw.price * 0.3)])].sort((x, y) => x - y).map((e) => ({ name: `${euro(e)} Eigenkapital`, state: { ...s, equity: e, manualLoan: false } }));
    if (variant === 'sondertilgung') return [0, 100, 250, 500].map((m) => ({ name: m === 0 ? 'Ohne Sondertilgung' : `${euro(m)} pro Monat`, state: { ...s, extra: { ...s.extra, monthlyAmount: m, oneTimeAmount: 0, yearlyAmount: 0 }, extraRules: [] } }));
    return [...new Set([5, 10, 15, t])].filter((y) => y <= t).map((y) => ({ name: y >= t ? 'Fix gesamte Laufzeit' : `${y} Jahre fix`, state: { ...s, mode: y >= t ? 'fix' as const : 'variabel' as const, fixYears: y } }));
  }, [raw, variant]);

  const build = (list: { name: string; state: AppState }[]) => list.map((c) => ({ name: c.name, an: analyze({ ...c.state, viewMode: 'erweitert' }) }));
  const savedCols = useMemo(() => build([{ name: 'Aktuelle Eingabe', state: raw }, ...chosen.map((p) => ({ name: p.name, state: p.state }))]), [raw, chosen]);
  const variantCols = useMemo(() => build(variants), [variants]);

  const table = (cols: { name: string; an: Analysis }[], baseIndex: number) => {
    const base = cols[baseIndex]?.an;
    const diff = (v: number, b: number) => (Math.abs(v - b) < 0.005 ? 'Vergleichsbasis' : `${signedEuro(v - b)} · ${b !== 0 ? `${v - b > 0 ? '+' : ''}${number2(((v - b) / b) * 100)} %` : ''}`);
    const money = (label: string, get: (x: Analysis) => number, best: 'min' | 'max' = 'min') => ({
      label, values: cols.map((c) => euro(get(c.an))), nums: cols.map((c) => get(c.an)), best, sub: base ? cols.map((c, i) => (i === baseIndex ? 'Vergleichsbasis' : diff(get(c.an), get(base)))) : undefined,
    });
    return [
      money('Kreditbetrag', (x) => x.fin.loan),
      { label: 'Zinssatz', values: cols.map((c) => (c.an.variable ? `${percent(c.an.s.fixRate)} fix ${c.an.s.fixYears} J., dann ${percent(c.an.s.variableRate)}` : `${percent(c.an.s.fixRate)} fix`)) },
      { label: 'Effektivzins', values: cols.map((c) => (c.an.loan.apr === null ? '–' : percent(c.an.loan.apr, 2))), nums: cols.map((c) => c.an.loan.apr ?? Infinity), best: 'min' as const },
      money('Monatsrate am Anfang', (x) => x.loan.monthlyBurden),
      { label: 'Laufzeit', values: cols.map((c) => years(c.an.loan.months)), nums: cols.map((c) => c.an.loan.months), best: 'min' as const, sub: cols.map((c) => (c.an.loan.endDate ? `schuldenfrei ${monthYear(c.an.loan.endDate)}` : '')) },
      money('Restschuld nach 10 Jahren', (x) => balanceAfterYears(x.loan, Math.min(10, x.s.termYears), x.fin.loan)),
      money('Gesamtzinsen', (x) => x.loan.totalInterest),
      money('Gesamtkosten (Zinsen + Gebühren)', (x) => x.loan.totalCost),
      money('Rückzahlungssumme', (x) => x.loan.grandTotal),
      money('Eigenmittel', (x) => x.fin.ownFundsNeeded),
    ];
  };
  const chart = (cols: { name: string; an: Analysis }[]) => {
    const n = Math.max(...cols.map((c) => c.an.loan.years.length), 0);
    return [Object.fromEntries([['jahr', 0], ...cols.map((c) => [c.name, c.an.fin.loan])]), ...Array.from({ length: n }, (_, y) => Object.fromEntries([['jahr', y + 1], ...cols.map((c) => [c.name, c.an.loan.years[y]?.balance ?? 0])]))];
  };
  const baseVariant = Math.max(0, variants.findIndex((v) => (variant === 'laufzeit' ? v.state.termYears === raw.termYears : variant === 'zins' ? v.state.fixRate === raw.fixRate : variant === 'eigenkapital' ? v.state.equity === raw.equity : false)));
  const vRows = table(variantCols, baseVariant);
  const sRows = table(savedCols, 0);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Schnellvergleich: Was wäre, wenn?" action={<ExportButtons name="kredit-pilot-varianten" title="Variantenvergleich" head={['Kriterium', ...variantCols.map((c) => c.name)]} body={vRows.map((r) => [r.label, ...r.values])} note="Varianten des aktuellen Kredits nach eigenen Angaben." />}>
        <div className="mb-3">
          <Segmented<Variant> label="Was soll verglichen werden?" size="sm" value={variant} onChange={setVariant} options={[
            { value: 'laufzeit', label: 'Laufzeit' }, { value: 'zins', label: 'Zinssatz' }, { value: 'eigenkapital', label: 'Eigenkapital' }, { value: 'sondertilgung', label: 'Sondertilgung' }, { value: 'zinsbindung', label: 'Fixzinsdauer' },
          ]} />
        </div>
        <CompareTable columns={variantCols.map((c) => c.name)} rows={vRows} />
        {variant === 'zinsbindung' && <p className="mt-2 text-[13px] text-muted">Nach der Fixzinsdauer gilt der links eingestellte variable Zins von {percent(raw.variableRate)}. In der Praxis haben längere Fixzinsbindungen meist einen höheren Zinssatz.</p>}
      </Card>
      <LinesChart title="Restschuld der Varianten" data={chart(variantCols)} xKey="jahr" xLabel="Kreditjahr" tooltipTitle={(l) => (l === 0 ? 'Beginn' : `Ende Jahr ${l}`)} lines={variantCols.map((c) => ({ key: c.name }))} />

      <Card title="Gespeicherte Szenarien vergleichen" action={projects.length > 0 ? <ExportButtons name="kredit-pilot-szenarien" title="Szenariovergleich" head={['Kriterium', ...savedCols.map((c) => c.name)]} body={sRows.map((r) => [r.label, ...r.values])} note="Szenarien nach eigenen Angaben." /> : undefined}>
        {projects.length === 0 ? (
          <p className="text-sm text-muted">Noch nichts gespeichert. Speichere eine Finanzierung im Kreditrechner links unter „Meine Szenarien“. Ändere dann die Eingaben und vergleiche beide Stände hier.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {projects.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-sm">
                  <input id={`sz-${p.id}`} type="checkbox" checked={selected.includes(p.id)} disabled={!selected.includes(p.id) && chosen.length >= 4}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))} className="h-4 w-4 accent-[var(--accent)]" />
                  {p.name}
                </label>
              ))}
            </div>
            <CompareTable columns={savedCols.map((c) => c.name)} rows={sRows} />
          </>
        )}
      </Card>
      {projects.length > 0 && savedCols.length > 1 && (
        <LinesChart title="Restschuld der Szenarien" data={chart(savedCols)} xKey="jahr" xLabel="Kreditjahr" tooltipTitle={(l) => (l === 0 ? 'Beginn' : `Ende Jahr ${l}`)} lines={savedCols.map((c) => ({ key: c.name }))} />
      )}
      <p className="text-[13px] text-muted">Aktuelle Monatsrate zum Vergleich: {euro(a.loan.monthlyBurden)}.</p>
    </div>
  );
}

export function Comparison({ s, patch, a, projects }: { s: AppState; patch: Patch; a: Analysis; projects: SavedScenario[] }) {
  const [tab, setTab] = useState<'angebote' | 'szenarien'>('angebote');
  return (
    <div className="flex flex-col gap-4">
      <Segmented label="Art des Vergleichs" value={tab} onChange={setTab} options={[{ value: 'angebote', label: 'Kreditangebote' }, { value: 'szenarien', label: 'Szenarien und Varianten' }]} />
      {tab === 'angebote' ? <OfferCompare s={s} patch={patch} a={a} /> : <ScenarioCompare raw={s} a={a} projects={projects} />}
    </div>
  );
}
