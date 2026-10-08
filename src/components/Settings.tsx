import { useState } from 'react';
import { euro, percent } from '../lib/format';
import { autoLoanAmount, loanAmount, purchaseCosts, type AppState } from '../lib/state';
import { Badge, Button, Card, InfoTip, NumberBox, Segmented, SliderField, Toggle } from './ui';

type Patch = (p: Partial<AppState>) => void;

export function FinancePanel({ s, patch }: { s: AppState; patch: Patch }) {
  const costs = purchaseCosts(s);
  const auto = autoLoanAmount(s);
  const loan = loanAmount(s);
  return (
    <Card title="Finanzierung">
      <div className="flex flex-col gap-4">
        <SliderField id="kaufpreis" label="Immobilienkaufpreis" value={s.price} min={30000} max={1000000} step={1000} unit="€"
          onChange={(v) => patch({ price: v, equity: Math.min(s.equity, v) })} />
        <SliderField id="eigenkapital" label={<>Eigenkapital<InfoTip term="Eigenkapital" /></>} value={s.equity} min={0} max={s.price} step={1000} unit="€"
          onChange={(v) => patch({ equity: v })} hint={`${percent((s.equity / s.price) * 100, 1)} des Kaufpreises`} />

        <div className="rounded-xl bg-bg p-3">
          <Toggle id="nebenkosten-an" checked={s.costsEnabled} onChange={(v) => patch({ costsEnabled: v })}
            label={<span className="font-medium">Kaufnebenkosten berücksichtigen<InfoTip term="Kaufnebenkosten" /></span>} />
          {s.costsEnabled && (
            <div className="mt-3 flex flex-col gap-3">
              <Segmented label="Eingabe der Nebenkosten" size="sm" value={s.costsMode} onChange={(v) => patch({ costsMode: v })}
                options={[{ value: 'percent', label: 'In Prozent' }, { value: 'euro', label: 'Als Eurobetrag' }]} />
              {s.costsMode === 'percent' ? (
                <SliderField id="nebenkosten-prozent" label="Nebenkosten" value={s.costsPercent} min={0} max={15} step={0.1} decimals={1} unit="%"
                  onChange={(v) => patch({ costsPercent: v })} hint={`= ${euro(costs)} · Richtwert in Österreich: rund 8–12 %`} />
              ) : (
                <SliderField id="nebenkosten-euro" label="Nebenkosten" value={s.costsEuro} min={0} max={150000} step={500} unit="€"
                  onChange={(v) => patch({ costsEuro: v })} hint={`= ${percent((costs / s.price) * 100, 1)} des Kaufpreises`} />
              )}
              <Toggle id="nebenkosten-finanziert" checked={s.costsFinanced} onChange={(v) => patch({ costsFinanced: v })} label="Nebenkosten mitfinanzieren" />
              {!s.costsFinanced && <p className="text-[13px] text-muted">Du zahlst {euro(costs)} zusätzlich zum Eigenkapital aus eigenen Mitteln.</p>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Kreditbetrag</span>
            <span className="num font-display text-xl font-bold">{euro(loan)}</span>
          </div>
          {!s.manualLoan && (
            <p className="num mt-1 text-[13px] text-muted">
              {euro(s.price)}{s.costsEnabled && s.costsFinanced ? ` + ${euro(costs)}` : ''} − {euro(s.equity)}
            </p>
          )}
          <div className="mt-3">
            <Toggle id="kredit-manuell" checked={s.manualLoan} onChange={(v) => patch({ manualLoan: v, manualLoanAmount: v ? Math.max(1000, Math.round(loan)) : s.manualLoanAmount })} label="Kreditbetrag selbst festlegen" />
          </div>
          {s.manualLoan && (
            <div className="mt-3">
              <SliderField id="kreditbetrag" label="Kreditbetrag" value={s.manualLoanAmount} min={1000} max={1200000} step={1000} unit="€"
                onChange={(v) => patch({ manualLoanAmount: v })} hint={`Automatisch berechnet wären ${euro(auto)}.`} />
            </div>
          )}
          {loan <= 0 && <p role="alert" className="mt-2 text-[13px] text-bad">Das Eigenkapital deckt den Kaufpreis. Es ist kein Kredit nötig.</p>}
        </div>

        <SliderField id="laufzeit" label="Kreditlaufzeit" value={s.termYears} min={5} max={40} step={1} unit="Jahre"
          onChange={(v) => patch({ termYears: v, fixYears: Math.min(s.fixYears, v), balanceYear: Math.min(s.balanceYear, v) })} />
      </div>
    </Card>
  );
}

const REFERENCES: { name: string; months: number }[] = [
  { name: '3-Monats-EURIBOR', months: 3 },
  { name: '6-Monats-EURIBOR', months: 6 },
  { name: '12-Monats-EURIBOR', months: 12 },
];

export function LoanModelPanel({ s, patch }: { s: AppState; patch: Patch }) {
  const [newYear, setNewYear] = useState<number | null>(null);
  const firstVarYear = Math.min(s.fixYears, s.termYears) + 1;
  const hasVariablePhase = s.fixYears < s.termYears;
  // Im Referenzzins-Modell beziehen sich Szenariowerte auf den Referenzzins.
  const fromTotal = (total: number) => Math.round((s.useReference ? total - s.margin : total) * 10) / 10;
  const setLevel = (total: number) => (s.useReference ? { referenceRate: Math.max(-1, fromTotal(total)) } : { variableRate: Math.max(0, total) });
  const preset = (kind: 'steigen' | 'sinken' | 'gleich') => {
    const f = s.fixRate;
    const later = Math.min(firstVarYear + 3, s.termYears);
    if (kind === 'gleich') return patch({ ...setLevel(f), rateChanges: [] });
    const [first, second] = kind === 'steigen' ? [f + 1, f + 2] : [Math.max(0, f - 0.7), Math.max(0, f - 1.2)];
    patch({ ...setLevel(first), rateChanges: later > firstVarYear ? [{ year: later, rate: Math.max(s.useReference ? -1 : 0, fromTotal(second)) }] : [] });
  };
  const changes = [...s.rateChanges].sort((a, b) => a.year - b.year);
  const addChange = () => {
    const used = new Set(changes.map((c) => c.year));
    let year = Math.max(firstVarYear + 1, (changes[changes.length - 1]?.year ?? firstVarYear) + 2);
    while (used.has(year) && year < s.termYears) year++;
    if (year > s.termYears || used.has(year)) return;
    const last = changes[changes.length - 1]?.rate ?? (s.useReference ? s.referenceRate : s.variableRate);
    patch({ rateChanges: [...changes, { year, rate: last }] });
    setNewYear(year);
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
                  <p className="mb-1.5 text-[13px] text-muted">Szenario wählen oder Werte frei einstellen:</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button onClick={() => preset('steigen')}>Zinsen steigen</Button>
                    <Button onClick={() => preset('gleich')}>Bleiben gleich</Button>
                    <Button onClick={() => preset('sinken')}>Zinsen sinken</Button>
                  </div>
                </div>

                <Toggle id="referenz-an" checked={s.useReference}
                  onChange={(v) => patch(v
                    ? { useReference: true, referenceRate: Math.round((s.variableRate - s.margin) * 10) / 10, rateChanges: s.rateChanges.map((c) => ({ ...c, rate: Math.round((c.rate - s.margin) * 10) / 10 })) }
                    : { useReference: false, variableRate: Math.max(0, Math.round((s.referenceRate + s.margin) * 10) / 10), rateChanges: s.rateChanges.map((c) => ({ ...c, rate: Math.max(0, Math.round((c.rate + s.margin) * 10) / 10) })) })}
                  label={<>Als Referenzzins + Bankaufschlag rechnen<InfoTip term="Referenzzins" /></>} />

                {!s.useReference ? (
                  <SliderField id="variabler-zins" label="Variabler Zinssatz" value={s.variableRate} min={0} max={12} step={0.1} decimals={2} unit="%"
                    onChange={(v) => patch({ variableRate: v })} />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="referenz-typ" className="text-sm font-medium">Referenzzinssatz</label>
                      <select id="referenz-typ" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" value={s.referenceName}
                        onChange={(e) => {
                          const r = REFERENCES.find((x) => x.name === e.target.value)!;
                          patch({ referenceName: r.name, adjustMonths: r.months });
                        }}>
                        {REFERENCES.map((r) => <option key={r.name}>{r.name}</option>)}
                      </select>
                    </div>
                    <SliderField id="referenz-wert" label={`Angenommener ${s.referenceName}`} value={s.referenceRate} min={-1} max={10} step={0.1} decimals={2} unit="%"
                      onChange={(v) => patch({ referenceRate: v })} hint="Deine eigene Annahme. KreditPilot zeigt keine aktuellen EURIBOR-Werte an." />
                    <SliderField id="aufschlag" label={<>Bankaufschlag<InfoTip term="Bankaufschlag" /></>} value={s.margin} min={0} max={5} step={0.05} decimals={3} unit="%"
                      onChange={(v) => patch({ margin: v })} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="intervall" className="text-sm font-medium">Zinsanpassung alle</label>
                      <select id="intervall" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" value={s.adjustMonths}
                        onChange={(e) => patch({ adjustMonths: Number(e.target.value) })}>
                        {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m === 1 ? '1 Monat' : `${m} Monate`}</option>)}
                      </select>
                    </div>
                    <p className="num rounded-lg bg-surface px-3 py-2 text-sm">
                      Variabler Zinssatz: {percent(s.referenceRate, 3)} + {percent(s.margin, 3)} = <strong>{percent(Math.max(0, s.referenceRate + s.margin), 3)}</strong>
                    </p>
                  </>
                )}

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
                  <span className="sr-only" aria-live="polite">{newYear ? `Zinsänderung ab Jahr ${newYear} hinzugefügt` : ''}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
