import { ASSUMPTIONS, LIMITS, SOURCES, SOURCES_DATE } from '../lib/sources';
import { Button } from './ui';

/** Seite „Quellen und Annahmen“: woher die Werte stammen, was Annahme ist und wo die Rechnung endet. */
export function Sources({ onBack }: { onBack: () => void }) {
  return (
    <article className="mx-auto w-full max-w-[820px] rounded-card border border-line bg-surface p-5 text-[15px] sm:p-8">
      <Button onClick={onBack}>← Zurück zur Startseite</Button>
      <h2 className="mt-4 font-display text-[28px] font-bold leading-tight tracking-tight">Quellen und Annahmen</h2>
      <p className="mt-1 text-[13px] text-muted">Stand: {SOURCES_DATE}</p>
      <p className="mt-3 leading-relaxed">
        Hier steht, woher die Regeln und Sätze in Kredit Pilot stammen. „Geprüft“ heißt: am angegebenen Stand auf der verlinkten Seite nachgelesen.
        „Fachwissen“ heißt: ein allgemein bekannter Wert, der nicht eigens nachgeschlagen wurde. Prüfe solche Werte selbst, bevor du dich darauf verlässt.
      </p>

      <h3 className="mt-6 font-display text-lg font-bold">Quellen</h3>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {SOURCES.map((s) => (
          <li key={s.topic} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h4 className="font-semibold">{s.topic}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${s.status === 'geprüft' ? 'bg-good text-surface' : 'bg-surface2 text-fg'}`}>{s.status === 'geprüft' ? 'Geprüft' : 'Fachwissen'}</span>
            </div>
            <p className="mt-1 leading-relaxed">{s.used}.</p>
            <p className="mt-1 text-[13px] text-muted">
              Quelle:{' '}
              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">{s.name}</a> : s.name}
            </p>
            {s.note && <p className="mt-1 text-[13px] text-muted">{s.note}</p>}
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-display text-lg font-bold">Eigene Richtwerte und Annahmen</h3>
      <p className="mt-1 text-[13px] text-muted">Diese Werte haben keine amtliche Quelle. Sie sind Startwerte, die du anpassen sollst.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">{ASSUMPTIONS.map((x) => <li key={x}>{x}</li>)}</ul>

      <h3 className="mt-6 font-display text-lg font-bold">Grenzen der Berechnung</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">{LIMITS.map((x) => <li key={x}>{x}</li>)}</ul>

      <h3 className="mt-6 font-display text-lg font-bold">Wie gerechnet wird</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
        <li>Rate (Annuität): Kreditbetrag × i × (1 + i)ⁿ ÷ ((1 + i)ⁿ − 1), mit i = Jahreszins ÷ 12 und n = Anzahl der Monate.</li>
        <li>Zinsen im Monat: Restschuld × Jahreszins ÷ 12. Tilgung: Rate minus Zinsen.</li>
        <li>Cashflow bei Vermietung: Nettokaltmiete minus Leerstand, minus Vermieterkosten, minus Kreditrate.</li>
        <li>Bruttomietrendite: Jahresmiete ÷ Kaufpreis. Nettomietrendite: Jahresmiete nach Kosten ÷ Gesamtinvestition.</li>
        <li>Schuldendienstquote: alle Kreditraten ÷ Nettoeinkommen.</li>
      </ul>
    </article>
  );
}
