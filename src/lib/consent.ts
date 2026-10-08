/**
 * Einwilligung und lokale Daten.
 * Die Seite setzt keine Cookies. Die anonyme Besucherzählung (Vercel Web Analytics) wird erst nach Zustimmung geladen.
 */
export type Consent = 'ja' | 'nein' | null;

const KEY = 'kreditpilot.consent';
/** Alle Schlüssel, die diese Seite im Browser-Speicher verwendet, mit Zweck. */
export const STORAGE_KEYS: { key: string; purpose: string }[] = [
  { key: 'kreditpilot.state.v3', purpose: 'Deine zuletzt eingegebenen Werte, damit sie beim nächsten Besuch noch da sind' },
  { key: 'kreditpilot.scenarios.v1', purpose: 'Von dir gespeicherte Szenarien' },
  { key: 'kreditpilot.theme', purpose: 'Deine Wahl von hellem oder dunklem Modus' },
  { key: KEY, purpose: 'Deine Entscheidung zur Besucherzählung' },
  { key: 'kreditpilot.reloaded', purpose: 'Merkt sich bis zum Schließen des Tabs, dass die Seite nach einer Aktualisierung einmal neu geladen wurde' },
];

/** Im Build abschaltbar (z. B. für Vorschauen ohne Vercel). */
export const ANALYTICS_AVAILABLE = import.meta.env?.VITE_ANALYTICS !== 'off';

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ja' || v === 'nein' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: Exclude<Consent, null>): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* ohne Speicher gilt die Wahl nur für diesen Besuch */
  }
  if (value === 'ja') loadAnalytics();
}

let loaded = false;
/** Lädt das Zählskript von derselben Domain. Wird nur nach Zustimmung aufgerufen. */
export function loadAnalytics(): void {
  if (loaded || !ANALYTICS_AVAILABLE || typeof document === 'undefined') return;
  loaded = true;
  const w = window as unknown as { va?: (...args: unknown[]) => void; vaq?: unknown[] };
  w.va = w.va || function (...args: unknown[]) { (w.vaq = w.vaq || []).push(args); };
  const s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
}

/** Löscht alles, was diese Seite auf dem Gerät gespeichert hat. */
export function clearLocalData(): boolean {
  try {
    for (const k of STORAGE_KEYS) localStorage.removeItem(k.key);
    sessionStorage.removeItem('kreditpilot.reloaded');
    localStorage.removeItem('kreditpilot.state.v2');
    localStorage.removeItem('kreditpilot.state.v1');
    return true;
  } catch {
    return false;
  }
}
