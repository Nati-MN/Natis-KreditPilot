import { duration, euro } from '../lib/format';
import { hasExtras, type ExtraEffect, type ExtraPayments } from '../lib/loan';
import { Card, InfoTip, Segmented, SliderField } from './ui';

export function ExtraPanel({ extra, termYears, effect, onChange }: {
  extra: ExtraPayments; termYears: number; effect: ExtraEffect | null; onChange: (e: ExtraPayments) => void;
}) {
  const set = (p: Partial<ExtraPayments>) => onChange({ ...extra, ...p });
  const active = hasExtras(extra);
  return (
    <Card title={<>Sondertilgungen<InfoTip term="Sondertilgung" /></>}>
      <div className="flex flex-col gap-4">
        <SliderField id="st-einmalig" label="Einmalig" value={extra.oneTimeAmount} min={0} max={100000} step={500} unit="€" onChange={(v) => set({ oneTimeAmount: v })} />
        {extra.oneTimeAmount > 0 && (
          <SliderField id="st-einmalig-jahr" label="Einmalzahlung am Ende von Jahr" value={Math.min(extra.oneTimeYear, termYears)} min={1} max={termYears} step={1} unit="" onChange={(v) => set({ oneTimeYear: v })} />
        )}
        <SliderField id="st-jaehrlich" label="Jährlich" value={extra.yearlyAmount} min={0} max={30000} step={250} unit="€" onChange={(v) => set({ yearlyAmount: v })} hint="Jeweils am Ende jedes Kreditjahres." />
        <SliderField id="st-monatlich" label="Monatlich" value={extra.monthlyAmount} min={0} max={2000} step={10} unit="€" onChange={(v) => set({ monthlyAmount: v })} />
        <div>
          <p className="mb-1.5 text-sm font-medium">Was soll die Sondertilgung bewirken?</p>
          <Segmented label="Wirkung der Sondertilgung" size="sm" value={extra.strategy} onChange={(v) => set({ strategy: v })}
            options={[{ value: 'laufzeit', label: 'Laufzeit verkürzen' }, { value: 'rate', label: 'Monatsrate senken' }]} />
          <p className="mt-1.5 text-[13px] text-muted">
            {extra.strategy === 'laufzeit' ? 'Die Monatsrate bleibt gleich, der Kredit ist früher abbezahlt.' : 'Die Laufzeit bleibt gleich, die Monatsrate sinkt nach jeder Sondertilgung.'}
          </p>
        </div>
        {active && effect ? (
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-bg p-3">
            <div>
              <dt className="text-[13px] text-muted">Zinsersparnis</dt>
              <dd className="num font-display text-lg font-bold text-good">{euro(effect.interestSaved)}</dd>
            </div>
            {extra.strategy === 'laufzeit' ? (
              <div>
                <dt className="text-[13px] text-muted">Früher schuldenfrei um</dt>
                <dd className="num font-display text-lg font-bold">{effect.monthsSaved > 0 ? duration(effect.monthsSaved).replace('Jahren', 'Jahre').replace('Monaten', 'Monate') : '0 Monate'}</dd>
              </div>
            ) : (
              <div>
                <dt className="text-[13px] text-muted">Monatsrate am Ende</dt>
                <dd className="num font-display text-lg font-bold">{euro(effect.paymentWith)}</dd>
                <dd className="num text-[13px] text-muted">statt {euro(effect.paymentWithout)}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="rounded-xl bg-bg p-3 text-[13px] text-muted">Stelle einen Betrag ein und sieh sofort, wie viele Zinsen du sparst.</p>
        )}
      </div>
    </Card>
  );
}
