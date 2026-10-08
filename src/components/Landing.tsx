import type { Section } from '../lib/state';
import logo from '../logo.png';

interface Tile {
  section: Exclude<Section, 'start'>;
  title: string;
  question: string;
  text: string;
  /** Nur in der erweiterten Ansicht vorhanden. */
  advanced?: boolean;
}

const MAIN: Tile[] = [
  { section: 'kredit', title: 'Kreditrechner', question: 'Was kostet mich der Kredit?', text: 'Monatsrate, Zinsen, Restschuld und Tilgungsplan. Mit Fixzins oder variablem Zins.' },
  { section: 'leistbarkeit', title: 'Leistbarkeit', question: 'Kann ich mir das leisten?', text: 'Einkommen und Ausgaben eintragen und sehen, was nach der Kreditrate übrig bleibt.' },
  { section: 'invest', title: 'Immobilie vermieten', question: 'Rechnet sich die Wohnung?', text: 'Miete, Kosten und Kreditrate ergeben, was dir pro Monat bleibt, und die Rendite.' },
];
const MORE: Tile[] = [
  { section: 'vergleich', title: 'Vergleich', question: 'Welches Angebot ist besser?', text: 'Mehrere Kreditangebote oder Varianten nebeneinander, mit Effektivzins und Gesamtkosten.', advanced: true },
  { section: 'umschuldung', title: 'Umschuldung', question: 'Lohnt sich ein Bankwechsel?', text: 'Alter Kredit gegen neues Angebot, inklusive Wechselkosten und Break-even.', advanced: true },
  { section: 'tilgen', title: 'Tilgen oder investieren', question: 'Wohin mit dem Ersparten?', text: 'Sondertilgung und Geldanlage im direkten Vermögensvergleich.', advanced: true },
];

function Card({ t, primary, onOpen }: { t: Tile; primary?: boolean; onOpen: (t: Tile) => void }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <div>
        <p className="text-[13px] font-medium text-accent">{t.question}</p>
        <h3 className="mt-0.5 font-display text-xl font-bold leading-tight">{t.title}</h3>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-muted">{t.text}</p>
      <button type="button" onClick={() => onOpen(t)}
        className={`self-start rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${primary ? 'bg-accent text-accentfg hover:opacity-90' : 'border border-line text-fg hover:border-accent hover:text-accent'}`}>
        {t.title} öffnen
      </button>
    </li>
  );
}

/** Startseite: kurze Erklärung und Einstieg in die einzelnen Rechner. */
export function Landing({ onOpen }: { onOpen: (section: Exclude<Section, 'start'>, advanced: boolean) => void }) {
  const open = (t: Tile) => onOpen(t.section, !!t.advanced);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-start gap-5 rounded-card border border-line bg-surface p-6 sm:flex-row sm:items-center sm:p-8">
        <img src={logo} alt="" width={96} height={96} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
        <div className="min-w-0">
          <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">Dein Kredit, verständlich gerechnet.</h2>
          <p className="mt-2 max-w-[62ch] text-base leading-relaxed text-muted">
            Kredit Pilot zeigt dir in wenigen Sekunden, was eine Finanzierung in Österreich wirklich kostet: die Monatsrate, die Zinsen über die ganze Laufzeit und ob sie zu deinem Haushalt passt.
            Schieberegler bewegen, Ergebnis sofort sehen.
          </p>
          <button type="button" onClick={() => open(MAIN[0])} className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accentfg hover:opacity-90">Kreditrechner starten</button>
        </div>
      </section>

      <section aria-labelledby="start-rechner">
        <h2 id="start-rechner" className="mb-3 font-display text-lg font-bold">Womit möchtest du anfangen?</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {MAIN.map((t, i) => <Card key={t.section} t={t} primary={i === 0} onOpen={open} />)}
        </ul>
      </section>

      <section aria-labelledby="start-mehr">
        <h2 id="start-mehr" className="mb-1 font-display text-lg font-bold">Für genauere Fragen</h2>
        <p className="mb-3 text-sm text-muted">Diese Rechner öffnen die erweiterte Ansicht mit allen Einstellungen.</p>
        <ul className="grid gap-4 md:grid-cols-3">
          {MORE.map((t) => <Card key={t.section} t={t} onOpen={open} />)}
        </ul>
      </section>

      <section aria-labelledby="start-gut" className="rounded-card border border-line p-5">
        <h2 id="start-gut" className="font-display text-lg font-bold">Gut zu wissen</h2>
        <ul className="mt-2 grid gap-x-8 gap-y-2 text-sm leading-relaxed text-muted md:grid-cols-3">
          <li><strong className="text-fg">Ohne Anmeldung.</strong> Du brauchst kein Konto und gibst keine Kontaktdaten an.</li>
          <li><strong className="text-fg">Deine Zahlen bleiben bei dir.</strong> Gerechnet wird in deinem Browser, Eingaben werden nur auf deinem Gerät gespeichert.</li>
          <li><strong className="text-fg">Zwei Ansichten.</strong> Unten links wechselst du zwischen der vereinfachten und der erweiterten Ansicht.</li>
        </ul>
      </section>
    </div>
  );
}
