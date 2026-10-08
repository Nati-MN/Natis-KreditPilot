import { useMemo } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Analysis } from '../lib/analysis';
import { compactEuro, euro, percent } from '../lib/format';
import type { Projection } from '../lib/invest';
import { EuroTooltip, Legend } from './Charts';
import { Badge, Card } from './ui';

const AXIS = { stroke: 'var(--line)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false } as const;
const GRID = <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />;
const ANIM = 350;
const M = { top: 8, right: 8, bottom: 0, left: 0 };
const PALETTE = ['var(--tilgung)', 'var(--zins)', 'var(--rest)', 'var(--alt)', 'var(--good)', 'var(--muted)', 'var(--accent)', 'var(--bad)'];
const Foot = ({ children }: { children: string }) => <p className="mt-1 text-center text-[12px] text-muted">{children}</p>;

/** 1 · Monatlicher Cashflow je Jahr */
export function CashflowChart({ p, afterTax }: { p: Projection; afterTax: boolean }) {
  const data = p.years.map((y) => ({ jahr: y.year, Cashflow: Math.round(((afterTax ? y.cashflowAfterTax : y.cashflow) / 12) * 100) / 100 }));
  return (
    <Card title="Monatlicher Cashflow" action={<Badge>{afterTax ? 'nach Steuern' : 'vor Steuern'}</Badge>}>
      <div role="img" aria-label="Balkendiagramm: durchschnittlicher monatlicher Cashflow je Jahr. Die genauen Werte stehen in den Kennzahlen und Tabellen." className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={M}>
            {GRID}
            <XAxis dataKey="jahr" {...AXIS} minTickGap={16} />
            <YAxis tickFormatter={(v: number) => `${Math.round(v)} €`} width={62} {...AXIS} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={<EuroTooltip title={(l) => `Jahr ${l} · Durchschnitt pro Monat`} />} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Bar dataKey="Cashflow" animationDuration={ANIM} radius={[3, 3, 0, 0]}>
              {data.map((d) => <Cell key={d.jahr} fill={d.Cashflow >= 0 ? 'var(--good)' : 'var(--bad)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Foot>Jahr · inklusive Einmalkosten und Mieterwechsel im jeweiligen Jahr</Foot>
    </Card>
  );
}

/** 2 · Einnahmen gegen Ausgaben in einem typischen Monat */
export function IncomeExpenseChart({ a }: { a: Analysis }) {
  const first = a.loan.rows[0];
  const data = [
    { name: 'Einnahmen', Miete: a.month.income },
    { name: 'Ausgaben', Vermieterkosten: a.month.landlordCosts, Leerstandskosten: a.month.vacancyCosts, Zinsen: first?.interest ?? 0, Tilgung: (first?.principal ?? 0) + a.month.extra },
  ];
  return (
    <Card title="Einnahmen gegen Ausgaben">
      <Legend items={[{ color: 'var(--good)', label: 'Miete' }, { color: 'var(--alt)', label: 'Vermieterkosten' }, { color: 'var(--muted)', label: 'Leerstandskosten' }, { color: 'var(--zins)', label: 'Zinsen' }, { color: 'var(--tilgung)', label: 'Tilgung' }]} />
      <div role="img" aria-label="Balkendiagramm: Mieteinnahmen gegen Ausgaben in einem typischen Monat. Die genauen Werte stehen in den Kennzahlen und Tabellen." className="mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={M} barCategoryGap="28%">
            {GRID}
            <XAxis dataKey="name" {...AXIS} />
            <YAxis tickFormatter={(v: number) => `${Math.round(v)} €`} width={62} {...AXIS} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={<EuroTooltip title={(l) => `${l} pro Monat`} />} />
            <Bar dataKey="Miete" stackId="a" fill="var(--good)" animationDuration={ANIM} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Tilgung" stackId="a" fill="var(--tilgung)" animationDuration={ANIM} />
            <Bar dataKey="Zinsen" stackId="a" fill="var(--zins)" animationDuration={ANIM} />
            <Bar dataKey="Leerstandskosten" stackId="a" fill="var(--muted)" animationDuration={ANIM} />
            <Bar dataKey="Vermieterkosten" stackId="a" fill="var(--alt)" animationDuration={ANIM} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Foot>Typischer Monat im ersten Jahr. Die Tilgung ist eine Auszahlung, baut aber dein Vermögen auf.</Foot>
    </Card>
  );
}

/** 5 · Mietrendite im Zeitverlauf */
export function YieldChart({ p }: { p: Projection }) {
  const data = p.years.map((y) => ({ jahr: y.year, brutto: y.grossYield, netto: y.netYield }));
  return (
    <Card title="Mietrendite im Zeitverlauf" action={<Badge>Prognose</Badge>}>
      <Legend items={[{ color: 'var(--accent)', label: 'Brutto auf Kaufpreis' }, { color: 'var(--rest)', label: 'Netto auf Gesamtinvestition' }]} />
      <div role="img" aria-label="Liniendiagramm: Brutto- und Nettomietrendite je Jahr. Die genauen Werte stehen in den Kennzahlen und Tabellen." className="mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={M}>
            {GRID}
            <XAxis dataKey="jahr" {...AXIS} minTickGap={16} />
            <YAxis tickFormatter={(v: number) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`} width={54} {...AXIS} axisLine={false} />
            <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
              <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-lg">
                <div className="mb-1 font-semibold">Jahr {label}</div>
                <div className="num">Brutto {percent(Number(payload[0].value), 2)}</div>
                <div className="num">Netto {percent(Number(payload[1]?.value ?? 0), 2)}</div>
              </div>
            ) : null} />
            <Line type="monotone" dataKey="brutto" stroke="var(--accent)" strokeWidth={2.5} dot={false} animationDuration={ANIM} />
            <Line type="monotone" dataKey="netto" stroke="var(--rest)" strokeWidth={2.5} dot={false} animationDuration={ANIM} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Foot>Jahr · bezogen auf den ursprünglichen Kaufpreis bzw. die Gesamtinvestition</Foot>
    </Card>
  );
}

/** 6 · Immobilienwert gegen Restschuld */
export function ValueChart({ a }: { a: Analysis }) {
  const data = useMemo(() => [
    { jahr: 0, Immobilienwert: a.s.price, Restschuld: a.fin.loan, Eigenkapital: a.s.price - a.fin.loan },
    ...a.projection.years.map((y) => ({ jahr: y.year, Immobilienwert: y.value, Restschuld: y.balance, Eigenkapital: y.equity })),
  ], [a]);
  return (
    <Card title="Immobilienwert gegen Restschuld" action={<Badge>Prognose</Badge>}>
      <Legend items={[{ color: 'var(--accent)', label: 'Immobilienwert' }, { color: 'var(--zins)', label: 'Restschuld' }, { color: 'var(--good)', label: 'Eigenkapital in der Immobilie' }]} />
      <div role="img" aria-label="Liniendiagramm: Immobilienwert, Restschuld und Eigenkapital über die Jahre. Die genauen Werte stehen in den Kennzahlen und Tabellen." className="mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={M}>
            {GRID}
            <XAxis dataKey="jahr" type="number" domain={[0, 'dataMax']} {...AXIS} tickCount={8} />
            <YAxis tickFormatter={compactEuro} width={58} {...AXIS} axisLine={false} />
            <Tooltip content={<EuroTooltip title={(l) => (l === 0 ? 'Kauf' : `Ende Jahr ${l}`)} />} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Area type="monotone" dataKey="Eigenkapital" stroke="var(--good)" fill="var(--good)" fillOpacity={0.14} strokeWidth={1.5} animationDuration={ANIM} />
            <Line type="monotone" dataKey="Immobilienwert" stroke="var(--accent)" strokeWidth={2.5} dot={false} animationDuration={ANIM} />
            <Line type="monotone" dataKey="Restschuld" stroke="var(--zins)" strokeWidth={2.5} dot={false} animationDuration={ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Foot>{`Jahr · Wertentwicklung ${percent(a.s.invest.valueGrowth, 1)} pro Jahr (Annahme)`}</Foot>
    </Card>
  );
}

/** 7 · Fixzins gegen variables Zinsszenario */
export function FixVarChart({ current, fix, variable, labelVar }: { current: Projection; fix: Projection; variable: Projection; labelVar: string }) {
  void current;
  const data = fix.years.map((y, i) => ({ jahr: y.year, 'Fixzins durchgehend': y.monthlyCashflow, [labelVar]: variable.years[i]?.monthlyCashflow ?? 0 }));
  return (
    <Card title="Cashflow: Fixzins gegen variablen Zins" action={<Badge>Annahme</Badge>}>
      <Legend items={[{ color: 'var(--tilgung)', label: 'Fixzins durchgehend' }, { color: 'var(--alt)', label: labelVar }]} />
      <div role="img" aria-label="Liniendiagramm: Cashflow bei durchgehendem Fixzins und bei variablem Zins. Die genauen Werte stehen in den Kennzahlen und Tabellen." className="mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={M}>
            {GRID}
            <XAxis dataKey="jahr" {...AXIS} minTickGap={16} />
            <YAxis tickFormatter={(v: number) => `${Math.round(v)} €`} width={62} {...AXIS} axisLine={false} />
            <Tooltip content={<EuroTooltip title={(l) => `Jahr ${l} · Cashflow pro Monat`} />} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Line type="monotone" dataKey="Fixzins durchgehend" stroke="var(--tilgung)" strokeWidth={2.5} dot={false} animationDuration={ANIM} />
            <Line type="monotone" dataKey={labelVar} stroke="var(--alt)" strokeWidth={2.5} strokeDasharray="6 3" dot={false} animationDuration={ANIM} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Foot>Jahr · vor Steuern, Durchschnitt pro Monat</Foot>
    </Card>
  );
}

/** 8 · Kumulierte Gewinne und Verluste */
export function CumulativeChart({ p, afterTax, ownFunds }: { p: Projection; afterTax: boolean; ownFunds: number }) {
  const data = [{ jahr: 0, 'Kumulierter Cashflow': 0, 'Vermögenszuwachs': 0 }, ...p.years.map((y) => {
    const cum = afterTax ? y.cumCashflowAfterTax : y.cumCashflow;
    return { jahr: y.year, 'Kumulierter Cashflow': cum, 'Vermögenszuwachs': Math.round((y.equity + cum - ownFunds) * 100) / 100 };
  })];
  return (
    <Card title="Kumulierte Gewinne und Verluste" action={<Badge>Prognose</Badge>}>
      <Legend items={[{ color: 'var(--rest)', label: 'Kumulierter Cashflow' }, { color: 'var(--accent)', label: 'Vermögenszuwachs inkl. Immobilie' }]} />
      <div role="img" aria-label="Liniendiagramm: kumulierter Cashflow und Vermögenszuwachs über die Jahre. Die genauen Werte stehen in den Kennzahlen und Tabellen." className="mt-2 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={M}>
            {GRID}
            <XAxis dataKey="jahr" type="number" domain={[0, 'dataMax']} {...AXIS} tickCount={8} />
            <YAxis tickFormatter={compactEuro} width={58} {...AXIS} axisLine={false} />
            <Tooltip content={<EuroTooltip title={(l) => `Ende Jahr ${l}`} />} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Area type="monotone" dataKey="Kumulierter Cashflow" stroke="var(--rest)" fill="var(--rest)" fillOpacity={0.15} strokeWidth={2} animationDuration={ANIM} />
            <Line type="monotone" dataKey="Vermögenszuwachs" stroke="var(--accent)" strokeWidth={2.5} dot={false} animationDuration={ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Foot>Vermögenszuwachs = Eigenkapital in der Immobilie + Cashflow − eingesetzte Eigenmittel, ohne Verkaufskosten und Immobilienertragsteuer</Foot>
    </Card>
  );
}

function Donut({ title, data, center, foot }: { title: string; data: { name: string; value: number }[]; center: [string, string]; foot?: string }) {
  const rows = data.filter((d) => d.value > 0.004);
  const total = rows.reduce((s, d) => s + d.value, 0);
  return (
    <Card title={title}>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <div role="img" aria-label={`Ringdiagramm: ${title}. Die Werte stehen daneben.`} className="relative h-48 w-48 max-w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" startAngle={90} endAngle={-270} paddingAngle={rows.length > 1 ? 2 : 0} stroke="none" animationDuration={ANIM}>
                {rows.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip content={<EuroTooltip title={() => title} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[12px] text-muted">{center[0]}</span>
            <span className="num font-display text-lg font-bold">{center[1]}</span>
          </div>
        </div>
        <dl className="flex min-w-0 flex-col gap-1.5">
          {rows.map((d, i) => (
            <div key={d.name} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="flex min-w-0 items-center gap-1.5 text-muted"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{d.name}</dt>
              <dd className="num shrink-0 font-medium">{euro(d.value)} <span className="text-[12px] font-normal text-muted">{percent(total > 0 ? (d.value / total) * 100 : 0, 0)}</span></dd>
            </div>
          ))}
        </dl>
      </div>
      {foot && <Foot>{foot}</Foot>}
    </Card>
  );
}

/** 9 · Zusammensetzung der Zahlung des Mieters */
export function RentCompositionChart({ a }: { a: Analysis }) {
  const data = [...a.rent.lines.map((l) => ({ name: l.label.replace(' (Nettomiete)', ''), value: l.net })), { name: 'Umsatzsteuer', value: a.rent.vatTotal }];
  return <Donut title="Was der Mieter zahlt" data={data} center={['pro Monat', euro(a.rent.tenantTotal)]} foot={`Bruttomietzins laut Vertrag: ${euro(a.rent.bruttomietzins)} · dein Ertrag: ${euro(a.rent.income)}`} />;
}

/** 10 · Verteilung aller Immobilienkosten über den Prognosezeitraum */
export function CostDistributionChart({ a }: { a: Analysis }) {
  const p = a.projection;
  const data = [
    { name: 'Kaufpreis', value: a.s.price },
    { name: 'Kreditzinsen', value: p.totalInterest },
    { name: 'Kaufnebenkosten', value: a.fin.costs },
    { name: 'Laufende Kosten', value: p.totalLandlordCosts },
    { name: 'Renovierung und Anfangskosten', value: a.fin.renovation + a.fin.initialCosts },
    { name: 'Steuern', value: Math.max(0, p.totalTax) },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  return <Donut title="Verteilung aller Immobilienkosten" data={data} center={[`${p.years.length} Jahre`, compactEuro(total)]} foot="Summe über den Prognosezeitraum, Tilgung ist im Kaufpreis enthalten" />;
}
