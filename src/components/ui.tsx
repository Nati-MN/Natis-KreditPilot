import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { parseNumber } from '../lib/format';

export function Card({ title, children, action, className = '', collapsible, defaultOpen = true, summary }: {
  title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string; collapsible?: boolean; defaultOpen?: boolean; summary?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const show = !collapsible || open;
  return (
    <section className={`min-w-0 rounded-card border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className={`flex flex-wrap items-center justify-between gap-2 ${show ? 'mb-4' : ''}`}>
          {collapsible ? (
            <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
              <h2 className="font-display text-[17px] font-bold leading-tight">{title}</h2>
              <span className="flex shrink-0 items-center gap-2 text-[13px] text-muted">
                {!open && summary}
                <span aria-hidden="true" className={`inline-block transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
              </span>
            </button>
          ) : (
            title && <h2 className="font-display text-[17px] font-bold leading-tight">{title}</h2>
          )}
          {action}
        </div>
      )}
      {show && <div id={id}>{children}</div>}
    </section>
  );
}

/** Zeile "Bezeichnung … Wert" für Aufstellungen. */
export function Row({ label, value, strong, tone, sub }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: 'good' | 'bad' | 'muted'; sub?: ReactNode }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'muted' ? 'text-muted' : '';
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? 'border-t border-line pt-2 font-semibold' : ''}`}>
      <span className="min-w-0 text-sm">{label}{sub && <span className="block text-[12px] font-normal text-muted">{sub}</span>}</span>
      <span className={`num shrink-0 text-sm ${strong ? 'font-display text-base font-bold' : 'font-medium'} ${color}`}>{value}</span>
    </div>
  );
}

export function Select<T extends string | number>({ id, value, options, onChange, label, disabled }: {
  id: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string; disabled?: boolean;
}) {
  return (
    <select id={id} aria-label={label} disabled={disabled} value={String(value)}
      onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
      className="max-w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm disabled:opacity-50">
      {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3 py-1.5 text-sm'} ${
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-surface2 ring-1 ring-line transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export const GLOSSARY: Record<string, string> = {
  Tilgung: 'Der Teil deiner Monatsrate, mit dem du den ursprünglich geliehenen Kredit zurückzahlst.',
  Zinsen: 'Das zusätzliche Geld, das die Bank für das Verleihen des Geldes erhält.',
  Restschuld: 'Der Kreditbetrag, den du der Bank noch schuldest.',
  Fixzins: 'Ein Zinssatz, der für eine vereinbarte Zeit gleich bleibt.',
  'Variabler Zins': 'Ein Zinssatz, der sich während der Laufzeit verändern kann.',
  Annuität: 'Eine gleichbleibende Kreditrate, die aus Zinsen und Tilgung besteht.',
  Eigenkapital: 'Geld, das du selbst einbringst. Je mehr Eigenkapital, desto kleiner der Kredit.',
  Kaufnebenkosten: 'Kosten zusätzlich zum Kaufpreis, in Österreich vor allem Grunderwerbsteuer, Grundbucheintragung, Vertragserrichtung und Maklerprovision.',
  Sondertilgung: 'Eine zusätzliche Zahlung neben der normalen Rate. Sie senkt die Restschuld sofort und spart Zinsen. Manche Banken verlangen dafür eine Gebühr.',
  Referenzzins: 'Ein öffentlicher Marktzins wie der EURIBOR. Der variable Kreditzins folgt ihm zu festen Terminen.',
  'Hauptmietzins': 'Die reine Miete ohne Betriebskosten und Umsatzsteuer.',
  'Cashflow': 'Was am Monatsende wirklich übrig bleibt: Mieteinnahmen minus deine Kosten minus Kreditrate.',
  'Bruttomietrendite': 'Jahres-Nettomiete geteilt durch den Kaufpreis. Schnell zu vergleichen, berücksichtigt aber keine Kosten.',
  'Nettomietrendite': 'Jahres-Nettomiete nach laufenden Vermieterkosten und Leerstand, geteilt durch die Gesamtinvestition. Vor Finanzierung und Steuern.',
  'Cash-on-Cash-Rendite': 'Jährlicher Cashflow geteilt durch deine eingesetzten Eigenmittel.',
  'Gesamtinvestition': 'Kaufpreis plus Kaufnebenkosten, Renovierung und sonstige Anfangskosten.',
  Bankaufschlag: 'Der fixe Zuschlag der Bank auf den Referenzzins. Referenzzins + Aufschlag = dein variabler Zinssatz.',
};

export function InfoTip({ term, text }: { term: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Erklärung: ${term}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="ml-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-current text-[11px] font-semibold italic leading-none opacity-60 hover:opacity-100"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-6 z-30 w-60 max-w-[70vw] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-fg shadow-lg"
        >
          <strong className="block font-semibold">{term}</strong>
          {text ?? GLOSSARY[term]}
        </span>
      )}
    </span>
  );
}

interface NumberBoxProps {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit: string;
  decimals?: number;
  onError?: (msg: string | null) => void;
  width?: string;
  ariaLabel?: string;
  /** Ohne Tausenderpunkt, z. B. für Jahreszahlen. */
  plain?: boolean;
}

const fmt = (v: number, decimals: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(v);

/** Zahleneingabe mit deutscher Schreibweise und sofortiger Prüfung. */
export function NumberBox({ id, value, min, max, onChange, unit, decimals = 0, onError, width = 'w-32', ariaLabel, plain }: NumberBoxProps) {
  const [text, setText] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const shown = text ?? (plain ? String(value) : fmt(value, decimals));
  const report = (msg: string | null) => {
    setBad(!!msg);
    onError?.(msg);
  };
  return (
    <span className={`inline-flex ${width} shrink-0 items-center rounded-lg border bg-bg px-2 ${bad ? 'border-bad' : 'border-line focus-within:border-accent'}`}>
      <input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={bad}
        inputMode="decimal"
        autoComplete="off"
        className="num w-full min-w-0 bg-transparent py-1.5 text-right text-sm font-medium outline-none"
        value={shown}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const n = plain ? Number(t.trim()) : parseNumber(t);
          if (!Number.isFinite(n)) return report('Bitte eine Zahl eingeben.');
          if (n < min || n > max) return report(`Erlaubt sind ${fmt(min, decimals)} bis ${fmt(max, decimals)} ${unit}.`);
          report(null);
          onChange(Number(n.toFixed(decimals)));
        }}
        onBlur={() => {
          setText(null);
          report(null);
        }}
      />
      {unit && <span className="whitespace-nowrap pl-1 text-sm text-muted">{unit}</span>}
    </span>
  );
}

interface SliderFieldProps {
  id: string;
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  decimals?: number;
  onChange: (v: number) => void;
  hint?: ReactNode;
  disabled?: boolean;
}

/** Schieberegler plus direkte Zahleneingabe für denselben Wert. */
export function SliderField({ id, label, value, min, max, step, unit, decimals = 0, onChange, hint, disabled }: SliderFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const safeMax = Math.max(max, min);
  const clamped = Math.min(Math.max(value, min), safeMax);
  const fill = safeMax > min ? ((clamped - min) / (safeMax - min)) * 100 : 0;
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 text-sm font-medium">{label}</label>
        <NumberBox id={`${id}-zahl`} ariaLabel={`${typeof label === 'string' ? label : id} als Zahl`} value={clamped} min={min} max={safeMax} unit={unit} decimals={decimals} onChange={onChange} onError={setError} />
      </div>
      <input
        id={id}
        type="range"
        className="kp-range mt-1"
        style={{ ['--fill' as string]: `${fill}%` }}
        min={min}
        max={safeMax}
        step={step}
        value={clamped}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {error ? <p role="alert" className="text-[13px] text-bad">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function ResultCard({ label, value, sub, emphasis, tone }: { label: ReactNode; value: string; sub?: ReactNode; emphasis?: boolean; tone?: 'zins' | 'tilgung' | 'rest' }) {
  const dot = tone ? { zins: 'bg-zins', tilgung: 'bg-tilgung', rest: 'bg-rest' }[tone] : null;
  return (
    <div className={`flex min-w-0 flex-col justify-between gap-2 rounded-card p-4 ${emphasis ? 'bg-accent text-accentfg' : 'border border-line bg-surface'}`}>
      <div className={`flex items-center gap-2 text-[13px] font-medium ${emphasis ? 'opacity-90' : 'text-muted'}`}>
        {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
        <span>{label}</span>
      </div>
      <div>
        <div className={`num font-display font-bold leading-none tracking-tight ${emphasis ? 'text-[34px]' : 'text-[24px]'}`}>{value}</div>
        {sub && <div className={`mt-1.5 text-[13px] leading-snug ${emphasis ? 'opacity-90' : 'text-muted'}`}>{sub}</div>}
      </div>
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-accentsoft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">{children}</span>;
}

export function Button({ children, onClick, variant = 'ghost', disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'ghost' | 'primary'; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
        variant === 'primary' ? 'bg-accent text-accentfg hover:opacity-90' : 'border border-line bg-surface text-fg hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </button>
  );
}
