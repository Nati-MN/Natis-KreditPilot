import { useMemo, useState } from 'react';
import { breakEven, compareMetrics, type Analysis } from '../lib/analysis';
import { csvFromTable, pdfEuro, pdfFromTable, saveFile } from '../lib/export';
import { euro, number2, percent } from '../lib/format';
import { calculateLoan } from '../lib/loan';
import { project } from '../lib/invest';
import { toLoanInput, type AppState, type SavedScenario } from '../lib/state';
import { BalanceChart, SplitChart } from './Charts';
import { CashflowChart, CostDistributionChart, CumulativeChart, FixVarChart, IncomeExpenseChart, RentCompositionChart, ValueChart, YieldChart } from './InvestCharts';
import type { Patch } from './Settings';
import { Badge, Button, Card, InfoTip, ResultCard, Row, Segmented, SliderField } from './ui';

const signed = (v: number) => `${v > 0 ? '+' : ''}${euro(v)}`;
const tone = (v: number) => (v >= 0 ? 'good' : 'bad') as 'good' | 'bad';

/** Monatsrechnung von der Miete bis zum Cashflow. */
export function Ledger({ a }: { a: Analysis }) {
  const m = a.month;
  return (
    <Card title="So rechnet sich ein normaler Monat">
      <Row label="Nettokaltmiete bei voller Vermietung" value={euro(m.incomeFull)} />
      {m.vacancyLoss > 0 && <Row label="Leerstand und Mietausfall" value={`− ${euro(m.vacancyLoss)}`} tone="muted" sub="auf den Monat umgelegt" />}
      <Row label="Laufende Vermieterkosten" value={`− ${euro(m.landlordCosts)}`} tone="muted" />
      {m.vacancyCosts > 0 && <Row label="Betriebskosten im Leerstand" value={`− ${euro(m.vacancyCosts)}`} tone="muted" />}
      <Row label="Ertrag vor Finanzierung" value={euro(m.netOperating)} strong />
      <Row label="Kreditrate" value={`− ${euro(m.payment)}`} tone="muted" sub={`davon ${euro(a.loan.rows[0]?.interest ?? 0)} Zinsen und ${euro(a.loan.rows[0]?.principal ?? 0)} Tilgung`} />
      {m.extra > 0 && <Row label="Monatliche Sondertilgung" value={`− ${euro(m.extra)}`} tone="muted" />}
      <Row label={<>Cashflow vor Steuern<InfoTip term="Cashflow" /></>} value={signed(m.cashflow)} strong tone={tone(m.cashflow)} />
      {a.s.invest.tax.enabled && (
        <>
          <Row label="Geschätzte Steuer (Jahr 1, pro Monat)" value={signed(-a.projection.years[0].tax / 12)} tone="muted" />
          <Row label="Cashflow nach Steuern" value={signed(a.projection.years[0].cashflowAfterTax / 12)} strong tone={tone(a.projection.years[0].cashflowAfterTax)} />
        </>
      )}
      <p className="mt-2 text-[13px] text-muted">Betriebskosten und Umsatzsteuer des Mieters sind nicht enthalten, weil sie nur durchlaufen. Einmalige Kosten stehen in der Prognose.</p>
    </Card>
  );
}

function Verdict({ a }: { a: Analysis }) {
  const cf = a.month.cashflow;
  const positive = cf >= 0;
  return (
    <div className={`rounded-card p-5 ${positive ? 'bg-good' : 'bg-bad'} text-surface`}>
      <div className="text-sm font-medium opacity-90">{positive ? 'Dir bleiben pro Monat' : 'Du zahlst pro Monat dazu'}</div>
      <div className="num mt-1 font-display text-[40px] font-bold leading-none tracking-tight">{euro(Math.abs(cf))}</div>
      <p className="mt-2 text-sm opacity-95">
        {positive
          ? `Die Miete deckt deine Kosten und die Kreditrate. Im Jahr sind das ${euro(cf * 12)}.`
          : `Miete minus Kosten reicht nicht für die Kreditrate. Im Jahr fehlen ${euro(-cf * 12)}.`}
        {' '}Zusätzlich tilgst du im ersten Jahr {euro(a.projection.years[0].principal)} Kredit.
      </p>
    </div>
  );
}

/** Vereinfachte Ansicht: nur das, was für die Entscheidung nötig ist. */
export function SimpleInvest({ a, raw }: { a: Analysis; raw: AppState }) {
  const be = useMemo(() => breakEven(raw, a), [raw, a]);
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Verdict a={a} />
          <div className="grid grid-cols-2 gap-3">
            <ResultCard label={<>Gesamtinvestition<InfoTip term="Gesamtinvestition" /></>} value={euro(a.fin.totalInvestment)} sub={`davon ${euro(a.fin.ownFunds)} eigenes Geld`} />
            <ResultCard label="Kreditrate" value={euro(a.month.payment)} sub={a.afterFix ? `ab Jahr ${a.s.fixYears + 1}: ${euro(a.afterFix.payment)} (Prognose)` : `${a.s.termYears} Jahre Laufzeit`} />
            <ResultCard label={<>Bruttomietrendite<InfoTip term="Bruttomietrendite" /></>} value={percent(a.yields.grossOnPrice, 2)} sub="Jahresmiete ÷ Kaufpreis" />
            <ResultCard label={<>Nettomietrendite<InfoTip term="Nettomietrendite" /></>} value={percent(a.yields.netOnTotal, 2)} sub="nach Kosten, auf alles Investierte" />
          </div>
        </div>
        <Ledger a={a} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <IncomeExpenseChart a={a} />
        <Card title="Gut zu wissen">
          <Row label="Mindestmiete für Cashflow 0" value={euro(be.rentForZero)} sub="Hauptmietzins, bei dem du nichts dazuzahlst" />
          <Row label={`Zins, bis zu dem es sich trägt (${be.maxRateLabel})`} value={be.maxRate === null ? 'nie' : be.maxRate >= 25 ? 'über 25 %' : percent(be.maxRate, 2)} />
          <Row label="Verkraftbarer Leerstand pro Jahr" value={`${number2(be.vacancyMonthsPerYear)} Monate`} sub="insgesamt, bevor du im Jahr draufzahlst" />
          {a.afterFix && <Row label={`Cashflow ab Jahr ${a.s.fixYears + 1}`} value={signed(a.afterFix.cashflow)} tone={tone(a.afterFix.cashflow)} sub={`bei ${percent(a.s.variableRate)} variablem Zins und heutiger Miete (Annahme)`} />}
          <p className="mt-3 text-[13px] text-muted">Mehr Details wie Steuern, Prognose über 30 Jahre, Break-even und Vergleich mehrerer Immobilien findest du in der erweiterten Ansicht.</p>
        </Card>
      </div>
    </>
  );
}

// ---------- Erweiterte Ansicht ----------
export function InvestDashboard({ a }: { a: Analysis }) {
  const m = a.month;
  const y1 = a.projection.years[0];
  const y10 = a.projection.years[Math.min(9, a.projection.years.length - 1)];
  const taxOn = a.s.invest.tax.enabled;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
      <div className={`col-span-2 flex flex-col justify-between gap-2 rounded-card p-4 lg:col-span-1 ${m.cashflow >= 0 ? 'bg-good' : 'bg-bad'} text-surface`}>
        <div className="text-[13px] font-medium opacity-90">Monatlicher Cashflow<InfoTip term="Cashflow" /></div>
        <div>
          <div className="num font-display text-[34px] font-bold leading-none tracking-tight">{signed(m.cashflow)}</div>
          <div className="mt-1.5 text-[13px] opacity-95">{taxOn ? `nach Steuern: ${signed(y1.cashflowAfterTax / 12)}` : 'vor Steuern'}</div>
        </div>
      </div>
      <ResultCard label="Jährlicher Cashflow" value={signed(m.cashflow * 12)} sub={a.afterFix ? `ab Jahr ${a.s.fixYears + 1}: ${signed(a.afterFix.cashflow)} pro Monat` : 'typisches Jahr ohne Einmalkosten'} />
      <ResultCard label="Kaufpreis" value={euro(a.s.price)} sub={`${euro(a.s.invest.livingArea > 0 ? a.s.price / a.s.invest.livingArea : 0)} pro m²`} />
      <ResultCard label={<>Gesamtinvestition<InfoTip term="Gesamtinvestition" /></>} value={euro(a.fin.totalInvestment)} sub={`inkl. ${euro(a.fin.costs)} Nebenkosten`} />
      <ResultCard label="Eingesetztes Eigenkapital" value={euro(a.fin.ownFunds)} sub={`Kredit ${euro(a.fin.loan)}`} />
      <ResultCard label="Bruttomietzins" value={euro(a.rent.bruttomietzins)} sub={`Mieter zahlt gesamt ${euro(a.rent.tenantTotal)}`} />
      <ResultCard label="Nettokaltmiete" value={euro(a.rent.income)} sub={`nach Leerstand ${euro(m.income)}`} />
      <ResultCard label="Vermieterkosten pro Monat" value={euro(m.landlordCosts + m.vacancyCosts)} sub={m.vacancyCosts > 0 ? `davon ${euro(m.vacancyCosts)} im Leerstand` : 'nicht umlagefähig'} />
      <ResultCard tone="zins" label="Monatliche Kreditrate" value={euro(m.payment)} sub={a.afterFix ? `ab Jahr ${a.s.fixYears + 1}: ${euro(a.afterFix.payment)}` : `${percent(a.s.fixRate)} fix`} />
      <ResultCard label={<>Bruttomietrendite<InfoTip term="Bruttomietrendite" /></>} value={percent(a.yields.grossOnPrice, 2)} sub={`auf Gesamtinvestition ${percent(a.yields.grossOnTotal, 2)}`} />
      <ResultCard label={<>Nettomietrendite<InfoTip term="Nettomietrendite" /></>} value={percent(a.yields.netOnTotal, 2)}
        sub={<>Cash-on-Cash {a.yields.cashOnCash === null ? '–' : percent(a.yields.cashOnCash, 2)}<InfoTip term="Cash-on-Cash-Rendite" /></>} />
      <ResultCard tone="rest" label={`Restschuld nach ${y10.year} Jahren`} value={euro(y10.balance)} sub={`Eigenkapital in der Immobilie ${euro(y10.equity)}`} />
    </div>
  );
}

function BreakEvenPanel({ a, raw, patch }: { a: Analysis; raw: AppState; patch: Patch }) {
  const be = useMemo(() => breakEven(raw, a), [raw, a]);
  const inv = raw.invest;
  const setInv = (p: Partial<AppState['invest']>) => patch({ invest: { ...inv, ...p } });
  const hmz = a.rent.hmz;
  const rateNow = a.variable ? a.s.variableRate : a.s.fixRate;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Welche Miete brauche ich?">
        <Row label="Für Cashflow 0 €" value={euro(be.rentForZero)} tone={hmz >= be.rentForZero ? 'good' : 'bad'} sub={hmz >= be.rentForZero ? `du liegst ${euro(hmz - be.rentForZero)} darüber` : `es fehlen ${euro(be.rentForZero - hmz)}`} />
        <div className="mt-3">
          <SliderField id="ziel-cashflow" label="Gewünschter Überschuss pro Monat" value={inv.targetCashflow} min={0} max={1500} step={10} unit="€" onChange={(v) => setInv({ targetCashflow: v })} />
        </div>
        <Row label={`Nötiger Hauptmietzins für +${euro(inv.targetCashflow)}`} value={euro(be.rentForTarget)} strong
          sub={a.s.invest.livingArea > 0 ? `${euro(be.rentForTarget / a.s.invest.livingArea)} pro m²` : undefined} />
      </Card>
      <Card title="Wie viel darf die Immobilie kosten?">
        <SliderField id="ziel-rendite" label="Renditeziel" value={inv.targetYield} min={1} max={10} step={0.1} decimals={1} unit="%" onChange={(v) => setInv({ targetYield: v })} />
        <Row label="Maximaler Kaufpreis für Nettomietrendite" value={be.maxPriceNet === null ? 'nicht erreichbar' : euro(Math.round(be.maxPriceNet / 100) * 100)} strong
          tone={be.maxPriceNet !== null && be.maxPriceNet >= a.s.price ? 'good' : 'bad'} sub="auf die Gesamtinvestition inkl. Nebenkosten" />
        <Row label="Maximaler Kaufpreis für Bruttomietrendite" value={be.maxPriceGross === null ? '–' : euro(Math.round(be.maxPriceGross / 100) * 100)} sub="Jahresmiete ÷ Renditeziel" />
        <Row label="Aktueller Kaufpreis" value={euro(a.s.price)} tone="muted" />
      </Card>
      <Card title="Eigenkapital und Zinsen">
        <Row label="Mindest-Eigenkapital für positiven Cashflow"
          value={be.equityForPositive === null ? 'nicht erreichbar' : euro(Math.ceil(be.equityForPositive / 100) * 100)} strong
          tone={be.equityForPositive !== null && be.equityForPositive <= a.s.equity ? 'good' : 'bad'}
          sub={be.equityForPositive === null ? 'Auch ohne Kredit decken die Mieten die Kosten nicht.' : `du setzt ${euro(a.s.equity)} ein`} />
        <Row label={`Höchster tragbarer Zins (${be.maxRateLabel})`}
          value={be.maxRate === null ? 'keiner' : be.maxRate >= 25 ? 'über 25 %' : percent(be.maxRate, 2)} strong
          tone={be.maxRate !== null && be.maxRate >= rateNow ? 'good' : 'bad'}
          sub={be.maxRate === null ? 'Der Cashflow ist auch bei 0 % Zinsen negativ.' : be.maxRate >= rateNow ? `Puffer von ${number2(Math.min(be.maxRate, 25) - rateNow)} Prozentpunkten zum eingestellten Zins` : `eingestellt sind ${percent(rateNow)}`} />
      </Card>
      <Card title="Wie viel Leerstand verkrafte ich?">
        <Row label="Leerstand pro Jahr ohne Verlust" value={`${number2(be.vacancyMonthsPerYear)} Monate`} strong tone={be.vacancyMonthsPerYear > inv.vacancyMonths ? 'good' : 'bad'}
          sub={`eingestellt sind ${number2(inv.vacancyMonths)} Monate`} />
        <div className="mt-3">
          <SliderField id="reserve" label="Meine Reserve" value={inv.reserve} min={0} max={50000} step={500} unit="€" onChange={(v) => setInv({ reserve: v })} />
        </div>
        <Row label="So lange reicht die Reserve ganz ohne Mieter" value={Number.isFinite(be.reserveMonths) ? `${number2(be.reserveMonths)} Monate` : 'unbegrenzt'}
          sub="Kreditrate, Betriebskosten und Vermieterkosten laufen weiter" />
      </Card>
    </div>
  );
}

function ProjectionTable({ a }: { a: Analysis }) {
  const [view, setView] = useState<'jahr' | 'monat'>('jahr');
  const [message, setMessage] = useState<string | null>(null);
  const taxOn = a.s.invest.tax.enabled;
  const p = a.projection;
  const head = view === 'jahr'
    ? ['Jahr', 'Mieteinnahmen', 'Vermieterkosten', 'Einmalkosten', 'Zinsen', 'Tilgung', 'Cashflow', ...(taxOn ? ['Steuerl. Überschuss', 'Steuer', 'Cashflow n. St.'] : []), 'Kumuliert', 'Immobilienwert', 'Restschuld', 'Eigenkapital']
    : ['Monat', 'Jahr', 'Mieteinnahmen', 'Vermieterkosten', 'Einmalkosten', 'Kreditrate', 'Zinsen', 'Tilgung', 'Cashflow', ...(taxOn ? ['Cashflow n. St.'] : []), 'Restschuld'];
  const body = useMemo(() => view === 'jahr'
    ? p.years.map((y) => [String(y.year), y.income, y.landlordCosts + y.vacancyCosts, y.oneTime, y.interest, y.principal + y.extra, y.cashflow,
        ...(taxOn ? [y.taxableSurplus, y.tax, y.cashflowAfterTax] : []), taxOn ? y.cumCashflowAfterTax : y.cumCashflow, y.value, y.balance, y.equity].map((c) => (typeof c === 'number' ? number2(c) : c)))
    : p.months.map((r) => [String(r.month), String(r.year), r.income, r.landlordCosts + r.vacancyCosts, r.oneTime, r.payment, r.interest, r.principal + r.extra, r.cashflow,
        ...(taxOn ? [r.cashflowAfterTax] : []), r.balance].map((c) => (typeof c === 'number' ? number2(c) : c))),
    [p, view, taxOn]);
  const cfCol = head.indexOf('Cashflow');
  const firstNum = view === 'jahr' ? 1 : 2;
  const doExport = async (kind: 'csv' | 'pdf') => {
    setMessage(null);
    try {
      const summary: [string, string][] = [
        ['Kaufpreis / Gesamtinvestition', pdfEuro(`${euro(a.s.price)} / ${euro(a.fin.totalInvestment)}`)],
        ['Kredit / Eigenmittel', pdfEuro(`${euro(a.fin.loan)} / ${euro(a.fin.ownFunds)}`)],
        ['Nettokaltmiete / Kreditrate', pdfEuro(`${euro(a.rent.income)} / ${euro(a.month.payment)}`)],
        ['Cashflow pro Monat (vor Steuern)', pdfEuro(signed(a.month.cashflow))],
        ['Brutto- / Nettomietrendite', `${percent(a.yields.grossOnPrice, 2)} / ${percent(a.yields.netOnTotal, 2)}`],
      ];
      const blob = kind === 'csv' ? csvFromTable(head, body)
        : pdfFromTable('NATI KreditPilot – Immobilien-Investment', summary, head, body, 'Modellrechnung mit eigenen Annahmen zu Miete, Leerstand, Zinsen, Wert und Steuern. Keine Prognose und keine Beratung.');
      setMessage(await saveFile(`nati-immobilie-prognose-${view}.${kind}`, blob));
    } catch {
      setMessage('Der Export konnte nicht erstellt werden.');
    }
  };
  const th = 'sticky top-0 z-10 whitespace-nowrap bg-surface2 px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted';
  return (
    <Card title="Prognose-Tabelle" action={
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Ansicht" size="sm" value={view} onChange={setView} options={[{ value: 'jahr', label: 'Jahre' }, { value: 'monat', label: 'Monate' }]} />
        <Button onClick={() => doExport('csv')}>CSV exportieren</Button>
        <Button onClick={() => doExport('pdf')}>PDF exportieren</Button>
      </div>}>
      {message && <p role="status" className="mb-2 text-[13px] text-muted">{message}</p>}
      <div className="max-h-[560px] overflow-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead><tr>{head.map((h, i) => <th key={h} className={`${th} ${i < firstNum ? 'text-left' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="border-t border-line">
                {row.map((c, ci) => (
                  <td key={ci} className={`num whitespace-nowrap px-3 py-1.5 ${ci < firstNum ? 'text-left' : 'text-right'} ${ci === cfCol ? (c.startsWith('-') ? 'font-medium text-bad' : 'font-medium text-good') : ''}`}>
                    {ci < firstNum ? c : `${c} €`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[13px] text-muted">Laufende Kosten sind gleichmäßig auf die Monate verteilt, damit Monats- und Jahreswerte übereinstimmen. Einmalkosten stehen in ihrem Monat.</p>
    </Card>
  );
}

function PropertyCompare({ raw, projects }: { raw: AppState; projects: SavedScenario[] }) {
  const [selected, setSelected] = useState<string[]>(() => projects.slice(0, 2).map((p) => p.id));
  const chosen = projects.filter((p) => selected.includes(p.id)).slice(0, 3);
  const columns = useMemo(() => [{ name: 'Aktuelle Eingabe', state: raw }, ...chosen.map((p) => ({ name: p.name, state: p.state }))].map((c) => ({ ...c, m: compareMetrics(c.state) })), [raw, chosen]);
  const hmz = (st: AppState) => st.invest.rent.components.filter((c) => !c.passThrough).reduce((s, c) => s + c.amount, 0);
  const rows: { label: string; get: (c: (typeof columns)[number]) => string; best?: 'max' | 'min'; num?: (c: (typeof columns)[number]) => number }[] = [
    { label: 'Kaufpreis', get: (c) => euro(c.state.price) },
    { label: 'Nettokaltmiete', get: (c) => euro(hmz(c.state)) },
    { label: 'Gesamtinvestition', get: (c) => euro(c.m.totalInvestment) },
    { label: 'Eigenkapitalbedarf', get: (c) => euro(c.m.ownFunds), best: 'min', num: (c) => c.m.ownFunds },
    { label: 'Kredit', get: (c) => euro(c.m.loan) },
    { label: 'Monatsrate', get: (c) => euro(c.m.payment), best: 'min', num: (c) => c.m.payment },
    { label: 'Monatlicher Cashflow', get: (c) => signed(c.m.cashflow), best: 'max', num: (c) => c.m.cashflow },
    { label: 'Bruttomietrendite', get: (c) => percent(c.m.grossYield, 2), best: 'max', num: (c) => c.m.grossYield },
    { label: 'Nettomietrendite', get: (c) => percent(c.m.netYield, 2), best: 'max', num: (c) => c.m.netYield },
    { label: 'Restschuld nach 10 Jahren', get: (c) => euro(c.m.balance10), best: 'min', num: (c) => c.m.balance10 },
    { label: 'Langfristige Rendite pro Jahr', get: (c) => (c.m.irr === null ? '–' : percent(c.m.irr, 2)), best: 'max', num: (c) => c.m.irr ?? -Infinity },
    { label: 'Finanzierungsrisiko', get: (c) => `${c.m.risk} · Beleihung ${percent(c.m.ltv, 0)}${c.m.dscr === null ? '' : ` · Deckung ${number2(c.m.dscr)}`}` },
  ];
  return (
    <Card title="Immobilienvergleich">
      {projects.length === 0 ? (
        <p className="text-sm text-muted">Speichere zuerst eine Immobilie unter „Meine Immobilien“ in der linken Spalte. Ändere dann die Eingaben für die nächste Immobilie und vergleiche beide hier.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">Wähle bis zu drei gespeicherte Immobilien für den Vergleich mit der aktuellen Eingabe.</p>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {projects.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm">
                <input id={`vgl-${p.id}`} type="checkbox" checked={selected.includes(p.id)} disabled={!selected.includes(p.id) && chosen.length >= 3}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))} className="h-4 w-4 accent-[var(--accent)]" />
                {p.name}
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm" style={{ minWidth: `${180 + columns.length * 150}px` }}>
              <thead>
                <tr className="bg-surface2"><th className="px-3 py-2 text-left font-semibold" />{columns.map((c, i) => <th key={i} className="px-3 py-2 text-right font-semibold">{c.name}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const nums = r.num ? columns.map(r.num) : null;
                  const best = nums && columns.length > 1 ? (r.best === 'max' ? Math.max(...nums) : Math.min(...nums)) : null;
                  return (
                    <tr key={r.label} className="border-t border-line">
                      <td className="px-3 py-2">{r.label}</td>
                      {columns.map((c, i) => (
                        <td key={i} className={`num px-3 py-2 text-right ${nums && best !== null && nums[i] === best && new Set(nums).size > 1 ? 'font-semibold text-good' : 'font-medium'}`}>{r.get(c)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] text-muted">Grün markiert ist der jeweils günstigste Wert. Langfristige Rendite: interner Zinsfuß auf die Eigenmittel inklusive Verkauf zum Prognosewert, ohne Verkaufskosten. Deckung: Ertrag nach Kosten geteilt durch Kreditrate, unter 1 reicht die Miete nicht.</p>
        </>
      )}
    </Card>
  );
}

type Tab = 'ueberblick' | 'miete' | 'prognose' | 'breakeven' | 'tabelle' | 'vergleich';

export function AdvancedInvest({ a, raw, patch, projects }: { a: Analysis; raw: AppState; patch: Patch; projects: SavedScenario[] }) {
  const [tab, setTab] = useState<Tab>('ueberblick');
  const taxOn = a.s.invest.tax.enabled;
  const fixVar = useMemo(() => {
    if (tab !== 'prognose') return null;
    const base = { ...a.s, rateChanges: [], useReference: false };
    const fix = project(a.invest, calculateLoan(toLoanInput({ ...base, mode: 'fix' })));
    const variable = project(a.invest, calculateLoan(toLoanInput({ ...base, mode: 'variabel' })));
    return { fix, variable };
  }, [a, tab]);
  const y1 = a.projection.years[0];
  return (
    <>
      <InvestDashboard a={a} />
      <Segmented label="Bereich" value={tab} onChange={setTab} options={[
        { value: 'ueberblick', label: 'Überblick' }, { value: 'miete', label: 'Miete und Kosten' }, { value: 'prognose', label: 'Prognose' },
        { value: 'breakeven', label: 'Break-even' }, { value: 'tabelle', label: 'Tabelle' }, { value: 'vergleich', label: 'Vergleich' },
      ]} />
      {tab === 'ueberblick' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Ledger a={a} />
          <IncomeExpenseChart a={a} />
          <CashflowChart p={a.projection} afterTax={taxOn} />
          <ValueChart a={a} />
        </div>
      )}
      {tab === 'miete' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <RentCompositionChart a={a} />
          <CostDistributionChart a={a} />
          {taxOn && (
            <Card title="Steuerschätzung für Jahr 1" action={<Badge>vereinfacht</Badge>}>
              <Row label="Mieteinnahmen" value={euro(y1.income)} />
              <Row label="Kreditzinsen (abzugsfähig)" value={`− ${euro(y1.interest)}`} tone="muted" />
              <Row label="Gebäudeabschreibung (AfA)" value={`− ${euro(y1.afa)}`} tone="muted" sub={`${percent(a.s.invest.tax.afaRate, 2)} vom Gebäudeanteil${a.s.invest.tax.accelerated ? ', im ersten Jahr dreifach' : ''}`} />
              <Row label="Übrige abzugsfähige Kosten" value={`− ${euro(y1.income - y1.interest - y1.afa - y1.taxableSurplus)}`} tone="muted" />
              <Row label="Tilgung (nicht abzugsfähig)" value={euro(y1.principal)} tone="muted" sub="zählt als Auszahlung, aber nicht als Aufwand" />
              <Row label="Steuerlicher Überschuss" value={signed(y1.taxableSurplus)} strong />
              <Row label={`Geschätzte Steuer bei ${a.s.invest.tax.marginalRate} %`} value={signed(-y1.tax)} tone={y1.tax > 0 ? 'bad' : 'good'} />
              <Row label="Cashflow vor Steuern" value={signed(y1.cashflow)} />
              <Row label="Cashflow nach Steuern" value={signed(y1.cashflowAfterTax)} strong tone={tone(y1.cashflowAfterTax)} />
            </Card>
          )}
          <Card title="Rendite-Kennzahlen">
            <Row label="Bruttomietrendite" value={percent(a.yields.grossOnPrice, 2)} sub={`${euro(a.month.incomeFull * 12)} Jahresmiete ÷ ${euro(a.s.price)} Kaufpreis`} />
            <Row label="Bruttomietrendite auf Gesamtinvestition" value={percent(a.yields.grossOnTotal, 2)} sub={`÷ ${euro(a.fin.totalInvestment)}`} />
            <Row label="Nettomietrendite vor Finanzierung" value={percent(a.yields.netOnTotal, 2)} sub={`${euro(a.month.netOperating * 12)} Nettoertrag ÷ Gesamtinvestition`} />
            <Row label="Cash-on-Cash-Rendite" value={a.yields.cashOnCash === null ? '–' : percent(a.yields.cashOnCash, 2)} sub={`${euro(a.month.cashflow * 12)} Cashflow ÷ ${euro(a.fin.ownFunds)} Eigenmittel`} />
            <Row label={`Langfristige Rendite über ${a.projection.years.length} Jahre`} value={a.projection.irr === null ? '–' : `${percent(a.projection.irr, 2)} pro Jahr`} strong sub="interner Zinsfuß inkl. Verkauf zum Prognosewert" />
          </Card>
        </div>
      )}
      {tab === 'prognose' && fixVar && (
        <div className="grid gap-4 xl:grid-cols-2">
          <CumulativeChart p={a.projection} afterTax={taxOn} ownFunds={a.fin.ownFunds} />
          <FixVarChart current={a.projection} fix={fixVar.fix} variable={fixVar.variable} labelVar={`${a.s.fixYears} Jahre fix, dann ${percent(a.s.variableRate)}`} />
          <YieldChart p={a.projection} />
          <ValueChart a={a} />
          <BalanceChart result={a.loan} principal={a.fin.loan} />
          <SplitChart result={a.loan} />
        </div>
      )}
      {tab === 'breakeven' && <BreakEvenPanel a={a} raw={raw} patch={patch} />}
      {tab === 'tabelle' && <ProjectionTable a={a} />}
      {tab === 'vergleich' && <PropertyCompare raw={raw} projects={projects} />}
    </>
  );
}

