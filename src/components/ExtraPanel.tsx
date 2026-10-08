import type { Analysis } from '../lib/analysis';
import { euro, years } from '../lib/format';
import { addMonths, hasExtras, type ExtraEffect, type ExtraPayments, type ExtraRule } from '../lib/loan';
import type { AppState } from '../lib/state';
import type { Patch } from './Settings';
import { Button, Card, DateBox, InfoTip, NumberBox, Row, Segmented, Select, SliderField } from './ui';

/** Kreditmonat (1 = erste Rate) ↔ Kalendermonat 'YYYY-MM'. */
const monthToYm = (start: string, m: number) => addMonths(start, m).slice(0, 7);
function ymToMonth(start: string, ym: string): number {
  const a = /^(\d{4})-(\d{2})/.exec(start);
  const b = /^(\d{4})-(\d{2})/.exec(ym);
  if (!a || !b) return 1;
  return Math.max(1, (Number(b[1]) - Number(a[1])) * 12 + Number(b[2]) - Number(a[2]));
}

const INTERVALS = [
  { value: 'einmalig' as const, label: 'Einmalig' },
  { value: 'monatlich' as const, label: 'Monatlich' },
  { value: 'quartal' as const, label: 'Vierteljährlich' },
  { value: 'jaehrlich' as const, label: 'Jährlich' },
];

export function ExtraPanel({ s, patch, effect, a }: { s: AppState; patch: Patch; effect: ExtraEffect | null; a: Analysis }) {
  const extra = s.extra;
  const set = (p: Partial<ExtraPayments>) => patch({ extra: { ...extra, ...p } });
  const rules = s.extraRules;
  const setRule = (id: string, p: Partial<ExtraRule>) => patch({ extraRules: rules.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const newId = () => `st${Date.now().toString(36)}${Math.round(Math.random() * 999)}`;
  const active = hasExtras(extra, rules);
  const maxMonth = s.termYears * 12;
  const minYm = monthToYm(s.loanStart, 1);
  const maxYm = monthToYm(s.loanStart, maxMonth);

  return (
    <Card title={<>Sondertilgungen<InfoTip term="Sondertilgung" /></>}>
      <div className="flex flex-col gap-4">
        <SliderField id="st-einmalig" label="Einmalig" value={extra.oneTimeAmount} min={0} max={100000} step={500} unit="€" onChange={(v) => set({ oneTimeAmount: v })} />
        {extra.oneTimeAmount > 0 && (
          <SliderField id="st-einmalig-jahr" label="Einmalzahlung am Ende von Jahr" value={Math.min(extra.oneTimeYear, s.termYears)} min={1} max={s.termYears} step={1} unit="" onChange={(v) => set({ oneTimeYear: v })} />
        )}
        <SliderField id="st-jaehrlich" label="Jährlich" value={extra.yearlyAmount} min={0} max={30000} step={250} unit="€" onChange={(v) => set({ yearlyAmount: v })} hint="Jeweils am Ende jedes Kreditjahres." />
        <SliderField id="st-monatlich" label="Monatlich" value={extra.monthlyAmount} min={0} max={2000} step={10} unit="€" onChange={(v) => set({ monthlyAmount: v })} />

        <div className="rounded-xl bg-bg p-3">
          <p className="text-sm font-semibold">Weitere Sondertilgungen</p>
          <p className="text-[13px] text-muted">Beliebig viele Zahlungen mit eigenem Betrag, Rhythmus und Zeitraum.</p>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <input id={`st-name-${r.id}`} aria-label="Bezeichnung" value={r.label} maxLength={40} placeholder="z. B. Bonus, Erbschaft"
                    onChange={(e) => setRule(r.id, { label: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
                  <button type="button" aria-label="Sondertilgung duplizieren" title="Duplizieren" onClick={() => patch({ extraRules: [...rules, { ...r, id: newId() }] })} className="rounded-lg px-2 py-1 text-muted hover:text-accent">⧉</button>
                  <button type="button" aria-label="Sondertilgung löschen" title="Löschen" onClick={() => patch({ extraRules: rules.filter((x) => x.id !== r.id) })} className="rounded-lg px-2 py-1 text-muted hover:text-bad">✕</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NumberBox id={`st-betrag-${r.id}`} ariaLabel="Betrag" width="w-28" value={r.amount} min={0} max={r.unit === 'prozent' ? 100 : 5000000} decimals={2} unit={r.unit === 'prozent' ? '%' : '€'} onChange={(v) => setRule(r.id, { amount: v })} />
                  <Select id={`st-einheit-${r.id}`} label="Einheit" value={r.unit} onChange={(v) => setRule(r.id, { unit: v, amount: v === 'prozent' ? Math.min(r.amount, 10) : r.amount })}
                    options={[{ value: 'euro', label: 'Euro' }, { value: 'prozent', label: '% der Restschuld' }]} />
                  <Select id={`st-rhythmus-${r.id}`} label="Rhythmus" value={r.interval} onChange={(v) => setRule(r.id, { interval: v })} options={INTERVALS} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <label htmlFor={`st-ab-${r.id}`}>{r.interval === 'einmalig' ? 'im' : 'ab'}</label>
                  <DateBox month id={`st-ab-${r.id}`} value={monthToYm(s.loanStart, r.from)} min={minYm} max={maxYm} onChange={(v) => v && setRule(r.id, { from: ymToMonth(s.loanStart, v) })} />
                  {r.interval !== 'einmalig' && (
                    <>
                      <label htmlFor={`st-bis-${r.id}`}>bis</label>
                      <DateBox month id={`st-bis-${r.id}`} value={r.to ? monthToYm(s.loanStart, r.to) : ''} min={monthToYm(s.loanStart, r.from)} max={maxYm}
                        onChange={(v) => setRule(r.id, { to: v ? ymToMonth(s.loanStart, v) : null })} />
                      {!r.to && <span>(offen = bis zum Ende)</span>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <Button onClick={() => patch({ extraRules: [...rules, { id: newId(), label: '', interval: 'einmalig', unit: 'euro', amount: 5000, from: 12, to: null }] })}>+ Sondertilgung hinzufügen</Button>
          </div>
        </div>

        <SliderField id="st-grenze" label="Vertragliche Grenze pro Jahr" value={s.extraLimitPercent} min={0} max={100} step={1} unit="%" onChange={(v) => patch({ extraLimitPercent: v })}
          hint={s.extraLimitPercent > 0 ? `Höchstens ${euro((a.fin.loan * s.extraLimitPercent) / 100)} Sondertilgung pro Kreditjahr. Was darüber liegt, wird gekürzt.` : '0 % = keine Grenze. Viele Fixzinsverträge erlauben nur einen Teil des Kredits pro Jahr.'} />
        <SliderField id="st-entschaedigung" label={<>Entschädigung an die Bank<InfoTip term="Entschädigung" /></>} value={s.prepayFeePercent} min={0} max={4} step={0.1} decimals={2} unit="%"
          onChange={(v) => patch({ prepayFeePercent: v })} hint="Wird nur in der Fixzinsphase berechnet, im letzten Jahr zur Hälfte." />
        {s.prepayFeePercent > 0 && (
          <SliderField id="st-freibetrag" label="Davon frei pro Jahr" value={s.prepayFreePerYear} min={0} max={50000} step={500} unit="€" onChange={(v) => patch({ prepayFreePerYear: v })}
            hint="Betrag pro Kreditjahr, für den keine Entschädigung anfällt." />
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium">Was soll die Sondertilgung bewirken?</p>
          <Segmented label="Wirkung der Sondertilgung" size="sm" value={extra.strategy} onChange={(v) => set({ strategy: v })}
            options={[{ value: 'laufzeit', label: 'Laufzeit verkürzen' }, { value: 'rate', label: 'Rate senken' }, { value: 'kombi', label: 'Halb und halb' }]} />
          <p className="mt-1.5 text-[13px] text-muted">
            {extra.strategy === 'laufzeit' ? 'Die Rate bleibt gleich, der Kredit ist früher abbezahlt.'
              : extra.strategy === 'rate' ? 'Die Laufzeit bleibt gleich, die Rate sinkt nach jeder Sondertilgung.'
              : 'Die Rate sinkt nur halb so stark, dafür endet der Kredit etwas früher. Ob das möglich ist, regelt dein Vertrag.'}
          </p>
        </div>

        {active && effect ? (
          <div className="rounded-xl border border-line p-3">
            <Row label="Laufzeit ohne Sondertilgung" value={years(effect.baseMonths)} tone="muted" />
            <Row label="Laufzeit mit Sondertilgung" value={years(a.loan.months)} />
            <Row label="Eingesparte Zeit" value={effect.monthsSaved > 0 ? years(effect.monthsSaved) : '0 Monate'} tone={effect.monthsSaved > 0 ? 'good' : undefined} />
            <Row label="Zinsen ohne Sondertilgung" value={euro(effect.baseInterest)} tone="muted" />
            <Row label="Zinsen mit Sondertilgung" value={euro(a.loan.totalInterest)} />
            <Row label="Zinsersparnis" value={euro(effect.interestSaved)} tone="good" />
            {effect.prepayFees > 0 && <Row label="Entschädigung an die Bank" value={`− ${euro(effect.prepayFees)}`} tone="bad" />}
            <Row label="Nettoersparnis" value={euro(effect.netSaving)} strong tone={effect.netSaving >= 0 ? 'good' : 'bad'} />
            {extra.strategy !== 'laufzeit' && <Row label="Rate am Ende" value={euro(effect.paymentWith)} sub={`statt ${euro(effect.paymentWithout)}`} />}
          </div>
        ) : (
          <p className="rounded-xl bg-bg p-3 text-[13px] text-muted">Stelle einen Betrag ein und sieh sofort, wie viele Zinsen du sparst.</p>
        )}
      </div>
    </Card>
  );
}
