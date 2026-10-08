import { useMemo, useState } from 'react';
import type { Analysis } from '../lib/analysis';
import { dateDe, euro, monthYear, percent, signedEuro, years } from '../lib/format';
import { balanceAtDate, calculateLoan, milestones, NO_EXTRAS, realTotal, type ExtraEffect } from '../lib/loan';
import { rateScenarios } from '../lib/offers';
import type { AppState } from '../lib/state';
import { LinesChart } from './Charts';
import type { Patch } from './Settings';
import { Badge, Card, DateBox, Field, Note, Row, SliderField } from './ui';

// ---------- Sondertilgung: mit und ohne im Vergleich ----------
export function ExtraSimulator({ a, effect }: { a: Analysis; effect: ExtraEffect | null }) {
  const base = useMemo(() => calculateLoan({ ...a.loanInput, extra: { ...NO_EXTRAS, strategy: a.loanInput.extra.strategy }, extraRules: [] }, false), [a.loanInput]);
  const data = useMemo(() => {
    const n = Math.max(base.years.length, a.loan.years.length);
    return [{ jahr: 0, 'Ohne Sondertilgung': a.fin.loan, 'Mit Sondertilgung': a.fin.loan }, ...Array.from({ length: n }, (_, i) => ({
      jahr: i + 1, 'Ohne Sondertilgung': base.years[i]?.balance ?? 0, 'Mit Sondertilgung': a.loan.years[i]?.balance ?? 0,
    }))];
  }, [base, a.loan, a.fin.loan]);
  if (!effect) {
    return <Card title="Sondertilgungs-Simulator"><p className="text-sm text-muted">Trage links unter „Sondertilgungen“ einen Betrag ein. Hier siehst du dann, wie sich Laufzeit, Zinsen und Restschuld verändern.</p></Card>;
  }
  const planned = a.loan.rows.filter((r) => r.extra > 0);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <LinesChart title="Restschuld mit und ohne Sondertilgung" data={data} xKey="jahr" xLabel="Kreditjahr" tooltipTitle={(l) => (l === 0 ? 'Kreditbeginn' : `Ende Jahr ${l}`)}
        lines={[{ key: 'Ohne Sondertilgung', color: 'var(--muted)', dashed: true }, { key: 'Mit Sondertilgung', color: 'var(--good)' }]} />
      <Card title="Wirkung der Sondertilgungen">
        <Row label="Summe der Sondertilgungen" value={euro(a.loan.totalExtra)} sub={`${planned.length} Zahlungen`} />
        <Row label="Ursprüngliche Laufzeit" value={years(effect.baseMonths)} tone="muted" />
        <Row label="Neue Laufzeit" value={years(a.loan.months)} sub={a.loan.endDate ? `schuldenfrei im ${monthYear(a.loan.endDate)}` : undefined} />
        <Row label="Eingesparte Monate" value={String(effect.monthsSaved)} tone={effect.monthsSaved > 0 ? 'good' : undefined} />
        <Row label="Ursprüngliche Gesamtzinsen" value={euro(effect.baseInterest)} tone="muted" />
        <Row label="Neue Gesamtzinsen" value={euro(a.loan.totalInterest)} />
        <Row label="Zinsersparnis" value={euro(effect.interestSaved)} tone="good" />
        <Row label="Entschädigung und Gebühren" value={effect.prepayFees > 0 ? `− ${euro(effect.prepayFees)}` : euro(0)} tone={effect.prepayFees > 0 ? 'bad' : 'muted'} />
        <Row label="Nettoersparnis" value={euro(effect.netSaving)} strong tone={effect.netSaving >= 0 ? 'good' : 'bad'} />
        {a.loanInput.extraLimitPercent ? <p className="mt-2 text-[13px] text-muted">Vertragsgrenze: höchstens {euro((a.fin.loan * a.loanInput.extraLimitPercent) / 100)} pro Kreditjahr. Höhere Beträge wurden gekürzt.</p> : null}
      </Card>
      <Card title="Sondertilgungs-Kalender" className="xl:col-span-2">
        <div className="max-h-64 overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead><tr className="bg-surface2 text-[12px] uppercase tracking-wide text-muted"><th scope="col" className="px-3 py-2 text-left font-semibold">Datum</th><th scope="col" className="px-3 py-2 text-right font-semibold">Kreditmonat</th><th scope="col" className="px-3 py-2 text-right font-semibold">Sondertilgung</th><th scope="col" className="px-3 py-2 text-right font-semibold">Restschuld danach</th></tr></thead>
            <tbody>
              {planned.slice(0, 600).map((r) => (
                <tr key={r.month} className="border-t border-line"><td className="num px-3 py-1.5">{dateDe(r.date)}</td><td className="num px-3 py-1.5 text-right">{r.month}</td><td className="num px-3 py-1.5 text-right font-medium text-good">{euro(r.extra)}</td><td className="num px-3 py-1.5 text-right">{euro(r.balance)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------- Zins-Simulator ----------
export function RateSimulator({ a }: { a: Analysis }) {
  const s = a.s;
  const [custom, setCustom] = useState(3);
  const fixYears = Math.min(s.fixYears, s.termYears);
  const canSimulate = fixYears < s.termYears;
  const baseRate = s.mode === 'variabel' ? (s.useReference ? Math.max(0, s.referenceRate + s.margin) : s.variableRate) : s.fixRate;
  const scenarios = useMemo(() => (canSimulate ? rateScenarios(a.loanInput, fixYears, baseRate, [
    { label: 'Bleibt unverändert', delta: 0 }, { label: 'Steigt um 1 Prozentpunkt', delta: 1 }, { label: 'Steigt um 2 Prozentpunkte', delta: 2 },
    { label: 'Sinkt um 1 Prozentpunkt', delta: -1 }, { label: `Eigenes Szenario (${custom > 0 ? '+' : ''}${custom.toLocaleString('de-DE')})`, delta: custom },
  ]) : []), [a.loanInput, fixYears, baseRate, custom, canSimulate]);
  const data = useMemo(() => {
    if (!scenarios.length) return [];
    const n = Math.max(...scenarios.map((x) => x.result.years.length));
    return Array.from({ length: n }, (_, i) => Object.fromEntries([['jahr', i + 1], ...scenarios.map((x) => [x.label, x.result.years[i]?.monthlyPayment ?? 0])]));
  }, [scenarios]);
  if (!canSimulate) {
    return <Card title="Zins-Simulator"><p className="text-sm text-muted">Die Fixzinsdauer entspricht der gesamten Laufzeit, daher gibt es kein Zinsänderungsrisiko. Wähle links „Fix, danach variabel“ und eine kürzere Fixzinsdauer, um Zinsänderungen zu simulieren.</p></Card>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Card title="Zins-Simulator" action={<Badge>Annahmen</Badge>}>
        <p className="mb-3 text-sm text-muted">
          Was passiert nach {fixYears} Jahren Fixzins? Ausgangswert ist {percent(baseRate, 3)}{s.mode === 'fix' ? ' (dein Fixzins, weil links durchgehender Fixzins gewählt ist)' : ''}.
          {s.rateCapOn || s.rateFloorOn ? ' Ober- und Untergrenze werden berücksichtigt.' : ''}
        </p>
        <SliderField id="zins-eigen" label="Eigenes Szenario: Veränderung" value={custom} min={-5} max={8} step={0.1} decimals={1} unit="%-Pkt." onChange={setCustom} />
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead><tr className="bg-surface2 text-[12px] uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Szenario</th><th scope="col" className="px-3 py-2 text-right font-semibold">Zins ab Jahr {fixYears + 1}</th><th scope="col" className="px-3 py-2 text-right font-semibold">Neue Rate</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Gesamtzinsen</th><th scope="col" className="px-3 py-2 text-right font-semibold">Mehrkosten / Ersparnis</th>
            </tr></thead>
            <tbody>
              {scenarios.map((x) => (
                <tr key={x.label} className="border-t border-line">
                  <td className="px-3 py-2">{x.label}</td>
                  <td className="num px-3 py-2 text-right">{percent(x.result.rows[fixYears * 12]?.rate ?? x.rate, 3)}</td>
                  <td className="num px-3 py-2 text-right font-medium">{euro(x.paymentAfterFix)}<span className={`block text-[12px] font-normal ${x.paymentDiff > 0 ? 'text-bad' : x.paymentDiff < 0 ? 'text-good' : 'text-muted'}`}>{x.delta === 0 ? 'Ausgangswert' : signedEuro(x.paymentDiff)}</span></td>
                  <td className="num px-3 py-2 text-right">{euro(x.result.totalInterest)}</td>
                  <td className={`num px-3 py-2 text-right font-medium ${x.interestDiff > 0 ? 'text-bad' : x.interestDiff < 0 ? 'text-good' : 'text-muted'}`}>{x.delta === 0 ? '–' : signedEuro(x.interestDiff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-muted">Restschuld am Ende der Fixzinsperiode: {euro(scenarios[0].result.rows[fixYears * 12 - 1]?.balance ?? 0)}. Es werden keine aktuellen EURIBOR-Werte geladen, alle Zinssätze sind deine Annahmen.</p>
      </Card>
      <LinesChart title="Rate im Zeitverlauf je Szenario" data={data} xKey="jahr" xLabel="Kreditjahr" step yEuro={false} tooltipTitle={(l) => `Jahr ${l}`}
        lines={scenarios.map((x, i) => ({ key: x.label, dashed: i === 4 }))} />
    </div>
  );
}

// ---------- Meilensteine, Restschuld zu einem Datum, Inflation ----------
export function MilestonesPanel({ a, raw, patch }: { a: Analysis; raw: AppState; patch: Patch }) {
  const ms = useMemo(() => milestones(a.loanInput, a.loan), [a.loanInput, a.loan]);
  const [date, setDate] = useState(() => a.loan.rows[Math.min(59, a.loan.rows.length - 1)]?.date ?? '');
  const total = a.loan.months;
  const real = useMemo(() => realTotal(a.loan, raw.inflation), [a.loan, raw.inflation]);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Finanzierungs-Timeline">
        <ol className="relative ml-2 flex flex-col gap-4 border-l-2 border-line pl-5">
          <li className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-accent bg-surface" />
            <div className="text-sm font-medium">Kreditbeginn</div>
            <div className="num text-[13px] text-muted">{dateDe(raw.loanStart)} · {euro(a.fin.loan)}</div>
          </li>
          {ms.map((m) => (
            <li key={m.label} className="relative">
              <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ${m.label === 'Schuldenfrei' ? 'bg-good' : 'bg-accent'}`} />
              <div className="text-sm font-medium">{m.label}</div>
              <div className="num text-[13px] text-muted">{monthYear(m.date)} · nach {years(m.month)}{total > 0 ? ` · ${Math.round((m.month / total) * 100)} % der Laufzeit` : ''}</div>
              {m.detail && <div className="text-[13px] text-muted">{m.detail}</div>}
            </li>
          ))}
        </ol>
        {a.loan.neverRepaid && <p role="alert" className="mt-3 text-[13px] text-bad">Mit dieser Rate wird der Kredit nicht zurückgezahlt.</p>}
      </Card>
      <div className="flex flex-col gap-4">
        <Card title="Restschuld zu einem Datum">
          <Field label="Stichtag" htmlFor="stichtag"><DateBox id="stichtag" value={date} min={raw.loanStart} max={a.loan.endDate || undefined} onChange={setDate} /></Field>
          <div className="mt-2">
            <Row label={`Restschuld am ${dateDe(date)}`} value={euro(balanceAtDate(a.loan, date, a.fin.loan))} strong />
            <Row label="Bis dahin getilgt" value={euro(a.fin.loan - balanceAtDate(a.loan, date, a.fin.loan))} tone="muted" />
            <Row label="Bis dahin gezahlt (Raten, Sondertilgungen, Gebühren)" value={euro(a.loan.rows.filter((r) => r.date && r.date <= date).reduce((s, r) => s + r.total, 0))} tone="muted" />
          </div>
          {a.variable && date > (a.loan.rows[raw.fixYears * 12 - 1]?.date ?? '9999') && <p className="mt-2 text-[13px] text-muted">Der Stichtag liegt nach der Fixzinsperiode. Der Wert hängt von deinen Zinsannahmen ab.</p>}
        </Card>
        <Card title="Reale Belastung mit Inflation" action={<Badge>Annahme</Badge>}>
          <SliderField id="inflation" label="Inflation pro Jahr" value={raw.inflation} min={0} max={8} step={0.1} decimals={1} unit="%" onChange={(v) => patch({ inflation: v })} />
          <div className="mt-2">
            <Row label="Alle Zahlungen nominal" value={euro(a.loan.grandTotal)} tone="muted" />
            <Row label="In heutiger Kaufkraft" value={euro(real.total + (a.loanInput.oneTimeCosts ?? 0))} strong />
            <Row label="Letzte Rate in heutiger Kaufkraft" value={euro(real.lastPaymentReal)} sub={`nominal ${euro(a.loan.rows.filter((r) => r.due).slice(-2)[0]?.payment ?? 0)}`} />
          </div>
          <Note>Bei Inflation verliert Geld an Wert. Eine gleichbleibende Rate fällt dir deshalb mit den Jahren leichter, sofern dein Einkommen mit der Inflation steigt.</Note>
        </Card>
      </div>
    </div>
  );
}
