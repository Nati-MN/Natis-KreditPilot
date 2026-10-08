import type { Section } from '../lib/state';
import logo from '../logo.png';

type Target = Exclude<Section, 'start'>;

const MAIN: { section: Target; title: string; text: string }[] = [
  { section: 'kredit', title: 'Kreditrechner', text: 'Monatsrate, Zinsen und Restschuld berechnen' },
  { section: 'leistbarkeit', title: 'Kann ich mir das leisten?', text: 'Einkommen und Ausgaben gegen die Kreditrate prüfen' },
  { section: 'invest', title: 'Immobilie vermieten', text: 'Miete, Kosten und Rendite einer Wohnung berechnen' },
];
const MORE: { section: Target; title: string }[] = [
  { section: 'vergleich', title: 'Kreditangebote vergleichen' },
  { section: 'umschuldung', title: 'Umschuldung' },
  { section: 'tilgen', title: 'Tilgen oder investieren' },
];

/** Startseite: ein Satz Erklärung und drei große Knöpfe. */
export function Landing({ onOpen }: { onOpen: (section: Target, advanced: boolean) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-8 py-6 text-center sm:py-12">
      <div className="flex flex-col items-center gap-4">
        <img src={logo} alt="" aria-hidden="true" width={88} height={88} className="h-[88px] w-[88px]" />
        <h2 className="font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">Was kostet mein Kredit?</h2>
        <p className="max-w-[46ch] text-base leading-relaxed text-muted">
          Kredit Pilot rechnet es dir in Sekunden aus. Kostenlos, ohne Anmeldung, für Österreich.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-3">
        {MAIN.map((t, i) => (
          <li key={t.section}>
            <button type="button" onClick={() => onOpen(t.section, false)}
              className={`flex w-full items-center justify-between gap-4 rounded-card px-5 py-4 text-left transition-colors ${
                i === 0 ? 'bg-accent text-accentfg hover:opacity-90' : 'border border-line bg-surface hover:border-accent'
              }`}>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold leading-tight">{t.title}</span>
                <span className={`mt-0.5 block text-sm ${i === 0 ? 'opacity-90' : 'text-muted'}`}>{t.text}</span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-xl">→</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted">
        Weitere Rechner:{' '}
        {MORE.map((t, i) => (
          <span key={t.section}>
            {i > 0 && ' · '}
            <button type="button" onClick={() => onOpen(t.section, true)} className="font-medium text-accent underline-offset-2 hover:underline">{t.title}</button>
          </span>
        ))}
      </p>
    </div>
  );
}
