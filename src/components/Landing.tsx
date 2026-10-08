import type { Section } from '../lib/state';
import logo from '../logo.png';

export type StartChoice = 'kredit' | 'kauf' | 'vermieten';
type Target = Exclude<Section, 'start'>;

const QUESTIONS: { choice: StartChoice; title: string; text: string }[] = [
  { choice: 'kredit', title: 'Ich möchte einen Kredit berechnen', text: 'Betrag, Zins und Laufzeit eingeben, Monatsrate und Zinsen sehen' },
  { choice: 'kauf', title: 'Ich möchte eine Immobilie kaufen', text: 'Kaufpreis, Eigenkapital und Nebenkosten: was kostet die Finanzierung?' },
  { choice: 'vermieten', title: 'Ich möchte eine vermietete Immobilie analysieren', text: 'Miete, Kosten und Kredit: was bleibt pro Monat übrig?' },
];
const MORE: { section: Target; title: string; advanced: boolean }[] = [
  { section: 'leistbarkeit', title: 'Kann ich mir das leisten?', advanced: false },
  { section: 'immobilien', title: 'Meine Immobilien', advanced: false },
  { section: 'vergleich', title: 'Kreditangebote vergleichen', advanced: true },
  { section: 'umschuldung', title: 'Umschuldung', advanced: true },
  { section: 'tilgen', title: 'Tilgen oder investieren', advanced: true },
];

/** Startseite: Der Besucher wählt, was er vorhat, und landet im passenden Rechner. */
export function Landing({ onChoose, onOpen }: { onChoose: (c: StartChoice) => void; onOpen: (section: Target, advanced: boolean) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-8 py-6 text-center sm:py-12">
      <div className="flex flex-col items-center gap-4">
        <img src={logo} alt="" aria-hidden="true" width={88} height={88} className="h-[88px] w-[88px]" />
        <h2 className="font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">Was hast du vor?</h2>
        <p className="max-w-[46ch] text-base leading-relaxed text-muted">
          Wähle aus, Kredit Pilot rechnet es dir in Sekunden aus. Kostenlos, ohne Anmeldung, für Österreich.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-3">
        {QUESTIONS.map((q, i) => (
          <li key={q.choice}>
            <button type="button" onClick={() => onChoose(q.choice)}
              className={`flex w-full items-center justify-between gap-4 rounded-card px-5 py-4 text-left transition-colors ${
                i === 0 ? 'bg-accent text-accentfg hover:opacity-90' : 'border border-line bg-surface hover:border-accent'
              }`}>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold leading-tight">{q.title}</span>
                <span className={`mt-0.5 block text-sm ${i === 0 ? 'opacity-90' : 'text-muted'}`}>{q.text}</span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-xl">→</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-sm leading-relaxed text-muted">
        Außerdem:{' '}
        {MORE.map((t, i) => (
          <span key={t.section}>
            {i > 0 && ' · '}
            <button type="button" onClick={() => onOpen(t.section, t.advanced)} className="font-medium text-accent underline-offset-2 hover:underline">{t.title}</button>
          </span>
        ))}
      </p>
    </div>
  );
}
