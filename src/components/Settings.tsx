import { dateDe, euro, percent, years } from '../lib/format';
import type { Analysis } from '../lib/analysis';
import { purchaseItemAmount, type PurchaseItem } from '../lib/purchase';
import { autoLoanAmount, financing, type AppState } from '../lib/state';
import { Badge, Button, Card, DateBox, Field, InfoTip, NumberBox, Row, Segmented, Select, SliderField, Toggle } from './ui';

export type Patch = (p: Partial<AppState>) => void;

const PROPERTY_TYPES = ['Eigentumswohnung', 'Vorsorgewohnung', 'Einfamilienhaus', 'Reihenhaus', 'Zinshaus-Anteil', 'Sonstiges'];
const CONDITIONS = ['Neubau / Erstbezug', 'Sehr gut', 'Gut', 'Renovierungsbedürftig', 'Sanierungsbedürftig'];

function PurchaseItemsEditor({ s, patch, loan }: { s: AppState; patch: Patch; loan: number }) {
  const items = s.invest.purchaseItems;
  const set = (id: string, p: Partial<PurchaseItem>) => patch({ invest: { ...s.invest, purchaseItems: items.map((i) => (i.id === id ? { ...i, ...p } : i)) } });
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((i) => (
        <li key={i.id} className={`py-2 ${i.enabled ? '' : 'opacity-55'}`}>
          <div className="flex items-center gap-2">
            <input id={`nk-an-${i.id}`} type="checkbox" checked={i.enabled} onChange={(e) => set(i.id, { enabled: e.target.checked })} className="h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={`${i.name} berücksichtigen`} />
            <label htmlFor={`nk-an-${i.id}`} className="min-w-0 flex-1 text-sm">{i.name}<InfoTip term={i.name} text={i.hint} /></label>
            <span className="num shrink-0 text-sm font-medium">{euro(purchaseItemAmount(i, s.price, loan))}</span>
          </div>
          {i.enabled && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6 text-[13px] text-muted">
              <NumberBox id={`nk-wert-${i.id}`} ariaLabel={`${i.name}: Wert`} width="w-24" value={i.value} min={0} max={i.unit === 'percent' ? 15 : 200000} decimals={i.unit === 'percent' ? 2 : 0}
                unit={i.unit === 'percent' ? '%' : '€'} onChange={(v) => set(i.id, { value: v })} />
              {i.unit === 'percent' && <span>{i.base === 'loan' ? 'vom Kredit' : 'vom Kaufpreis'}</span>}
              {i.vat && <span>+ 20 % USt</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FinancePanel({ s, patch, advanced, invest }: { s: AppState; patch: Patch; advanced: boolean; invest: boolean }) {
  const fin = financing(s);
  const inv = s.invest;
  const setInv = (p: Partial<AppState['invest']>) => patch({ invest: { ...inv, ...p } });
  const perM2 = inv.livingArea > 0 ? s.price / inv.livingArea : 0;
  const extraOwn = fin.ownFundsNeeded - s.equity;
  return (
    <Card title={invest ? 'Immobilie und Kauf' : 'Finanzierung'}>
      <div className="flex flex-col gap-4">
        <SliderField id="kaufpreis" label="Kaufpreis der Immobilie" value={s.price} min={30000} max={1000000} step={1000} unit="€"
          onChange={(v) => patch({ price: v, equity: Math.min(s.equity, v) })} />
        <SliderField id="eigenkapital" label={<>Eigenkapital<InfoTip term="Eigenkapital" /></>} value={s.equity} min={0} max={s.price} step={1000} unit="€"
          onChange={(v) => patch({ equity: v })} hint={`${percent((s.equity / s.price) * 100, 1)} des Kaufpreises`} />

        {invest && (
          <>
            <SliderField id="wohnflaeche" label="Wohnfläche" value={inv.livingArea} min={10} max={300} step={1} unit="m²"
              onChange={(v) => setInv({ livingArea: v })} hint={`Kaufpreis pro m²: ${euro(perM2)}`} />
            {advanced && (
              <div className="grid grid-cols-1 gap-3 rounded-xl bg-bg p-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="preis-m2-zahl" className="text-[13px] text-muted">Kaufpreis pro m²</label>
                  <NumberBox id="preis-m2-zahl" width="w-full" value={Math.round(perM2)} min={100} max={30000} unit="€/m²"
                    onChange={(v) => patch({ price: Math.min(1000000, Math.max(30000, Math.round((v * inv.livingArea) / 1000) * 1000)) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="baujahr-zahl" className="text-[13px] text-muted">Baujahr</label>
                  <NumberBox id="baujahr-zahl" width="w-full" value={inv.buildYear} min={1500} max={2035} unit="" plain onChange={(v) => setInv({ buildYear: Math.round(v) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="immobilienart" className="text-[13px] text-muted">Immobilienart</label>
                  <Select id="immobilienart" value={inv.propertyType} onChange={(v) => setInv({ propertyType: v })} options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="zustand" className="text-[13px] text-muted">Zustand</label>
                  <Select id="zustand" value={inv.condition} onChange={(v) => setInv({ condition: v })} options={CONDITIONS.map((t) => ({ value: t, label: t }))} />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label htmlFor="standort" className="text-[13px] text-muted">Standort</label>
                  <input id="standort" value={inv.location} maxLength={60} onChange={(e) => setInv({ location: e.target.value })} placeholder="z. B. 8020 Graz, Lend"
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent" />
                </div>
              </div>
            )}
          </>
        )}

        <SliderField id="renovierung" label="Geplante Renovierung" value={inv.renovation} min={0} max={200000} step={500} unit="€" onChange={(v) => setInv({ renovation: v })} />
        {advanced && (
          <>
            <SliderField id="einrichtung" label="Einrichtung und Möbel" value={s.furnishing} min={0} max={100000} step={500} unit="€" onChange={(v) => patch({ furnishing: v })} />
            <SliderField id="reserve-kapital" label="Zusätzliche Rücklage" value={s.liquidityReserve} min={0} max={100000} step={500} unit="€" onChange={(v) => patch({ liquidityReserve: v })}
              hint="Geld, das du zur Sicherheit zur Seite legst. Zählt zum Kapitalbedarf, wird aber nicht ausgegeben." />
          </>
        )}

        <div className="rounded-xl bg-bg p-3">
          <Toggle id="nebenkosten-an" checked={s.costsEnabled} onChange={(v) => patch({ costsEnabled: v })}
            label={<span className="font-medium">Kaufnebenkosten berücksichtigen<InfoTip term="Kaufnebenkosten" /></span>} />
          {s.costsEnabled && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">Kaufnebenkosten gesamt</span>
                <span className="num font-display text-lg font-bold">{euro(fin.costs)}</span>
              </div>
              <p className="-mt-2 text-[13px] text-muted">{percent((fin.costs / s.price) * 100, 1)} des Kaufpreises{!advanced && s.costsMode === 'detail' ? ' · österreichische Sätze und Richtwerte, Einzelposten in der erweiterten Ansicht' : ''}</p>
              {advanced && (
                <>
                  <Segmented label="Eingabe der Nebenkosten" size="sm" value={s.costsMode} onChange={(v) => patch({ costsMode: v })}
                    options={[{ value: 'detail', label: 'Einzelposten' }, { value: 'percent', label: 'Pauschal %' }, { value: 'euro', label: 'Pauschal €' }]} />
                  {s.costsMode === 'detail' && (
                    <>
                      <PurchaseItemsEditor s={s} patch={patch} loan={fin.loan} />
                      <p className="text-[13px] text-muted">
                        Stand Oktober 2026. Die befristete Befreiung von Grundbuch- und Pfandrechtsgebühr galt nur für Hauptwohnsitze und ist am 30.6.2026 ausgelaufen. Sie wird hier nicht angewendet.
                      </p>
                    </>
                  )}
                  {s.costsMode === 'percent' && (
                    <SliderField id="nebenkosten-prozent" label="Nebenkosten" value={s.costsPercent} min={0} max={15} step={0.1} decimals={1} unit="%" onChange={(v) => patch({ costsPercent: v })} />
                  )}
                  {s.costsMode === 'euro' && (
                    <SliderField id="nebenkosten-euro" label="Nebenkosten" value={s.costsEuro} min={0} max={150000} step={500} unit="€" onChange={(v) => patch({ costsEuro: v })} />
                  )}
                </>
              )}
            </div>
          )}
          {(s.costsEnabled || inv.renovation > 0 || s.furnishing > 0) && (
            <div className="mt-3">
              <Toggle id="nebenkosten-finanziert" checked={s.costsFinanced} onChange={(v) => patch({ costsFinanced: v })} label="Nebenkosten, Renovierung und Einrichtung mitfinanzieren" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Kreditbetrag</span>
            <span className="num font-display text-xl font-bold">{euro(fin.loan)}</span>
          </div>
          <div className="mt-1">
            <Row label="Gesamtinvestition" value={euro(fin.totalInvestment)} sub="Kaufpreis + Nebenkosten + Renovierung + Einrichtung" />
            {s.liquidityReserve > 0 && <Row label="Gesamter Kapitalbedarf" value={euro(fin.capitalNeed)} sub="inklusive Rücklage" />}
            <Row label="Eigenmittel gesamt" value={euro(fin.ownFundsNeeded)} tone={fin.ownFundsNeeded < 0 ? 'bad' : undefined}
              sub={extraOwn > 0.5 ? `Eigenkapital + ${euro(extraOwn)} für Nebenkosten und Weiteres` : undefined} />
            {advanced && (
              <>
                <Row label={<>Beleihungsquote<InfoTip term="Beleihungsquote" /></>} value={percent(fin.ltv, 1)} tone={fin.ltv > s.rules.maxLtv ? 'bad' : undefined}
                  sub={`Orientierungswert der Aufsicht: höchstens ${s.rules.maxLtv} %`} />
                <Row label="Eigenkapitalquote" value={percent(fin.equityRatio, 1)} sub="Eigenmittel am gesamten Kapitalbedarf" />
              </>
            )}
          </div>
          {advanced && (
            <>
              <div className="mt-2">
                <Toggle id="kredit-manuell" checked={s.manualLoan} onChange={(v) => patch({ manualLoan: v, manualLoanAmount: v ? Math.max(1000, Math.round(fin.loan)) : s.manualLoanAmount })} label="Kreditbetrag selbst festlegen" />
              </div>
              {s.manualLoan && (
                <div className="mt-3">
                  <SliderField id="kreditbetrag" label="Kreditbetrag" value={s.manualLoanAmount} min={1000} max={1200000} step={1000} unit="€"
                    onChange={(v) => patch({ manualLoanAmount: v })} hint={`Automatisch berechnet wären ${euro(autoLoanAmount(s))}.`} />
                </div>
              )}
            </>
          )}
          {fin.loan <= 0 && <p role="alert" className="mt-2 text-[13px] text-good">Das Eigenkapital deckt den Kauf. Es ist kein Kredit nötig.</p>}
          {fin.ownFunds < 0 && <p role="alert" className="mt-2 text-[13px] text-bad">Der Kredit ist höher als die Gesamtinvestition.</p>}
        </div>

        <SliderField id="laufzeit" label={advanced && s.termMode !== 'laufzeit' && s.loanType === 'annuitaet' ? 'Vertragslaufzeit (Rahmen)' : 'Kreditlaufzeit'} value={s.termYears} min={5} max={40} step={1} unit="Jahre"
          onChange={(v) => patch({ termYears: v, fixYears: Math.min(s.fixYears, v), balanceYear: Math.min(s.balanceYear, v) })}
          hint={advanced && s.termMode !== 'laufzeit' && s.loanType === 'annuitaet' ? 'Die tatsächliche Laufzeit ergibt sich aus der Rate (siehe Kreditart und Details).' : undefined} />
      </div>
    </Card>
  );
}

const REFERENCES: { name: string; months: number }[] = [
  { name: '3-Monats-EURIBOR', months: 3 },
  { name: '6-Monats-EURIBOR', months: 6 },
  { name: '12-Monats-EURIBOR', months: 12 },
];

export function LoanModelPanel({ s, patch, advanced }: { s: AppState; patch: Patch; advanced: boolean }) {
  const firstVarYear = Math.min(s.fixYears, s.termYears) + 1;
  const hasVariablePhase = s.fixYears < s.termYears;
  const useRef = advanced && s.useReference;
  // Im Referenzzins-Modell beziehen sich Szenariowerte auf den Referenzzins.
  const fromTotal = (total: number) => Math.round((useRef ? total - s.margin : total) * 10) / 10;
  const setLevel = (total: number) => (useRef ? { referenceRate: Math.max(-1, fromTotal(total)) } : { variableRate: Math.max(0, Math.round(total * 10) / 10) });
  const preset = (kind: 'steigen' | 'sinken' | 'gleich') => {
    const f = s.fixRate;
    const later = Math.min(firstVarYear + 3, s.termYears);
    if (kind === 'gleich') return patch({ ...setLevel(f), ...(advanced ? { rateChanges: [] } : {}) });
    const [first, second] = kind === 'steigen' ? [f + 1, f + 2] : [Math.max(0, f - 0.7), Math.max(0, f - 1.2)];
    patch({ ...setLevel(first), ...(advanced ? { rateChanges: later > firstVarYear ? [{ year: later, rate: Math.max(useRef ? -1 : 0, fromTotal(second)) }] : [] } : {}) });
  };
  const changes = [...s.rateChanges].sort((a, b) => a.year - b.year);
  const addChange = () => {
    const used = new Set(changes.map((c) => c.year));
    let year = Math.max(firstVarYear + 1, (changes[changes.length - 1]?.year ?? firstVarYear) + 2);
    while (used.has(year) && year < s.termYears) year++;
    if (year > s.termYears || used.has(year)) return;
    const last = changes[changes.length - 1]?.rate ?? (s.useReference ? s.referenceRate : s.variableRate);
    patch({ rateChanges: [...changes, { year, rate: last }] });
  };

  return (
    <Card title="Kreditmodell">
      <div className="flex flex-col gap-4">
        <Segmented label="Kreditmodell" value={s.mode} onChange={(v) => patch({ mode: v })}
          options={[{ value: 'fix', label: 'Fixzins gesamte Laufzeit' }, { value: 'variabel', label: 'Fix, danach variabel' }]} />

        <SliderField id="fixzins" label={<>{s.mode === 'fix' ? 'Jährlicher Zinssatz' : 'Fixzins am Anfang'}<InfoTip term="Fixzins" /></>}
          value={s.fixRate} min={0} max={12} step={0.1} decimals={2} unit="%" onChange={(v) => patch({ fixRate: v })}
          hint={s.mode === 'fix' ? 'Bleibt über die gesamte Laufzeit gleich.' : undefined} />

        {s.mode === 'variabel' && (
          <>
            <SliderField id="fixdauer" label="Dauer der Fixzinsperiode" value={s.fixYears} min={1} max={s.termYears} step={1} unit="Jahre"
              onChange={(v) => patch({ fixYears: v })}
              hint={hasVariablePhase ? `Danach ${s.termYears - s.fixYears} Jahre variabel (ab Jahr ${firstVarYear}).` : 'Der Fixzins gilt für die gesamte Laufzeit.'} />

            {hasVariablePhase && (
              <div className="flex flex-col gap-4 rounded-xl bg-bg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Variabler Zins ab Jahr {firstVarYear}<InfoTip term="Variabler Zins" /></span>
                  <Badge>Annahme</Badge>
                </div>
                <div>
                  <p className="mb-1.5 text-[13px] text-muted">Szenario wählen oder Wert frei einstellen:</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button onClick={() => preset('steigen')}>Zinsen steigen</Button>
                    <Button onClick={() => preset('gleich')}>Bleiben gleich</Button>
                    <Button onClick={() => preset('sinken')}>Zinsen sinken</Button>
                  </div>
                </div>

                {advanced && (
                  <Toggle id="referenz-an" checked={s.useReference}
                    onChange={(v) => patch(v
                      ? { useReference: true, referenceRate: Math.round((s.variableRate - s.margin) * 10) / 10, rateChanges: s.rateChanges.map((c) => ({ ...c, rate: Math.round((c.rate - s.margin) * 10) / 10 })) }
                      : { useReference: false, variableRate: Math.max(0, Math.round((s.referenceRate + s.margin) * 10) / 10), rateChanges: s.rateChanges.map((c) => ({ ...c, rate: Math.max(0, Math.round((c.rate + s.margin) * 10) / 10) })) })}
                    label={<>Als Referenzzins + Bankaufschlag rechnen<InfoTip term="Referenzzins" /></>} />
                )}

                {!useRef ? (
                  <SliderField id="variabler-zins" label="Variabler Zinssatz" value={s.variableRate} min={0} max={12} step={0.1} decimals={2} unit="%"
                    onChange={(v) => patch({ variableRate: v })} />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="referenz-typ" className="text-sm font-medium">Referenzzinssatz</label>
                      <Select id="referenz-typ" value={s.referenceName} options={REFERENCES.map((r) => ({ value: r.name, label: r.name }))}
                        onChange={(v) => patch({ referenceName: v, adjustMonths: REFERENCES.find((x) => x.name === v)!.months })} />
                    </div>
                    <SliderField id="referenz-wert" label={`Angenommener ${s.referenceName}`} value={s.referenceRate} min={-1} max={10} step={0.1} decimals={2} unit="%"
                      onChange={(v) => patch({ referenceRate: v })} hint="Deine eigene Annahme. Es werden keine aktuellen EURIBOR-Werte angezeigt." />
                    <SliderField id="aufschlag" label={<>Bankaufschlag<InfoTip term="Bankaufschlag" /></>} value={s.margin} min={0} max={5} step={0.05} decimals={3} unit="%"
                      onChange={(v) => patch({ margin: v })} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="intervall" className="text-sm font-medium">Zinsanpassung alle</label>
                      <Select id="intervall" value={s.adjustMonths} onChange={(v) => patch({ adjustMonths: v })}
                        options={[1, 3, 6, 12].map((m) => ({ value: m, label: m === 1 ? '1 Monat' : `${m} Monate` }))} />
                    </div>
                    <p className="num rounded-lg bg-surface px-3 py-2 text-sm">
                      Variabler Zinssatz: {percent(s.referenceRate, 3)} + {percent(s.margin, 3)} = <strong>{percent(Math.max(0, s.referenceRate + s.margin), 3)}</strong>
                    </p>
                  </>
                )}

                {advanced && (
                  <div className="flex flex-col gap-3">
                    <Toggle id="cap-an" checked={s.rateCapOn} onChange={(v) => patch({ rateCapOn: v })} label={<>Zinsobergrenze (Cap)<InfoTip term="Zinsobergrenze" /></>} />
                    {s.rateCapOn && <SliderField id="cap" label="Höchstens" value={s.rateCap} min={0} max={12} step={0.1} decimals={2} unit="%" onChange={(v) => patch({ rateCap: v })} />}
                    <Toggle id="floor-an" checked={s.rateFloorOn} onChange={(v) => patch({ rateFloorOn: v })} label="Zinsuntergrenze (Floor)" />
                    {s.rateFloorOn && <SliderField id="floor" label="Mindestens" value={s.rateFloor} min={0} max={12} step={0.1} decimals={2} unit="%" onChange={(v) => patch({ rateFloor: v })} />}
                    {s.rateCapOn && s.rateFloorOn && s.rateFloor > s.rateCap && <p role="alert" className="text-[13px] text-bad">Die Untergrenze liegt über der Obergrenze.</p>}
                  </div>
                )}

                {advanced && (
                  <div>
                    <p className="text-sm font-semibold">Spätere Zinsänderungen</p>
                    <p className="text-[13px] text-muted">
                      {s.useReference ? `Neuer Wert des ${s.referenceName}, wirksam zum nächsten Anpassungstermin.` : 'Neuer Zinssatz ab Beginn des gewählten Kreditjahres.'}
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {changes.map((c, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                          <span>ab Jahr</span>
                          <NumberBox id={`aenderung-jahr-${i}`} ariaLabel="Kreditjahr der Zinsänderung" width="w-20" value={c.year} min={firstVarYear} max={s.termYears} unit=""
                            onChange={(v) => {
                              const y = Math.round(v);
                              if (y !== c.year && changes.some((x) => x.year === y)) return;
                              patch({ rateChanges: changes.map((x) => (x.year === c.year ? { ...x, year: y } : x)) });
                            }} />
                          <NumberBox id={`aenderung-zins-${i}`} ariaLabel="Zinssatz ab diesem Jahr" width="w-24" value={c.rate} min={s.useReference ? -1 : 0} max={12} decimals={2} unit="%"
                            onChange={(v) => patch({ rateChanges: changes.map((x) => (x.year === c.year ? { ...x, rate: v } : x)) })} />
                          {s.useReference && <span className="num text-[13px] text-muted">= {percent(Math.max(0, c.rate + s.margin), 3)}</span>}
                          <button type="button" aria-label={`Zinsänderung ab Jahr ${c.year} entfernen`} onClick={() => patch({ rateChanges: changes.filter((x) => x.year !== c.year) })}
                            className="ml-auto rounded-lg px-2 py-1 text-muted hover:text-bad">✕</button>
                        </li>
                      ))}
                    </ul>
                    {changes.some((c) => c.year < firstVarYear) && (
                      <p role="alert" className="mt-1 text-[13px] text-bad">Änderungen innerhalb der Fixzinsperiode werden ignoriert.</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button onClick={addChange} disabled={firstVarYear >= s.termYears}>+ Zinsänderung hinzufügen</Button>
                      {changes.length > 0 && <Button onClick={() => patch({ rateChanges: [] })}>Alle entfernen</Button>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ---------- Kreditart und Vertragsdetails (erweiterte Ansicht) ----------
export function LoanDetailsPanel({ s, patch, a }: { s: AppState; patch: Patch; a: Analysis }) {
  const annuityType = s.loanType === 'annuitaet';
  const r = a.loan;
  const typeLabel = { annuitaet: 'Annuität', raten: 'Ratentilgung', endfaellig: 'Endfällig' }[s.loanType];
  return (
    <Card title="Kreditart und Details" collapsible defaultOpen={false} summary={<Badge>{typeLabel}</Badge>}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Kreditart<InfoTip term={s.loanType === 'raten' ? 'Ratentilgung' : s.loanType === 'endfaellig' ? 'Endfällig' : 'Annuität'} /></p>
          <Segmented label="Kreditart" size="sm" value={s.loanType} onChange={(v) => patch({ loanType: v })}
            options={[{ value: 'annuitaet', label: 'Annuität (gleiche Rate)' }, { value: 'raten', label: 'Ratentilgung' }, { value: 'endfaellig', label: 'Endfällig' }]} />
        </div>

        {annuityType && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Was gibst du vor?</p>
            <Segmented label="Vorgabe" size="sm" value={s.termMode} onChange={(v) => patch({ termMode: v })}
              options={[{ value: 'laufzeit', label: 'Laufzeit' }, { value: 'tilgung', label: 'Anfangstilgung' }, { value: 'rate', label: 'Wunschrate' }]} />
            {s.termMode === 'tilgung' && (
              <div className="mt-3">
                <SliderField id="anfangstilgung" label={<>Anfangstilgung pro Jahr<InfoTip term="Anfangstilgung" /></>} value={s.initialRepayment} min={0.5} max={10} step={0.1} decimals={2} unit="%"
                  onChange={(v) => patch({ initialRepayment: v })} hint={`Rate ${euro(r.firstPayment)}, schuldenfrei nach ${years(r.months)}.`} />
              </div>
            )}
            {s.termMode === 'rate' && (
              <div className="mt-3">
                <SliderField id="wunschrate" label="Wunschrate je Zahlung" value={s.desiredPayment} min={50} max={10000} step={10} unit="€" onChange={(v) => patch({ desiredPayment: v })}
                  hint={r.neverRepaid ? undefined : `Schuldenfrei nach ${years(r.months)}.`} />
              </div>
            )}
            {s.termMode !== 'laufzeit' && r.neverRepaid && (
              <p role="alert" className="mt-2 text-[13px] text-bad">Diese Rate deckt die Zinsen nicht. Der Kredit würde nie zurückgezahlt. Erhöhe die Rate.</p>
            )}
          </div>
        )}

        <SliderField id="tilgungsfrei" label={<>Tilgungsfreie Zeit am Anfang<InfoTip term="Tilgungsfreie Zeit" /></>} value={s.graceMonths} min={0} max={60} step={1} unit="Monate"
          onChange={(v) => patch({ graceMonths: v })} hint={s.graceMonths > 0 && r.paymentAfterGrace !== null ? `Zuerst nur Zinsen (${euro(r.firstPayment)}), danach ${euro(r.paymentAfterGrace)}.` : undefined} />

        <Field label="Zahlungsintervall" htmlFor="intervall-zahlung">
          <Select id="intervall-zahlung" value={s.interval} onChange={(v) => patch({ interval: v })}
            options={[{ value: 1, label: 'Monatlich' }, { value: 3, label: 'Vierteljährlich' }, { value: 6, label: 'Halbjährlich' }, { value: 12, label: 'Jährlich' }]} />
        </Field>
        <Field label="Kreditbeginn (Auszahlung)" htmlFor="kreditbeginn">
          <DateBox id="kreditbeginn" value={s.loanStart} min="2000-01-01" max="2100-12-31" onChange={(v) => v && patch({ loanStart: v })} />
        </Field>
        <Field label="Erste Fälligkeit" htmlFor="erste-faelligkeit" hint={s.firstDue ? undefined : `Automatisch einen Monat nach Kreditbeginn: ${dateDe(r.rows[0]?.date ?? '')}`}>
          <span className="flex items-center gap-1.5">
            <DateBox id="erste-faelligkeit" value={s.firstDue} min={s.loanStart} max="2100-12-31" onChange={(v) => patch({ firstDue: v })} />
            {s.firstDue && <button type="button" aria-label="Erste Fälligkeit zurücksetzen" onClick={() => patch({ firstDue: '' })} className="rounded-lg px-2 py-1 text-muted hover:text-bad">✕</button>}
          </span>
        </Field>
        {s.firstDue && s.firstDue <= s.loanStart && <p role="alert" className="-mt-2 text-[13px] text-bad">Die erste Fälligkeit muss nach dem Kreditbeginn liegen. Es wird automatisch gerechnet.</p>}
        <Field label={<>Zinsmethode<InfoTip term="Zinsmethode" /></>} htmlFor="zinsmethode">
          <Select id="zinsmethode" value={s.dayCount} onChange={(v) => patch({ dayCount: v })}
            options={[{ value: '30/360', label: '30/360 (Standard)' }, { value: 'act/360', label: 'taggenau / 360' }, { value: 'act/365', label: 'taggenau / 365' }]} />
        </Field>
      </div>
    </Card>
  );
}

// ---------- Kreditgebühren und Effektivzins ----------
export function FeesPanel({ s, patch, a }: { s: AppState; patch: Patch; a: Analysis }) {
  const f = s.fees;
  const set = (p: Partial<AppState['fees']>) => patch({ fees: { ...f, ...p } });
  const r = a.loan;
  return (
    <Card title="Gebühren und Effektivzins" collapsible defaultOpen={false} summary={<span className="num">{r.apr === null ? '–' : percent(r.apr, 2)}</span>}>
      <div className="flex flex-col gap-4">
        <SliderField id="kontofuehrung" label="Kontoführung pro Monat" value={f.accountMonthly} min={0} max={50} step={0.5} decimals={2} unit="€" onChange={(v) => set({ accountMonthly: v })} />
        <SliderField id="versicherung-kredit" label="Pflichtversicherung pro Monat" value={f.insuranceMonthly} min={0} max={200} step={1} decimals={2} unit="€" onChange={(v) => set({ insuranceMonthly: v })}
          hint="Nur Versicherungen, die die Bank für den Kredit verlangt." />
        <SliderField id="sonstige-kreditkosten" label="Weitere einmalige Kreditkosten" value={f.otherOneTime} min={0} max={20000} step={50} unit="€" onChange={(v) => set({ otherOneTime: v })} />
        <div className="rounded-xl border border-line p-3">
          <Row label="Einmalige Finanzierungskosten" value={euro(a.loanInput.oneTimeCosts ?? 0)}
            sub={a.fin.financingCosts > 0 ? `davon ${euro(a.fin.financingCosts)} aus den Kaufnebenkosten (Pfandrecht, Bankgebühr, Bewertung)` : 'Bearbeitungs- und Pfandrechtsgebühr stehen bei den Kaufnebenkosten'} />
          <Row label="Auszahlung nach Abzug dieser Kosten" value={euro(a.fin.loan - (a.loanInput.oneTimeCosts ?? 0))} tone="muted" />
          <Row label="Laufende Gebühren gesamt" value={euro(r.totalFees - (a.loanInput.oneTimeCosts ?? 0) - r.prepayFees)} tone="muted" />
          <Row label="Nominalzins" value={percent(s.fixRate, 3)} />
          <Row label={<>Effektiver Jahreszins<InfoTip term="Effektivzins" /></>} value={r.apr === null ? 'nicht berechenbar' : percent(r.apr, 2)} strong />
        </div>
        <p className="text-[13px] text-muted">
          Der Effektivzins wird aus allen Zahlungen nach der EU-Formel berechnet, ohne Sondertilgungen.{a.variable ? ' Bei variablem Zins gilt er nur für deine Zinsannahmen.' : ''} Grundbuchgebühr für den Eigentumserwerb, Notar und Makler zählen nicht dazu.
        </p>
      </div>
    </Card>
  );
}
