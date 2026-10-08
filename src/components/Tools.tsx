import { useMemo } from 'react';
import { calculateAfford, DEFAULT_RULES, type AffordState } from '../lib/afford';
import type { Analysis } from '../lib/analysis';
import { euro, number2, percent, signedEuro, years } from '../lib/format';
import { calculatePoi, type PoiState } from '../lib/payinvest';
import { calculateRefi, type RefiState } from '../lib/refinance';
import type { AppState } from '../lib/state';
import { BarsChart, LinesChart } from './Charts';
import type { Patch } from './Settings';
import { Badge, Button, Card, InfoTip, Note, ResultCard, Row, Segmented, SliderField, StatusPill, Toggle, TwoCol } from './ui';

const tone = (v: number) => (v >= 0 ? 'good' : 'bad') as 'good' | 'bad';

// ---------- Leistbarkeit ----------
export function AffordSection({ s, patch, a, advanced }: { s: AppState; patch: Patch; a: Analysis; advanced: boolean }) {
  const f = s.afford;
  const set = (p: Partial<AffordState>) => patch({ afford: { ...f, ...p } });
  const loan = { payment: a.month.payment, principal: a.fin.loan, ratePercent: a.s.fixRate, termMonths: a.s.termYears * 12, propertyValue: a.s.price };
  const r = useMemo(() => calculateAfford(f, loan, s.rules), [f, loan.payment, loan.principal, loan.ratePercent, loan.termMonths, loan.propertyValue, s.rules]);
  const money = (id: keyof AffordState, label: string, max: number, hint?: string) => (
    <SliderField id={`lb-${id}`} label={label} value={f[id] as number} min={0} max={max} step={10} unit="€" onChange={(v) => set({ [id]: v } as Partial<AffordState>)} hint={hint} />
  );
  const pct = (id: keyof AffordState, label: string, max: number, hint?: string) => (
    <SliderField id={`lb-${id}`} label={label} value={f[id] as number} min={0} max={max} step={1} unit="%" onChange={(v) => set({ [id]: v } as Partial<AffordState>)} hint={hint} />
  );
  const setRule = (p: Partial<AppState['rules']>) => patch({ rules: { ...s.rules, ...p } });
  const ok = r.status === 'ok';

  return (
    <TwoCol aside={
      <>
        <Card title="Einkommen pro Monat (netto)">
          <div className="flex flex-col gap-4">
            {money('income1', 'Dein Nettoeinkommen', 15000)}
            {money('income2', 'Einkommen Partner oder Partnerin', 15000)}
            {money('incomeOther', 'Sonstige regelmäßige Einnahmen', 10000, 'Zum Beispiel Familienbeihilfe oder Mieteinnahmen.')}
            <Toggle id="lb-14" checked={f.salaries14} onChange={(v) => set({ salaries14: v })} label="13. und 14. Gehalt für die Quote mitrechnen" />
          </div>
        </Card>
        <Card title="Ausgaben pro Monat">
          <div className="flex flex-col gap-4">
            {money('housing', 'Wohnkosten ohne neue Kreditrate', 5000, 'Nur was nach dem Kauf weiterläuft, zum Beispiel eine zweite Wohnung.')}
            {money('operating', 'Betriebskosten', 2000)}
            {money('energy', 'Energie', 1500)}
            {money('food', 'Lebensmittel und Haushalt', 4000)}
            {money('mobility', 'Mobilität', 3000)}
            {money('insurance', 'Versicherungen', 2000)}
            {money('existingLoans', 'Bestehende Kredite und Leasing', 5000)}
            {money('alimony', 'Unterhalt', 5000)}
            {money('children', 'Kinder (Betreuung, Schule)', 5000)}
            {money('other', 'Sonstige Fixkosten', 5000)}
            {money('savings', 'Monatliche Rücklagen', 5000)}
          </div>
        </Card>
        <Card title="Sicherheit">
          <div className="flex flex-col gap-4">
            {money('buffer', 'Das soll mindestens übrig bleiben', 3000)}
            <SliderField id="lb-reserve" label="Ersparnisse als Notgroschen" value={f.reserve} min={0} max={200000} step={500} unit="€" onChange={(v) => set({ reserve: v })} />
          </div>
        </Card>
        {advanced && (
          <Card title="Annahmen und Orientierungswerte" collapsible defaultOpen={false}>
            <div className="flex flex-col gap-4">
              <SliderField id="lb-stress" label="Zins-Stresstest" value={f.stressRate} min={0} max={6} step={0.5} decimals={1} unit="%-Pkt." onChange={(v) => set({ stressRate: v })} />
              {pct('incomeLossPct', 'Einkommensverlust', 80)}
              {pct('karenzSharePct', 'Karenz: verbleibendes Einkommen', 100)}
              {pct('partTimeSharePct', 'Teilzeit: verbleibendes Einkommen', 100)}
              {pct('operatingUpPct', 'Betriebskosten steigen um', 100)}
              {pct('livingUpPct', 'Lebenshaltung steigt um', 50)}
              <SliderField id="lb-unerwartet" label="Unerwartete Ausgabe" value={f.unexpected} min={0} max={100000} step={500} unit="€" onChange={(v) => set({ unexpected: v })} />
              <p className="text-sm font-semibold">Orientierungswerte der Aufsicht</p>
              <SliderField id="regel-dsti" label="Schuldendienstquote höchstens" value={s.rules.maxDsti} min={20} max={60} step={1} unit="%" onChange={(v) => setRule({ maxDsti: v })} />
              <SliderField id="regel-ltv" label="Beleihungsquote höchstens" value={s.rules.maxLtv} min={50} max={110} step={1} unit="%" onChange={(v) => setRule({ maxLtv: v })} />
              <SliderField id="regel-laufzeit" label="Laufzeit höchstens" value={s.rules.maxTerm} min={10} max={40} step={1} unit="Jahre" onChange={(v) => setRule({ maxTerm: v })} />
              <Button onClick={() => patch({ rules: DEFAULT_RULES })}>Auf FMA-Werte zurücksetzen</Button>
            </div>
          </Card>
        )}
      </>
    }>
      <div className={`rounded-card p-5 ${ok ? 'bg-good text-surface' : r.status === 'knapp' ? 'bg-zins text-onwarn' : 'bg-bad text-surface'}`}>
        <div className="text-sm font-medium opacity-90">{r.surplus >= 0 ? 'Nach allen Ausgaben und der Kreditrate bleiben dir' : 'Dir fehlen pro Monat'}</div>
        <div className="num mt-1 font-display text-[40px] font-bold leading-none tracking-tight">{euro(Math.abs(r.surplus))}</div>
        <p className="mt-2 text-sm opacity-95">
          {ok ? `Das liegt über deinem gewünschten Puffer von ${euro(f.buffer)}.` : r.status === 'knapp' ? `Das ist weniger als dein gewünschter Puffer von ${euro(f.buffer)}.` : 'Einnahmen decken Ausgaben und Kreditrate nicht.'}
          {' '}Gerechnet mit der Kreditrate von {euro(loan.payment)} aus dem Kreditrechner.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ResultCard label="Einkommen" value={euro(r.income)} sub="pro Monat netto" />
        <ResultCard label="Ausgaben ohne Kredit" value={euro(r.expenses)} sub={`frei verfügbar ${euro(r.free)}`} />
        <ResultCard label={<>Schuldendienstquote<InfoTip term="Schuldendienstquote" /></>} value={percent(r.dsti, 1)} sub={`Orientierungswert höchstens ${s.rules.maxDsti} %`} />
        <ResultCard label="Tragbare Kreditrate" value={euro(r.affordablePayment)} sub={r.limitedBy === 'quote' ? 'begrenzt durch die Schuldendienstquote' : 'begrenzt durch deinen Haushalt'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Orientierungswerte der Aufsicht" action={<Badge>keine Kreditzusage</Badge>}>
          {r.checks.map((c) => (
            <Row key={c.label} label={c.label} value={c.value} tone={c.ok ? 'good' : 'bad'} sub={`${c.limit} · ${c.ok ? 'eingehalten' : 'überschritten'}`} />
          ))}
          <Note>Quelle: {s.rules.source}. Die Werte sind eine Erwartung der Aufsicht an Banken, kein Gesetz. Banken dürfen in begründeten Fällen abweichen und prüfen zusätzlich nach eigenen Regeln. Für Kredite unter 50.000 € gelten sie nicht.</Note>
        </Card>
        <Card title="Wie viel Kredit wäre tragbar?">
          <Row label="Tragbare Rate" value={euro(r.affordablePayment)} />
          <Row label={`Möglicher Kreditbetrag bei ${percent(loan.ratePercent)}`} value={euro(r.maxLoan)} strong sub={`${a.s.termYears} Jahre Laufzeit, Annuität`} />
          <Row label={`Bei ${percent(loan.ratePercent + f.stressRate)} (Stresstest)`} value={euro(r.maxLoanStress)} tone="muted" />
          <Row label="Dein geplanter Kredit" value={euro(loan.principal)} tone={loan.principal <= r.maxLoan ? 'good' : 'bad'} />
          <Row label="Notgroschen reicht für" value={Number.isFinite(r.reserveMonths) ? `${number2(r.reserveMonths)} Monate` : 'unbegrenzt'} sub="alle Ausgaben inkl. Kreditrate, ohne Einkommen" />
          <Row label={`Nach unerwarteter Ausgabe von ${euro(f.unexpected)}`} value={euro(r.reserveAfterUnexpected)} tone={r.reserveAfterUnexpected >= 0 ? undefined : 'bad'} sub="verbleibender Notgroschen" />
        </Card>
      </div>
      <Card title="Belastungsszenarien" action={<Badge>Annahmen</Badge>}>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead><tr className="bg-surface2 text-[12px] uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Szenario</th><th scope="col" className="px-3 py-2 text-right font-semibold">Einkommen</th><th scope="col" className="px-3 py-2 text-right font-semibold">Ausgaben</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Kreditrate</th><th scope="col" className="px-3 py-2 text-right font-semibold">Bleibt übrig</th><th scope="col" className="px-3 py-2 text-right font-semibold">Quote</th><th scope="col" className="px-3 py-2 text-right font-semibold">Einschätzung</th>
            </tr></thead>
            <tbody>
              {r.scenarios.map((x) => (
                <tr key={x.name} className="border-t border-line align-top">
                  <td className="px-3 py-2">{x.name}<span className="block text-[12px] text-muted">{x.assumption}</span></td>
                  <td className="num px-3 py-2 text-right">{euro(x.income)}</td>
                  <td className="num px-3 py-2 text-right">{euro(x.expenses)}</td>
                  <td className="num px-3 py-2 text-right">{euro(x.payment)}</td>
                  <td className={`num px-3 py-2 text-right font-semibold ${x.surplus >= 0 ? 'text-good' : 'text-bad'}`}>{signedEuro(x.surplus)}</td>
                  <td className="num px-3 py-2 text-right">{Number.isFinite(x.dsti) ? percent(x.dsti, 1) : '–'}</td>
                  <td className="px-3 py-2 text-right"><StatusPill status={x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-muted">„Kritisch“ heißt: In diesem Fall reichen die Einnahmen nicht. Die Annahmen kannst du in der erweiterten Ansicht anpassen.</p>
      </Card>
      <BarsChart title="Haushalt im Überblick" stacked
        data={[{ name: 'Einnahmen', Einkommen: r.income }, { name: 'Ausgaben', 'Laufende Ausgaben': r.expenses, Kreditrate: loan.payment }, ...r.scenarios.slice(0, 2).map((x) => ({ name: x.name.replace(' Prozentpunkte', ' Pkt.'), 'Laufende Ausgaben': x.expenses, Kreditrate: x.payment, Einkommen: 0 }))]}
        bars={[{ key: 'Einkommen', color: 'var(--good)' }, { key: 'Laufende Ausgaben', color: 'var(--alt)' }, { key: 'Kreditrate', color: 'var(--zins)' }]} foot="pro Monat" />
    </TwoCol>
  );
}

// ---------- Umschuldung ----------
export function RefiSection({ s, patch, a }: { s: AppState; patch: Patch; a: Analysis }) {
  const f = s.refi;
  const set = (p: Partial<RefiState>) => patch({ refi: { ...f, ...p } });
  const r = useMemo(() => calculateRefi(f), [f]);
  const scen = useMemo(() => [-1, 0, 1, 2].map((d) => ({ d, res: d === 0 ? r : calculateRefi(f, d) })), [f, r]);
  const variable = f.newMode === 'variabel' && f.newFixYears * 12 < (f.newTermMonths || f.remainingMonths);
  const data = r.advantage.filter((p, i) => i % 3 === 2 || i === r.advantage.length - 1).map((p) => ({ monat: p.month, 'Vorteil des Wechsels': p.value }));
  const worth = r.netSaving > 0;
  return (
    <TwoCol aside={
      <>
        <Card title="Bestehender Kredit" action={<Button onClick={() => set({ balance: Math.round(a.fin.loan), oldRate: a.s.fixRate, remainingMonths: a.s.termYears * 12, oldMonthlyFee: a.fees })}>Aus Kreditrechner</Button>}>
          <div className="flex flex-col gap-4">
            <SliderField id="us-rest" label="Aktuelle Restschuld" value={f.balance} min={1000} max={1000000} step={1000} unit="€" onChange={(v) => set({ balance: v })} />
            <SliderField id="us-altzins" label="Aktueller Zinssatz" value={f.oldRate} min={0} max={12} step={0.05} decimals={3} unit="%" onChange={(v) => set({ oldRate: v })} />
            <SliderField id="us-restlaufzeit" label="Restlaufzeit" value={f.remainingMonths} min={6} max={480} step={1} unit="Monate" onChange={(v) => set({ remainingMonths: v })} hint={years(f.remainingMonths)} />
            <SliderField id="us-altkonto" label="Kontoführung pro Monat" value={f.oldMonthlyFee} min={0} max={50} step={0.5} decimals={2} unit="€" onChange={(v) => set({ oldMonthlyFee: v })} />
          </div>
        </Card>
        <Card title="Kosten des Wechsels">
          <div className="flex flex-col gap-4">
            <SliderField id="us-entschaedigung" label={<>Entschädigung an die alte Bank<InfoTip term="Entschädigung" /></>} value={f.penaltyPercent} min={0} max={4} step={0.1} decimals={2} unit="%" onChange={(v) => set({ penaltyPercent: v })} hint={`= ${euro(r.penalty)}`} />
            <SliderField id="us-wechsel" label="Sonstige Wechselkosten" value={f.switchCosts} min={0} max={20000} step={50} unit="€" onChange={(v) => set({ switchCosts: v })} hint="Löschung und Neueintragung des Pfandrechts, Beglaubigung, Schätzung." />
            <SliderField id="us-bearbeitung" label="Bearbeitungsgebühr neue Bank" value={f.newSetupPercent} min={0} max={4} step={0.1} decimals={2} unit="%" onChange={(v) => set({ newSetupPercent: v })} />
            <SliderField id="us-bearbeitung-euro" label="Weitere Kosten neue Bank" value={f.newSetupEuro} min={0} max={10000} step={50} unit="€" onChange={(v) => set({ newSetupEuro: v })} />
            <Toggle id="us-mitfinanzieren" checked={f.financeCosts} onChange={(v) => set({ financeCosts: v })} label="Wechselkosten über den neuen Kredit finanzieren" />
          </div>
        </Card>
        <Card title="Neuer Kredit">
          <div className="flex flex-col gap-4">
            <Segmented label="Zinsbindung neuer Kredit" size="sm" value={f.newMode} onChange={(v) => set({ newMode: v })} options={[{ value: 'fix', label: 'Fixzins' }, { value: 'variabel', label: 'Fix, danach variabel' }]} />
            <SliderField id="us-neuzins" label={f.newMode === 'fix' ? 'Neuer Zinssatz' : 'Neuer Fixzins'} value={f.newRate} min={0} max={12} step={0.05} decimals={3} unit="%" onChange={(v) => set({ newRate: v })} />
            {f.newMode === 'variabel' && (
              <>
                <SliderField id="us-fixjahre" label="Fixzinsdauer" value={f.newFixYears} min={1} max={30} step={1} unit="Jahre" onChange={(v) => set({ newFixYears: v })} />
                <SliderField id="us-variabel" label="Danach variabel (Annahme)" value={f.newVariableRate} min={0} max={12} step={0.05} decimals={3} unit="%" onChange={(v) => set({ newVariableRate: v })} />
              </>
            )}
            <SliderField id="us-neulaufzeit" label="Neue Laufzeit" value={f.newTermMonths} min={0} max={480} step={1} unit="Monate" onChange={(v) => set({ newTermMonths: v })} hint={f.newTermMonths === 0 ? 'Gleich wie die bisherige Restlaufzeit.' : years(f.newTermMonths)} />
            <SliderField id="us-neukonto" label="Kontoführung pro Monat" value={f.newMonthlyFee} min={0} max={50} step={0.5} decimals={2} unit="€" onChange={(v) => set({ newMonthlyFee: v })} />
            <Toggle id="us-rate-behalten" checked={f.keepPayment} onChange={(v) => set({ keepPayment: v })} label="Bisherige Rate weiterzahlen und früher fertig sein" />
          </div>
        </Card>
      </>
    }>
      <div className={`rounded-card p-5 text-surface ${worth ? 'bg-good' : 'bg-bad'}`}>
        <div className="text-sm font-medium opacity-90">{worth ? 'Die Umschuldung spart dir insgesamt' : 'Die Umschuldung kostet dich insgesamt'}</div>
        <div className="num mt-1 font-display text-[40px] font-bold leading-none tracking-tight">{euro(Math.abs(r.netSaving))}</div>
        <p className="mt-2 text-sm opacity-95">
          {r.breakEvenMonth !== null ? `Die Wechselkosten von ${euro(r.upfront)} sind nach ${years(r.breakEvenMonth)} hereingespielt.` : `Die Wechselkosten von ${euro(r.upfront)} werden über die Laufzeit nicht hereingespielt.`}
          {variable ? ' Nach der Fixzinsphase gilt deine Zinsannahme.' : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ResultCard label="Monatliche Ersparnis" value={signedEuro(r.monthlySaving)} sub="Rate und Kontoführung" />
        <ResultCard label="Rate bisher / neu" value={euro(r.newPayment)} sub={`bisher ${euro(r.oldPayment)}`} />
        <ResultCard label="Break-even" value={r.breakEvenMonth === null ? 'nie' : years(r.breakEvenMonth)} sub="ab dann lohnt sich der Wechsel" />
        <ResultCard label="Neue Restlaufzeit" value={years(r.newMonths)} sub={`bisher ${years(r.old.months)}`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Kosten im Vergleich">
          <Row label="Bisheriger Kredit: noch zu zahlen" value={euro(r.oldTotal)} sub={`davon ${euro(r.old.totalInterest)} Zinsen`} />
          <Row label="Neuer Kredit: zu zahlen" value={euro(r.neu.grandTotal)} sub={`davon ${euro(r.neu.totalInterest)} Zinsen, Kreditbetrag ${euro(r.newPrincipal)}`} />
          <Row label="Entschädigung alte Bank" value={euro(r.penalty)} tone="muted" />
          <Row label="Bearbeitung neue Bank" value={euro(r.setup)} tone="muted" />
          <Row label="Sonstige Wechselkosten" value={euro(f.switchCosts)} tone="muted" />
          <Row label="Wechselkosten gesamt" value={euro(r.upfront)} sub={f.financeCosts ? 'im neuen Kredit mitfinanziert' : 'sofort zu bezahlen'} />
          <Row label="Nettoersparnis" value={signedEuro(r.netSaving)} strong tone={tone(r.netSaving)} />
        </Card>
        <Card title="Wenn sich die Zinsen anders entwickeln" action={<Badge>Annahmen</Badge>}>
          {scen.map(({ d, res }) => (
            <Row key={d} label={d === 0 ? 'Wie eingestellt' : `Neuer ${variable ? 'variabler ' : ''}Zins ${d > 0 ? '+' : '−'}${Math.abs(d)} Prozentpunkt${Math.abs(d) > 1 ? 'e' : ''}`} value={signedEuro(res.netSaving)} tone={tone(res.netSaving)}
              sub={`Rate ${euro(variable ? (res.neu.paymentAfterFix ?? res.newPayment) : res.newPayment)}${variable ? ' nach der Fixzinsphase' : ''}`} />
          ))}
          <Note>{variable ? 'Die Veränderung betrifft den variablen Zins nach der Fixzinsphase.' : 'Zeigt, wie empfindlich das Ergebnis auf den neuen Zinssatz reagiert, zum Beispiel wenn das Angebot noch nicht fix ist.'}</Note>
        </Card>
      </div>
      <LinesChart title="Vorteil des Wechsels im Zeitverlauf" data={data} xKey="monat" xLabel="Monate seit dem Wechsel" zeroLine tooltipTitle={(l) => `Nach ${l} Monaten`} lines={[{ key: 'Vorteil des Wechsels', color: 'var(--good)' }]} />
      <Note>Gerechnet wird der bestehende Kredit als Annuität zum aktuellen Zins über die Restlaufzeit. Der Vorteil berücksichtigt die Unterschiede bei Zahlungen und Restschuld sowie alle Wechselkosten. Entschädigung: in der Fixzinsphase üblicherweise höchstens 1 %, bei variablem Zins mit Kündigungsfrist meist keine. Maßgeblich ist dein Vertrag.</Note>
    </TwoCol>
  );
}

// ---------- Tilgen oder investieren ----------
export function PoiSection({ s, patch, a }: { s: AppState; patch: Patch; a: Analysis }) {
  const f = s.poi;
  const set = (p: Partial<PoiState>) => patch({ poi: { ...f, ...p } });
  const r = useMemo(() => calculatePoi(f, a.loanInput), [f, a.loanInput]);
  const mid = r.scenarios[1];
  const investWins = mid.diff > 0;
  const rate = a.s.fixRate;
  return (
    <TwoCol aside={
      <>
        <Card title="Dein Geld">
          <div className="flex flex-col gap-4">
            <SliderField id="ti-betrag" label="Einmalig verfügbar" value={f.amount} min={0} max={200000} step={500} unit="€" onChange={(v) => set({ amount: v })} />
            <SliderField id="ti-monatlich" label="Zusätzlich pro Monat" value={f.monthly} min={0} max={3000} step={10} unit="€" onChange={(v) => set({ monthly: v })} />
            <SliderField id="ti-horizont" label="Betrachtungszeitraum" value={f.horizonYears} min={1} max={40} step={1} unit="Jahre" onChange={(v) => set({ horizonYears: v })} />
          </div>
        </Card>
        <Card title="Geldanlage" action={<Badge>unsichere Annahmen</Badge>}>
          <div className="flex flex-col gap-4">
            <SliderField id="ti-schwach" label="Rendite schwach" value={f.returnLow} min={-5} max={15} step={0.1} decimals={1} unit="%" onChange={(v) => set({ returnLow: v })} />
            <SliderField id="ti-mittel" label="Rendite mittel" value={f.returnMid} min={-5} max={15} step={0.1} decimals={1} unit="%" onChange={(v) => set({ returnMid: v })} />
            <SliderField id="ti-stark" label="Rendite stark" value={f.returnHigh} min={-5} max={15} step={0.1} decimals={1} unit="%" onChange={(v) => set({ returnHigh: v })} />
            <SliderField id="ti-kosten" label="Laufende Kosten der Anlage" value={f.costs} min={0} max={3} step={0.05} decimals={2} unit="%" onChange={(v) => set({ costs: v })} />
            <SliderField id="ti-steuer" label="Steuer auf Gewinne" value={f.taxRate} min={0} max={55} step={0.5} decimals={1} unit="%" onChange={(v) => set({ taxRate: v })} hint="In Österreich 27,5 % Kapitalertragsteuer auf Kursgewinne und Erträge von Wertpapieren." />
          </div>
        </Card>
        <Card title="Kredit">
          <Row label="Kreditbetrag" value={euro(a.fin.loan)} />
          <Row label="Zinssatz" value={a.variable ? `${percent(rate)} fix, danach ${percent(a.s.variableRate)}` : `${percent(rate)} fix`} />
          <Row label="Monatsrate" value={euro(a.loan.monthlyBurden)} />
          <p className="mt-2 text-[13px] text-muted">Aus dem Kreditrechner übernommen. Dort kannst du die Werte ändern.</p>
        </Card>
      </>
    }>
      <div className="rounded-card bg-accent p-5 text-accentfg">
        <div className="text-sm font-medium opacity-90">Bei mittlerer Rendite liegt nach {f.horizonYears} Jahren vorne</div>
        <div className="mt-1 font-display text-[32px] font-bold leading-tight tracking-tight">{Math.abs(mid.diff) < 1 ? 'keines von beiden' : investWins ? 'Investieren' : 'Sondertilgen'}</div>
        <p className="num mt-1 text-sm opacity-95">
          Unterschied im Nettovermögen: {euro(Math.abs(mid.diff))}.{' '}
          {r.breakEvenReturn === null ? 'Im Bereich von 0 bis 30 % Rendite gibt es keinen Gleichstand.' : `Investieren lohnt sich ab etwa ${percent(r.breakEvenReturn, 2)} Rendite pro Jahr vor Kosten und Steuer.`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ResultCard tone="zins" label="Ersparte Kreditzinsen" value={euro(r.interestSaved)} sub="sicher, bis zum Laufzeitende" />
        <ResultCard label="Früher schuldenfrei" value={r.monthsSaved > 0 ? years(r.monthsSaved) : '0 Monate'} sub="bei Sondertilgung" />
        <ResultCard label="Break-even-Rendite" value={r.breakEvenReturn === null ? '–' : percent(r.breakEvenReturn, 2)} sub={`Kreditzins ${percent(rate)}`} />
        <ResultCard label="Depot netto (mittel)" value={euro(mid.investNet)} sub={`nach ${euro(mid.tax)} Steuer`} />
      </div>
      <Card title="Drei Rendite-Szenarien" action={<Badge>Annahmen</Badge>}>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead><tr className="bg-surface2 text-[12px] uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Szenario</th><th scope="col" className="px-3 py-2 text-right font-semibold">Depot vor Steuer</th><th scope="col" className="px-3 py-2 text-right font-semibold">Kosten</th><th scope="col" className="px-3 py-2 text-right font-semibold">Steuer</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Vermögen: investieren</th><th scope="col" className="px-3 py-2 text-right font-semibold">Vermögen: tilgen</th><th scope="col" className="px-3 py-2 text-right font-semibold">Vorteil Investieren</th>
            </tr></thead>
            <tbody>
              {r.scenarios.map((x) => (
                <tr key={x.label} className="border-t border-line">
                  <td className="px-3 py-2">{x.label}<span className="num block text-[12px] text-muted">{percent(x.returnPercent, 1)} pro Jahr</span></td>
                  <td className="num px-3 py-2 text-right">{euro(x.investGross)}</td>
                  <td className="num px-3 py-2 text-right">{euro(x.costs)}</td>
                  <td className="num px-3 py-2 text-right">{euro(x.tax)}</td>
                  <td className="num px-3 py-2 text-right font-medium">{euro(x.wealthInvest)}</td>
                  <td className="num px-3 py-2 text-right font-medium">{euro(x.wealthRepay)}</td>
                  <td className={`num px-3 py-2 text-right font-semibold ${x.diff >= 0 ? 'text-good' : 'text-bad'}`}>{signedEuro(x.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-muted">Vermögen = Depotwert nach Steuer minus Restschuld nach {f.horizonYears} Jahren. Negative Werte bedeuten, dass die Restschuld noch höher ist als das Depot.</p>
      </Card>
      <BarsChart title="Nettovermögen nach dem Betrachtungszeitraum" data={r.scenarios.map((x) => ({ name: `${x.label} (${percent(x.returnPercent, 1)})`, Investieren: x.wealthInvest, Tilgen: x.wealthRepay }))}
        bars={[{ key: 'Investieren', color: 'var(--alt)' }, { key: 'Tilgen', color: 'var(--good)' }]} />
      <Note>
        So wird gerechnet: Beide Wege geben jeden Monat gleich viel Geld aus. Beim Tilgen fließt der Betrag in den Kredit; ist er früher abbezahlt, wird die frei gewordene Rate angelegt. Beim Investieren läuft der Kredit normal weiter.
        Die Zinsersparnis beim Tilgen ist sicher und steuerfrei. Anlagerenditen schwanken und können auch negativ sein. Gewinne werden vereinfacht am Ende einmal besteuert. Das ist keine Anlageberatung.
        {r.prepayFees > 0 ? ` Für die Sondertilgung fällt laut deinen Einstellungen eine Entschädigung von ${euro(r.prepayFees)} an.` : ''}
      </Note>
    </TwoCol>
  );
}
