import { useEffect, useState } from 'react';
import { canInstall, isIos, isStandalone, promptInstall, PWA_AVAILABLE, subscribeInstall } from '../lib/pwa';

/** Hinweis auf der Startseite: Kredit Pilot als App auf dem Gerät ablegen. */
export function Install() {
  const [ready, setReady] = useState(() => canInstall());
  useEffect(() => subscribeInstall(() => setReady(canInstall())), []);
  if (!PWA_AVAILABLE || isStandalone()) return null;
  if (ready) {
    return (
      <p className="text-sm text-muted">
        <button type="button" onClick={() => void promptInstall()} className="rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-fg hover:border-accent hover:text-accent">Als App installieren</button>
        <span className="mt-1 block text-[13px]">Mit Symbol am Startbildschirm, funktioniert auch ohne Internet.</span>
      </p>
    );
  }
  if (isIos()) return <p className="max-w-[46ch] text-[13px] leading-relaxed text-muted">Als App am iPhone: in Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen. Danach funktioniert Kredit Pilot auch ohne Internet.</p>;
  return null;
}
