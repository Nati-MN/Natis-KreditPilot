import { useMemo, useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { compactEuro, euro, percent } from '../lib/format';
import type { LoanResult } from '../lib/loan';
import { Badge, Card, InfoTip, Segmented } from './ui';

const AXIS = { stroke: 'var(--line)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false } as const;
const GRID = <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />;
const ANIM = 350;

interface TipEntry { name?: string | number; value?: number | string; color?: string }

export function EuroTooltip({ active, payload, label, title, footer }: {
  active?: boolean; payload?: TipEntry[]; label?: string | number; title: (label: string | number) => string; footer?: (label: string | number) => ReactNode;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-lg">
      <div className="mb-1 font-semibold">{title(label)}</div>
      {payload.map((p) => (
        <div key={String(p.name)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
          <span className="num font-medium">{euro(Number(p.value))}</span>
        </div>
      ))}
      {footer?.(label)}
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

const yearTick = (n: number) => `${n}`;

export function BalanceChart({ result, principal }: { result: LoanResult; principal: number }) {
  const data = useMemo(() => [{ jahr: 0, Restschuld: principal }, ...result.years.map((y) => ({ jahr: y.year, Restschuld: y.balance }))], [result, principal]);
  return (
    <Card title={<>Restschuld im Zeitverlauf<InfoTip term="Restschuld" /></>}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="restFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--rest)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--rest)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {GRID}
            <XAxis dataKey="jahr" type="number" domain={[0, 'dataMax']} tickFormatter={yearTick} {...AXIS} tickCount={8} />
            <YAxis tickFormatter={compactEuro} width={54} {...AXIS} axisLine={false} />
            <Tooltip content={<EuroTooltip title={(l) => (l === 0 ? 'Kreditbeginn' : `Ende Jahr ${l}`)} />} />
            <Area type="monotone" dataKey="Restschuld" stroke="var(--rest)" strokeWidth={2.5} fill="url(#restFill)" animationDuration={ANIM} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-[12px] text-muted">Kreditjahr</p>
    </Card>
  );
}

export function SplitChart({ result }: { result: LoanResult }) {
  const [view, setView] = useState<'jahr' | 'monat'>('jahr');
  const data = useMemo(
    () => view === 'jahr'
      ? result.years.map((y) => ({ x: y.year, Zinsen: y.interest, Tilgung: Math.round((y.principal + y.extra) * 100) / 100 }))
      : result.rows.map((r) => ({ x: r.month, Zinsen: r.interest, Tilgung: Math.round((r.principal + r.extra) * 100) / 100 })),
    [result, view],
  );
  return (
    <Card title="Zinsen und Tilgung" action={<Segmented label="Zeitraum" size="sm" value={view} onChange={setView} options={[{ value: 'jahr', label: 'Pro Jahr' }, { value: 'monat', label: 'Pro Monat' }]} />}>
      <Legend items={[{ color: 'var(--zins)', label: 'Zinsen' }, { color: 'var(--tilgung)', label: 'Tilgung (inkl. Sondertilgung)' }]} />
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={view === 'jahr' ? '18%' : 0}>
            {GRID}
            <XAxis dataKey="x" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tickFormatter={compactEuro} width={54} {...AXIS} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={<EuroTooltip title={(l) => (view === 'jahr' ? `Jahr ${l}` : `Monat ${l} (Jahr ${Math.ceil(Number(l) / 12)})`)} />} />
            <Bar dataKey="Tilgung" stackId="a" fill="var(--tilgung)" animationDuration={ANIM} />
            <Bar dataKey="Zinsen" stackId="a" fill="var(--zins)" radius={view === 'jahr' ? [3, 3, 0, 0] : 0} animationDuration={ANIM} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-[12px] text-muted">{view === 'jahr' ? 'Kreditjahr' : 'Kreditmonat'} · Am Anfang zahlst du vor allem Zinsen, später vor allem Tilgung.</p>
    </Card>
  );
}

export function PaymentChart({ result, fixMonths, variable }: { result: LoanResult; fixMonths: number; variable: boolean }) {
  const data = useMemo(() => {
    const rows = result.rows;
    // Die letzte Rate ist nur eine Ausgleichszahlung und würde die Kurve verzerren.
    const visible = rows.length > 1 && rows[rows.length - 1].payment < rows[rows.length - 2].payment ? rows.slice(0, -1) : rows;
    return visible.map((r) => ({ monat: r.month, Monatsrate: r.payment, zins: r.rate }));
  }, [result]);
  const showFixEnd = variable && fixMonths < result.rows.length;
  const max = Math.max(...data.map((d) => d.Monatsrate), 1);
  return (
    <Card title={variable ? 'Monatsrate bei variablem Zins' : 'Monatsrate im Zeitverlauf'} action={variable ? <Badge>Prognose</Badge> : undefined}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
            {GRID}
            <XAxis dataKey="monat" type="number" domain={[1, 'dataMax']} ticks={ticksEvery5Years(data.length)} tickFormatter={(m: number) => `${Math.round(m / 12)}`} {...AXIS} />
            <YAxis tickFormatter={(v: number) => `${Math.round(v)} €`} width={58} domain={[0, Math.ceil((max * 1.15) / 50) * 50]} {...AXIS} axisLine={false} />
            <Tooltip content={<EuroTooltip title={(l) => `Monat ${l} · Jahr ${Math.ceil(Number(l) / 12)}`}
              footer={(l) => <div className="num mt-1 text-muted">Zinssatz {percent(data[Number(l) - 1]?.zins ?? 0, 3)}</div>} />} />
            {showFixEnd && (
              <ReferenceLine x={fixMonths + 0.5} stroke="var(--muted)" strokeDasharray="4 4"
                label={{ value: 'Ende Fixzins', position: 'top', fill: 'var(--muted)', fontSize: 12 }} />
            )}
            <Line type="stepAfter" dataKey="Monatsrate" stroke="var(--accent)" strokeWidth={2.5} dot={false} animationDuration={ANIM} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-[12px] text-muted">Kreditjahr{variable ? ' · Werte nach der Fixzinsperiode beruhen auf deinen Zinsannahmen.' : ''}</p>
    </Card>
  );
}

function ticksEvery5Years(months: number): number[] {
  const years = Math.ceil(months / 12);
  const step = years <= 10 ? 1 : years <= 20 ? 2 : 5;
  const out: number[] = [];
  for (let y = step; y <= years; y += step) out.push(y * 12);
  return out;
}

export function CostChart({ principal, interest }: { principal: number; interest: number }) {
  const data = [
    { name: 'Kreditbetrag', value: principal, color: 'var(--tilgung)' },
    { name: 'Zinskosten', value: interest, color: 'var(--zins)' },
  ];
  const total = principal + interest;
  return (
    <Card title="Gesamtkosten">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <div className="relative h-52 w-52 max-w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" startAngle={90} endAngle={-270} paddingAngle={interest > 0 ? 2 : 0} stroke="none" animationDuration={ANIM}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip content={<EuroTooltip title={() => 'Gesamtrückzahlung'} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[12px] text-muted">Gesamt</span>
            <span className="num font-display text-lg font-bold">{compactEuro(total)}</span>
          </div>
        </div>
        <dl className="flex min-w-0 flex-col gap-3">
          {data.map((d) => (
            <div key={d.name}>
              <dt className="flex items-center gap-1.5 text-[13px] text-muted"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />{d.name}</dt>
              <dd className="num font-display text-lg font-bold">{euro(d.value)}</dd>
              <dd className="num text-[13px] text-muted">{percent(total > 0 ? (d.value / total) * 100 : 0, 1)} der Rückzahlung</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}
