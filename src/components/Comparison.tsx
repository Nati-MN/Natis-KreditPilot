import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactEuro, euro, percent } from '../lib/format';
import { balanceAfterYears, calculateLoan, type LoanResult } from '../lib/loan';
import { compareInput, loanAmount, type AppState, type CompareConfig } from '../lib/state';
import { EuroTooltip, Legend } from './Charts';
import { Badge, Card, Segmented, SliderField } from './ui';

const AXIS = { stroke: 'var(--line)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false } as const;

function Editor({ k, color, c, termYears, onChange }: { k: 'A' | 'B'; color: string; c: CompareConfig; termYears: number; onChange: (c: CompareConfig) => void }) {
  const set = (p: Partial<CompareConfig>) => onChange({ ...c, ...p });
  return (
    <div className="min-w-0 rounded-xl border border-line p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <h3 className="font-display text-base font-bold">Kredit {k}</h3>
      </div>
      <div className="flex flex-col gap-3">
        <Segmented label={`Modell Kredit ${k}`} size="sm" value={c.mode} onChange={(v) => set({ mode: v })}
          options={[{ value: 'fix', label: 'Fixzins' }, { value: 'variabel', label: 'Fix, dann variabel' }]} />
        <SliderField id={`vgl-${k}-fix`} label="Fixzins" value={c.fixRate} min={0} max={12} step={0.1} decimals={2} unit="%" onChange={(v) => set({ fixRate: v })} />
        {c.mode === 'variabel' && (
          <>
            <SliderField id={`vgl-${k}-dauer`} label="Fixzinsdauer" value={Math.min(c.fixYears, termYears)} min={1} max={termYears} step={1} unit="Jahre" onChange={(v) => set({ fixYears: v })} />
            <SliderField id={`vgl-${k}-var`} label="Danach variabel (Annahme)" value={c.variableRate} min={0} max={12} step={0.1} decimals={2} unit="%" onChange={(v) => set({ variableRate: v })} />
          </>
        )}
      </div>
    </div>
  );
}

function describe(c: CompareConfig, term: number) {
  return c.mode === 'fix' || c.fixYears >= term
    ? `${term} Jahre Fixzins ${percent(c.fixRate)}`
    : `${c.fixYears} Jahre fix ${percent(c.fixRate)}, danach variabel ${percent(c.variableRate)}`;
}

export function Comparison({ s, patch }: { s: AppState; patch: (p: Partial<AppState>) => void }) {
  const principal = loanAmount(s);
  const { a, b, stressA, stressB } = useMemo(() => {
    const stress = (c: CompareConfig) => calculateLoan(compareInput(s, { ...c, variableRate: c.variableRate + 2 }));
    return { a: calculateLoan(compareInput(s, s.compareA)), b: calculateLoan(compareInput(s, s.compareB)), stressA: stress(s.compareA), stressB: stress(s.compareB) };
  }, [s]);
  // Vergleichszeitpunkt: Ende der (kürzesten) Fixzinsperiode, sonst 10 Jahre.
  const variableConfigs = [s.compareA, s.compareB].filter((c) => c.mode === 'variabel' && c.fixYears < s.termYears);
  const pivot = Math.min(variableConfigs.length ? Math.min(...variableConfigs.map((c) => c.fixYears)) : 10, s.termYears - 1);
  const rateAt = (r: LoanResult, month: number) => r.rows[Math.min(month, r.rows.length) - 1]?.payment ?? 0;
  const risk = (c: CompareConfig, r: LoanResult, st: LoanResult) => {
    if (c.mode === 'fix' || c.fixYears >= s.termYears) return { label: 'Kein Zinsrisiko', detail: 'Die Rate ist bis zum Ende fix.' };
    const m = c.fixYears * 12 + 1;
    const diff = rateAt(st, m) - rateAt(r, m);
    const years = s.termYears - c.fixYears;
    return { label: years > s.termYears / 2 ? 'Hohes Zinsrisiko' : 'Mittleres Zinsrisiko', detail: `${years} Jahre variabel. +2 %-Punkte = ${euro(diff)} mehr pro Monat.` };
  };
  const riskA = risk(s.compareA, a, stressA);
  const riskB = risk(s.compareB, b, stressB);

  const rows: { label: string; a: number; b: number; lowerIsBetter?: boolean }[] = [
    { label: 'Monatsrate am Anfang', a: a.firstPayment, b: b.firstPayment },
    { label: `Monatsrate nach ${pivot} Jahren`, a: rateAt(a, pivot * 12 + 1), b: rateAt(b, pivot * 12 + 1) },
    { label: 'Gesamte Zinsen', a: a.totalInterest, b: b.totalInterest },
    { label: 'Gesamtrückzahlung', a: a.totalPaid, b: b.totalPaid },
    { label: `Restschuld nach ${Math.min(10, s.termYears)} Jahren`, a: balanceAfterYears(a, Math.min(10, s.termYears), principal), b: balanceAfterYears(b, Math.min(10, s.termYears), principal) },
  ];

  const lineData = useMemo(() => {
    const n = Math.max(a.years.length, b.years.length);
    return Array.from({ length: n }, (_, i) => ({
      jahr: i + 1,
      'Kredit A': a.years[i]?.monthlyPayment ?? 0,
      'Kredit B': b.years[i]?.monthlyPayment ?? 0,
    }));
  }, [a, b]);
  const barData = [
    { name: 'Kreditbetrag', 'Kredit A': principal, 'Kredit B': principal },
    { name: 'Zinsen', 'Kredit A': a.totalInterest, 'Kredit B': b.totalInterest },
    { name: 'Gesamt', 'Kredit A': a.totalPaid, 'Kredit B': b.totalPaid },
  ];
  const colA = 'var(--tilgung)';
  const colB = 'var(--alt)';

  return (
    <div className="flex flex-col gap-4">
      <Card title="Kreditvergleich" action={<Badge>Variable Zinsen sind Annahmen</Badge>}>
        <p className="mb-4 text-sm text-muted">Beide Kredite rechnen mit {euro(principal)} Kreditbetrag, {s.termYears} Jahren Laufzeit und deinen Sondertilgungen.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Editor k="A" color={colA} c={s.compareA} termYears={s.termYears} onChange={(c) => patch({ compareA: c })} />
          <Editor k="B" color={colB} c={s.compareB} termYears={s.termYears} onChange={(c) => patch({ compareB: c })} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface2 text-left">
                <th className="px-3 py-2 font-semibold" />
                <th className="px-3 py-2 text-right font-semibold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colA }} />Kredit A<div className="text-[12px] font-normal text-muted">{describe(s.compareA, s.termYears)}</div></th>
                <th className="px-3 py-2 text-right font-semibold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colB }} />Kredit B<div className="text-[12px] font-normal text-muted">{describe(s.compareB, s.termYears)}</div></th>
                <th className="px-3 py-2 text-right font-semibold">Unterschied B − A</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = Math.round((r.b - r.a) * 100) / 100;
                return (
                  <tr key={r.label} className="border-t border-line">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="num px-3 py-2 text-right font-medium">{euro(r.a)}</td>
                    <td className="num px-3 py-2 text-right font-medium">{euro(r.b)}</td>
                    <td className={`num px-3 py-2 text-right ${d > 0 ? 'text-bad' : d < 0 ? 'text-good' : 'text-muted'}`}>{d > 0 ? '+' : ''}{euro(d)}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-line align-top">
                <td className="px-3 py-2">Zinsrisiko</td>
                <td className="px-3 py-2 text-right"><span className="font-medium">{riskA.label}</span><div className="text-[12px] text-muted">{riskA.detail}</div></td>
                <td className="px-3 py-2 text-right"><span className="font-medium">{riskB.label}</span><div className="text-[12px] text-muted">{riskB.detail}</div></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Monatsrate im Vergleich">
          <Legend items={[{ color: colA, label: 'Kredit A' }, { color: colB, label: 'Kredit B' }]} />
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="jahr" {...AXIS} minTickGap={20} />
                <YAxis tickFormatter={(v: number) => `${Math.round(v)} €`} width={58} domain={[0, 'auto']} {...AXIS} axisLine={false} />
                <Tooltip content={<EuroTooltip title={(l) => `Jahr ${l}`} />} />
                <Line type="stepAfter" dataKey="Kredit A" stroke={colA} strokeWidth={2.5} dot={false} animationDuration={350} />
                <Line type="stepAfter" dataKey="Kredit B" stroke={colB} strokeWidth={2.5} strokeDasharray="6 3" dot={false} animationDuration={350} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-center text-[12px] text-muted">Kreditjahr</p>
        </Card>
        <Card title="Kosten im Vergleich">
          <Legend items={[{ color: colA, label: 'Kredit A' }, { color: colB, label: 'Kredit B' }]} />
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis tickFormatter={compactEuro} width={54} {...AXIS} axisLine={false} />
                <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={<EuroTooltip title={(l) => String(l)} />} />
                <Bar dataKey="Kredit A" fill={colA} radius={[4, 4, 0, 0]} animationDuration={350} />
                <Bar dataKey="Kredit B" fill={colB} radius={[4, 4, 0, 0]} animationDuration={350} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
