import { useState } from 'react';
import type { Analysis } from '../lib/analysis';
import { euro, percent } from '../lib/format';
import {
  COST_CATEGORIES, KLEINUNTERNEHMER_GRENZE, MINDESTRUECKLAGE_PRO_M2, monthlyEquivalent, type CostInterval, type CostItem, type RentComponent, type TaxMode,
} from '../lib/invest';
import { SCENARIOS, type AppState, type InvestState, type ScenarioName } from '../lib/state';
import type { Patch } from './Settings';
import { Badge, Button, Card, InfoTip, NumberBox, Row, Segmented, Select, SliderField, Toggle } from './ui';

type SetInv = (p: Partial<InvestState>) => void;
const useSetInv = (s: AppState, patch: Patch): SetInv => (p) => patch({ invest: { ...s.invest, ...p } });

// ---------- Mieteinnahmen ----------
export function RentPanel({ s, patch, advanced, a }: { s: AppState; patch: Patch; advanced: boolean; a: Analysis }) {
  const inv = s.invest;
  const setInv = useSetInv(s, patch);
  const comps = inv.rent.components;
  const setComp = (key: string, p: Partial<RentComponent>) => setInv({ rent: { ...inv.rent, components: comps.map((c) => (c.key === key ? { ...c, ...p } : c)) } });
  const b = a.rent;
  const get = (key: string) => comps.find((c) => c.key === key)!;
  const overLimit = b.annualTurnover > KLEINUNTERNEHMER_GRENZE;

  return (
    <Card title="Mieteinnahmen">
      <div className="flex flex-col gap-4">
        <SliderField id="miete-hmz" label={<>Hauptmietzins (Nettomiete)<InfoTip term="Hauptmietzins" text="Die reine Miete ohne Betriebskosten und Umsatzsteuer. Nur dieser Teil ist dein Ertrag." /></>}
          value={get('hmz').amount} min={0} max={5000} step={10} unit="€" onChange={(v) => setComp('hmz', { amount: v })}
          hint={inv.livingArea > 0 ? `${euro(get('hmz').amount / inv.livingArea)} pro m²` : undefined} />
        <SliderField id="miete-bk" label={<>Betriebskosten<InfoTip term="Betriebskosten" text="Zahlt der Mieter zusätzlich. Du gibst sie an Hausverwaltung und Gemeinde weiter, sie sind kein Ertrag." /></>}
          value={get('bk').amount} min={0} max={1000} step={5} unit="€" onChange={(v) => setComp('bk', { amount: v })} />

        {!advanced && comps.filter((c) => !['hmz', 'bk'].includes(c.key) && !c.passThrough && c.amount > 0).map((c) => (
          <SliderField key={c.key} id={`miete-${c.key}`} label={c.label} value={c.amount} min={0} max={1000} step={5} unit="€" onChange={(v) => setComp(c.key, { amount: v })} />
        ))}

        {advanced && (
          <div className="rounded-xl bg-bg p-3">
            <p className="mb-2 text-sm font-semibold">Weitere Mietbestandteile und Umsatzsteuer</p>
            <ul className="flex flex-col divide-y divide-line">
              {comps.map((c) => (
                <li key={c.key} className="flex flex-col gap-1.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={`mb-${c.key}`} className="min-w-0 text-sm">{c.label}</label>
                    <NumberBox id={`mb-${c.key}`} width="w-28" value={c.amount} min={0} max={10000} decimals={2} unit="€" onChange={(v) => setComp(c.key, { amount: v })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                    <span className="flex items-center gap-1">USt
                      <Select id={`mb-ust-${c.key}`} label={`Umsatzsteuersatz ${c.label}`} value={c.vat} disabled={inv.rent.kleinunternehmer}
                        onChange={(v) => setComp(c.key, { vat: v })} options={[0, 10, 13, 20].map((r) => ({ value: r, label: `${r} %` }))} />
                    </span>
                    <label className="flex items-center gap-1.5">
                      <input id={`mb-brutto-${c.key}`} type="checkbox" checked={c.inBrutto} onChange={(e) => setComp(c.key, { inBrutto: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                      im Bruttomietzins
                    </label>
                    {['sonstige', 'moebel', 'stellplatz'].includes(c.key) ? (
                      <label className="flex items-center gap-1.5">
                        <input id={`mb-durchlauf-${c.key}`} type="checkbox" checked={c.passThrough} onChange={(e) => setComp(c.key, { passThrough: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                        durchlaufend
                      </label>
                    ) : (
                      <span>{c.passThrough ? 'durchlaufend' : 'Ertrag'}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Toggle id="kleinunternehmer" checked={inv.rent.kleinunternehmer} onChange={(v) => setInv({ rent: { ...inv.rent, kleinunternehmer: v } })}
                label={<>Kleinunternehmer (keine Umsatzsteuer)<InfoTip term="Kleinunternehmerregelung" text="Bis 55.000 € Jahresumsatz ist die Vermietung von der Umsatzsteuer befreit, dafür gibt es keinen Vorsteuerabzug. Mit Regelbesteuerung gelten 10 % auf Wohnungsmiete und Betriebskosten, 20 % auf Heizung, Stellplatz und Möbel." /></>} />
              {inv.rent.kleinunternehmer && overLimit && (
                <p role="alert" className="mt-2 text-[13px] text-bad">Der Jahresumsatz von {euro(b.annualTurnover)} liegt über der Grenze von 55.000 €. Die Befreiung gilt dann voraussichtlich nicht.</p>
              )}
              {!inv.rent.kleinunternehmer && <p className="mt-2 text-[13px] text-muted">Die Umsatzsteuer geht an das Finanzamt und ist kein Ertrag. Ein Vorsteuerabzug wird hier nicht berechnet.</p>}
            </div>
          </div>
        )}

        {!advanced && (
          <SliderField id="leerstand-einfach" label={<>Leerstand pro Jahr<InfoTip term="Leerstand" text="Zeit ohne Mieter, zum Beispiel bei einem Mieterwechsel. In dieser Zeit fehlt die Miete und du zahlst die Betriebskosten selbst." /></>}
            value={inv.vacancyMonths} min={0} max={6} step={0.1} decimals={1} unit="Monate" onChange={(v) => setInv({ vacancyMonths: v, scenario: 'individuell' })} />
        )}

        <div className="rounded-xl border border-line p-3">
          <Row label="Hauptmietzins" value={euro(b.hmz)} />
          <Row label="Betriebskosten" value={euro(b.bk)} tone="muted" />
          {b.vatTotal > 0 && <Row label="Umsatzsteuer" value={euro(b.vatTotal)} tone="muted" />}
          <Row label="Bruttomietzins laut Vertrag" value={euro(b.bruttomietzins)} strong />
          {b.additional > 0 && <Row label="Zusätzlich verrechnet" value={euro(b.additional)} tone="muted" sub="z. B. Heizung, nicht im Bruttomietzins" />}
          <Row label="Der Mieter zahlt insgesamt" value={euro(b.tenantTotal)} />
          <Row label="Davon dein Ertrag (Nettokaltmiete)" value={euro(b.income)} strong tone="good" sub="ohne durchlaufende Kosten und Umsatzsteuer" />
        </div>
      </div>
    </Card>
  );
}

// ---------- Laufende und einmalige Kosten ----------
const INTERVALS: { value: CostInterval; label: string; short: string }[] = [
  { value: 'monatlich', label: 'Monatlich', short: 'pro Monat' },
  { value: 'quartal', label: 'Quartalsweise', short: 'pro Quartal' },
  { value: 'jaehrlich', label: 'Jährlich', short: 'pro Jahr' },
  { value: 'einmalig', label: 'Einmalig', short: 'einmalig' },
];
const TAX_MODES: { value: TaxMode; label: string }[] = [
  { value: 'sofort', label: 'Sofort abzugsfähig' },
  { value: 'verteilt15', label: 'Auf 15 Jahre verteilt (Instandsetzung)' },
  { value: 'verteilt10', label: 'Auf 10 Jahre verteilt (z. B. Möbel)' },
  { value: 'nicht', label: 'Nicht abzugsfähig' },
];
const EXAMPLES: [string, string][] = [
  ['Hausverwaltung', 'Verwaltung'], ['Reparaturen', 'Reparatur'], ['Instandhaltung', 'Instandhaltung'], ['Rücklage', 'Rücklage'], ['Versicherung', 'Versicherung'],
  ['Grundsteuer', 'Steuern & Abgaben'], ['Kontoführungsgebühren', 'Finanzierung'], ['Steuerberatung', 'Verwaltung'], ['Internet', 'Energie & Medien'], ['Strom', 'Energie & Medien'],
  ['Möblierung', 'Ausstattung'], ['Renovierung', 'Instandhaltung'], ['Sonderumlage', 'Rücklage'], ['Leerstandskosten', 'Leerstand'], ['Sonstige Kosten', 'Sonstiges'],
];

function CostEditor({ c, set }: { c: CostItem; set: (p: Partial<CostItem>) => void }) {
  const id = `kosten-${c.id}`;
  const field = 'flex flex-col gap-1 text-[13px] text-muted';
  return (
    <div className="mt-2 grid grid-cols-1 gap-3 rounded-xl bg-surface p-3 sm:grid-cols-2">
      <label className={`${field} sm:col-span-2`} htmlFor={`${id}-name`}>Name
        <input id={`${id}-name`} list="kosten-beispiele" value={c.name} maxLength={50}
          onChange={(e) => {
            const ex = EXAMPLES.find(([n]) => n === e.target.value);
            set(ex ? { name: ex[0], category: ex[1] } : { name: e.target.value });
          }}
          className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent" />
      </label>
      <div className={field}><label htmlFor={`${id}-betrag`}>Betrag</label>
        <NumberBox id={`${id}-betrag`} width="w-full" value={c.amount} min={0} max={500000} decimals={2} unit="€" onChange={(v) => set({ amount: v })} />
      </div>
      <div className={field}><label htmlFor={`${id}-intervall`}>Rhythmus</label>
        <Select id={`${id}-intervall`} value={c.interval} onChange={(v) => set({ interval: v })} options={INTERVALS.map((i) => ({ value: i.value, label: i.label }))} />
      </div>
      <div className={field}><label htmlFor={`${id}-kategorie`}>Kategorie</label>
        <Select id={`${id}-kategorie`} value={c.category} onChange={(v) => set({ category: v })} options={COST_CATEGORIES.map((k) => ({ value: k as string, label: k }))} />
      </div>
      <div className={field}><label htmlFor={`${id}-traeger`}>Wer zahlt?</label>
        <Select id={`${id}-traeger`} value={c.payer} onChange={(v) => set({ payer: v, umlagefaehig: v === 'mieter' ? true : c.umlagefaehig })}
          options={[{ value: 'vermieter', label: 'Vermieter' }, { value: 'mieter', label: 'Mieter' }]} />
      </div>
      <label className={field} htmlFor={`${id}-start`}>{c.interval === 'einmalig' ? 'Fällig im Monat (optional)' : 'Start (optional)'}
        <input id={`${id}-start`} type="month" value={c.start ?? ''} onChange={(e) => set({ start: e.target.value || undefined })} className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg" />
      </label>
      {c.interval !== 'einmalig' && (
        <label className={field} htmlFor={`${id}-ende`}>Ende (optional)
          <input id={`${id}-ende`} type="month" value={c.end ?? ''} onChange={(e) => set({ end: e.target.value || undefined })} className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg" />
        </label>
      )}
      <div className={`${field} sm:col-span-2`}><label htmlFor={`${id}-steuer`}>Steuerliche Behandlung</label>
        <Select id={`${id}-steuer`} value={c.taxMode} onChange={(v) => set({ taxMode: v })} options={TAX_MODES} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input id={`${id}-umlage`} type="checkbox" checked={c.umlagefaehig} onChange={(e) => set({ umlagefaehig: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
        Umlagefähig (darf dem Mieter verrechnet werden)
      </label>
      {c.payer === 'vermieter' && c.umlagefaehig && <p className="text-[13px] text-muted sm:col-span-2">Umlagefähig, aber vom Vermieter getragen: Der Betrag mindert deinen Cashflow.</p>}
      {c.payer === 'mieter' && <p className="text-[13px] text-muted sm:col-span-2">Vom Mieter getragen: mindert deinen Cashflow nur während eines Leerstands.</p>}
      {c.interval === 'einmalig' && <p className="text-[13px] text-muted sm:col-span-2">Ohne Monat zählt der Betrag zu den Anfangskosten beim Kauf. Mit Monat wird er nur in diesem Monat abgezogen.</p>}
    </div>
  );
}

export function CostsPanel({ s, patch, advanced, a }: { s: AppState; patch: Patch; advanced: boolean; a: Analysis }) {
  const inv = s.invest;
  const setInv = useSetInv(s, patch);
  const [editing, setEditing] = useState<string | null>(null);
  const costs = inv.costs;
  const setCost = (id: string, p: Partial<CostItem>) => setInv({ costs: costs.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const newId = () => `k${Date.now().toString(36)}${Math.round(Math.random() * 999)}`;
  const visible = advanced ? costs : costs.filter((c) => c.interval !== 'einmalig' && !c.start && !c.end && c.payer === 'vermieter');
  const minReserve = inv.livingArea * MINDESTRUECKLAGE_PRO_M2;
  const short = (c: CostItem) => INTERVALS.find((i) => i.value === c.interval)!.short;

  return (
    <Card title={advanced ? 'Laufende und einmalige Kosten' : 'Deine laufenden Kosten'}>
      <datalist id="kosten-beispiele">{EXAMPLES.map(([n]) => <option key={n} value={n} />)}</datalist>
      {visible.length === 0 && <p className="text-[13px] text-muted">Noch keine Kosten erfasst.</p>}
      <ul className="flex flex-col divide-y divide-line">
        {visible.map((c) => (
          <li key={c.id} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <label htmlFor={`kz-${c.id}`} className="block truncate text-sm font-medium">{c.name || 'Ohne Namen'}</label>
                {advanced && (
                  <span className="text-[12px] text-muted">
                    {c.category} · {c.payer === 'mieter' ? 'Mieter zahlt' : 'Vermieter zahlt'}{c.umlagefaehig ? ' · umlagefähig' : ''}
                    {c.interval !== 'einmalig' && c.interval !== 'monatlich' ? ` · = ${euro(monthlyEquivalent(c))} pro Monat` : ''}
                  </span>
                )}
              </div>
              <NumberBox id={`kz-${c.id}`} width="w-28" value={c.amount} min={0} max={500000} decimals={2} unit="€" onChange={(v) => setCost(c.id, { amount: v })} />
              <span className="w-[74px] shrink-0 text-[12px] text-muted">{short(c)}</span>
            </div>
            {advanced && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Button onClick={() => setEditing(editing === c.id ? null : c.id)}>{editing === c.id ? 'Fertig' : 'Bearbeiten'}</Button>
                <Button onClick={() => setInv({ costs: [...costs, { ...c, id: newId(), name: `${c.name} (Kopie)` }] })}>Duplizieren</Button>
                <Button onClick={() => setInv({ costs: costs.filter((x) => x.id !== c.id) })}>Löschen</Button>
              </div>
            )}
            {advanced && editing === c.id && <CostEditor c={c} set={(p) => setCost(c.id, p)} />}
          </li>
        ))}
      </ul>
      {advanced && (
        <div className="mt-3">
          <Button variant="primary" onClick={() => {
            const id = newId();
            setInv({ costs: [...costs, { id, name: 'Neue Kosten', amount: 0, interval: 'monatlich', category: 'Sonstiges', umlagefaehig: false, payer: 'vermieter', taxMode: 'sofort' }] });
            setEditing(id);
          }}>+ Neue Kosten hinzufügen</Button>
        </div>
      )}
      <div className="mt-3 rounded-xl border border-line p-3">
        <Row label="Laufende Vermieterkosten" value={`${euro(a.month.landlordCosts)} pro Monat`} strong />
        {a.fin.initialCosts > 0 && <Row label="Einmalige Anfangskosten" value={euro(a.fin.initialCosts)} tone="muted" sub="in der Gesamtinvestition enthalten" />}
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Gesetzliche Mindestrücklage im Wohnungseigentum seit 1.1.2026: {euro(MINDESTRUECKLAGE_PRO_M2)} pro m² und Monat, bei {inv.livingArea} m² also {euro(minReserve)}.
      </p>
    </Card>
  );
}

// ---------- Szenario: Mietanpassung, Leerstand, Wertentwicklung ----------
export function RiskPanel({ s, patch }: { s: AppState; patch: Patch }) {
  const inv = s.invest;
  const setInv = useSetInv(s, patch);
  const custom = (p: Partial<InvestState>) => setInv({ ...p, scenario: 'individuell' });
  const adjustments = [...inv.rentAdjustments].sort((x, y) => x.year - y.year);
  const hmz = inv.rent.components.find((c) => c.key === 'hmz')!.amount;
  return (
    <Card title="Szenario: Miete, Leerstand, Wert" collapsible defaultOpen={false} summary={<Badge>{inv.scenario}</Badge>}>
      <div className="flex flex-col gap-4">
        <Segmented<ScenarioName> label="Szenario" size="sm" value={inv.scenario}
          onChange={(v) => setInv(v === 'individuell' ? { scenario: v } : { scenario: v, ...SCENARIOS[v] })}
          options={[{ value: 'optimistisch', label: 'Optimistisch' }, { value: 'realistisch', label: 'Realistisch' }, { value: 'pessimistisch', label: 'Pessimistisch' }, { value: 'individuell', label: 'Individuell' }]} />
        <SliderField id="mietsteigerung" label="Mietsteigerung pro Jahr" value={inv.rentGrowth} min={0} max={8} step={0.1} decimals={1} unit="%" onChange={(v) => custom({ rentGrowth: v })}
          hint="Annahme. Ob eine Erhöhung zulässig ist, hängt von Vertrag und Mietrecht ab. Seit 2026 zählt Inflation über 3 % nur zur Hälfte." />
        <SliderField id="leerstand" label="Leerstand pro Jahr" value={inv.vacancyMonths} min={0} max={12} step={0.1} decimals={1} unit="Monate" onChange={(v) => custom({ vacancyMonths: v })}
          hint={`Leerstandsquote ${percent((inv.vacancyMonths / 12) * 100, 1)}`} />
        <SliderField id="mietausfall" label="Mietausfall" value={inv.rentLoss} min={0} max={20} step={0.5} decimals={1} unit="%" onChange={(v) => custom({ rentLoss: v })} hint="Anteil der Miete, der nicht bezahlt wird." />
        <SliderField id="mietfrei" label="Mietfreie Monate zu Beginn" value={inv.freeMonths} min={0} max={12} step={1} unit="Monate" onChange={(v) => setInv({ freeMonths: v })} />
        <SliderField id="mieterwechsel" label="Mieterwechsel alle" value={inv.tenantChangeYears} min={0} max={15} step={1} unit="Jahre" onChange={(v) => custom({ tenantChangeYears: v })}
          hint={inv.tenantChangeYears === 0 ? 'Kein Mieterwechsel eingerechnet.' : undefined} />
        {inv.tenantChangeYears > 0 && (
          <>
            <SliderField id="wechselkosten" label="Kosten je Mieterwechsel" value={inv.tenantChangeCost} min={0} max={10000} step={100} unit="€" onChange={(v) => setInv({ tenantChangeCost: v })} hint="Zum Beispiel Ausmalen und kleine Reparaturen." />
            <SliderField id="neuvermietung-makler" label="Makler bei Neuvermietung" value={inv.reletBrokerMonths} min={0} max={3} step={0.5} decimals={1} unit="Mieten" onChange={(v) => setInv({ reletBrokerMonths: v })}
              hint="In Bruttomonatsmieten plus 20 % USt. Seit Juli 2023 zahlt, wer den Makler beauftragt, meist der Vermieter." />
          </>
        )}
        <SliderField id="kostensteigerung" label="Kostensteigerung pro Jahr" value={inv.costGrowth} min={0} max={8} step={0.1} decimals={1} unit="%" onChange={(v) => custom({ costGrowth: v })} />
        <SliderField id="wertentwicklung" label="Wertentwicklung pro Jahr" value={inv.valueGrowth} min={-5} max={10} step={0.1} decimals={1} unit="%" onChange={(v) => custom({ valueGrowth: v })}
          hint={inv.valueGrowth < 0 ? 'Szenario mit sinkenden Immobilienpreisen.' : 'Annahme, keine Vorhersage.'} />
        <SliderField id="horizont" label="Prognosezeitraum" value={inv.horizonYears} min={5} max={40} step={1} unit="Jahre" onChange={(v) => setInv({ horizonYears: v })} />

        <div>
          <p className="text-sm font-semibold">Individuelle Mietanpassungen</p>
          <p className="text-[13px] text-muted">Neuer Hauptmietzins ab einem bestimmten Jahr, zum Beispiel nach einer Neuvermietung. Danach gilt wieder die jährliche Steigerung.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {adjustments.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span>ab Jahr</span>
                <NumberBox id={`ma-jahr-${i}`} ariaLabel="Jahr der Mietanpassung" width="w-20" value={r.year} min={2} max={40} unit=""
                  onChange={(v) => { const y = Math.round(v); if (y !== r.year && adjustments.some((x) => x.year === y)) return; setInv({ rentAdjustments: adjustments.map((x) => (x.year === r.year ? { ...x, year: y } : x)) }); }} />
                <NumberBox id={`ma-miete-${i}`} ariaLabel="Neuer Hauptmietzins" width="w-28" value={r.rent} min={0} max={10000} unit="€" onChange={(v) => setInv({ rentAdjustments: adjustments.map((x) => (x.year === r.year ? { ...x, rent: v } : x)) })} />
                <button type="button" aria-label={`Mietanpassung ab Jahr ${r.year} entfernen`} onClick={() => setInv({ rentAdjustments: adjustments.filter((x) => x.year !== r.year) })} className="ml-auto rounded-lg px-2 py-1 text-muted hover:text-bad">✕</button>
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <Button onClick={() => {
              let year = Math.max(2, (adjustments[adjustments.length - 1]?.year ?? 3) + 2);
              while (adjustments.some((x) => x.year === year)) year++;
              if (year <= 40) setInv({ rentAdjustments: [...adjustments, { year, rent: Math.round(hmz * 1.1) }] });
            }}>+ Mietanpassung hinzufügen</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- Steuern ----------
export function TaxPanel({ s, patch }: { s: AppState; patch: Patch }) {
  const inv = s.invest;
  const setInv = useSetInv(s, patch);
  const tax = inv.tax;
  const setTax = (p: Partial<InvestState['tax']>) => setInv({ tax: { ...tax, ...p } });
  return (
    <Card title="Steuern (Vermietung und Verpachtung)" collapsible defaultOpen={false} summary={<Badge>{tax.enabled ? 'aktiv' : 'aus'}</Badge>}>
      <div className="flex flex-col gap-4">
        <Toggle id="steuer-an" checked={tax.enabled} onChange={(v) => setTax({ enabled: v })} label={<span className="font-medium">Steuer schätzen</span>} />
        <p className="rounded-xl bg-bg p-3 text-[13px] text-muted">
          Vereinfachte Schätzung für private Vermietung in Österreich. Abgezogen werden Kreditzinsen, AfA und abzugsfähige Kosten. Die Tilgung ist nie abzugsfähig. Kein Ersatz für eine Steuerberatung.
        </p>
        {tax.enabled && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="grenzsteuersatz" className="text-sm font-medium">Grenzsteuersatz<InfoTip term="Grenzsteuersatz" text="Der Steuersatz auf deinen letzten verdienten Euro. Er hängt von deinem gesamten Einkommen ab." /></label>
              <Select id="grenzsteuersatz" value={tax.marginalRate} onChange={(v) => setTax({ marginalRate: v })} options={[0, 20, 30, 40, 48, 50, 55].map((r) => ({ value: r, label: `${r} %` }))} />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Anteil Grund und Boden<InfoTip term="Grundanteil" text="Grund und Boden nutzt sich nicht ab und wird nicht abgeschrieben. Ohne Gutachten gelten pauschal 40 %, in bestimmten Fällen 30 % oder 20 %." /></span>
                <NumberBox id="grundanteil-zahl" width="w-24" value={tax.landShare} min={0} max={90} decimals={1} unit="%" onChange={(v) => setTax({ landShare: v })} />
              </div>
              <div className="mt-1.5"><Segmented label="Pauschaler Grundanteil" size="sm" value={String(tax.landShare)} onChange={(v) => setTax({ landShare: Number(v) })}
                options={[{ value: '20', label: '20 %' }, { value: '30', label: '30 %' }, { value: '40', label: '40 %' }]} /></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="afa-satz-zahl" className="text-sm font-medium">AfA-Satz Gebäude<InfoTip term="AfA" text="Absetzung für Abnutzung: Der Gebäudeanteil wird über viele Jahre verteilt abgeschrieben, bei Wohngebäuden üblicherweise mit 1,5 % pro Jahr." /></label>
              <NumberBox id="afa-satz-zahl" width="w-24" value={tax.afaRate} min={0} max={5} decimals={2} unit="%" onChange={(v) => setTax({ afaRate: v })} />
            </div>
            {inv.buildYear < 1915 && <p className="-mt-2 text-[13px] text-muted">Für Gebäude, die vor 1915 errichtet wurden, sind bis zu 2 % möglich.</p>}
            <Toggle id="afa-beschleunigt" checked={tax.accelerated} onChange={(v) => setTax({ accelerated: v })} label="Beschleunigte AfA (Jahr 1 dreifach, Jahr 2 doppelt)" />
            <Toggle id="verlustausgleich" checked={tax.offsetLosses} onChange={(v) => setTax({ offsetLosses: v })} label="Verluste mit anderem Einkommen ausgleichen" />
            {inv.renovation > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Renovierung steuerlich</p>
                <Segmented label="Steuerliche Behandlung der Renovierung" size="sm" value={inv.renovationTax} onChange={(v) => setInv({ renovationTax: v })}
                  options={[{ value: 'verteilt15', label: 'Instandsetzung (15 Jahre)' }, { value: 'afa', label: 'Herstellung (AfA)' }]} />
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ---------- Kredit-Kurzinfo im Investment-Bereich ----------
export function LoanSummary({ a, onEdit }: { a: Analysis; onEdit: () => void }) {
  const s = a.s;
  return (
    <Card title="Kredit" action={<Button onClick={onEdit}>Kredit bearbeiten</Button>}>
      <Row label="Kreditbetrag" value={euro(a.fin.loan)} />
      <Row label="Zinssatz" value={a.variable ? `${percent(s.fixRate)} fix für ${s.fixYears} Jahre` : `${percent(s.fixRate)} fix`} />
      <Row label="Laufzeit" value={`${s.termYears} Jahre`} />
      <Row label="Monatsrate" value={euro(a.month.payment)} strong />
      {a.afterFix && <Row label={`Monatsrate ab Jahr ${s.fixYears + 1}`} value={euro(a.afterFix.payment)} sub="Prognose nach deiner Zinsannahme" />}
    </Card>
  );
}
