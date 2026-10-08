/**
 * Installation als App und Offline-Betrieb.
 * Der Service Worker (public/sw.js) legt die Dateien der Webseite im Browser ab, damit sie ohne Internet funktioniert.
 * Er speichert keine Eingaben und überträgt nichts.
 */
import { HASH_ROUTER } from './routes';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installEvent: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const PWA_AVAILABLE = !HASH_ROUTER && import.meta.env?.PROD === true;

export function initPwa(): void {
  if (!PWA_AVAILABLE || typeof window === 'undefined') return;
  // Der Browser meldet, dass die Seite installierbar ist; der Knopf auf der Startseite löst die Abfrage aus.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    notify();
  });
  // Nach einer neuen Version gibt es alte Programmteile nicht mehr: einmal neu laden.
  window.addEventListener('vite:preloadError', () => {
    try {
      if (sessionStorage.getItem('kreditpilot.reloaded')) return;
      sessionStorage.setItem('kreditpilot.reloaded', '1');
    } catch {
      return;
    }
    location.reload();
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* ohne Service Worker läuft die Seite normal weiter, nur nicht offline */
      });
    });
  }
}

export const canInstall = (): boolean => installEvent !== null;
export function subscribeInstall(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export async function promptInstall(): Promise<void> {
  const e = installEvent;
  if (!e) return;
  installEvent = null;
  notify();
  await e.prompt();
  await e.userChoice.catch(() => null);
}

/** Läuft die Seite bereits als installierte App? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
/** iPhone und iPad zeigen keine Installationsabfrage; dort geht es über das Teilen-Menü. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
