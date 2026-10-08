import type { MouseEvent, ReactNode } from 'react';
import { navigate } from '../lib/nav';
import { urlFor } from '../lib/routes';
import type { Section } from '../lib/state';

/** Echter Link mit eigener Adresse; ein normaler Klick wechselt den Bereich ohne Neuladen. */
export function Link({ to, slug = null, className, children, onGo }: { to: Section; slug?: string | null; className?: string; children: ReactNode; onGo?: () => void }) {
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    // Strg-/Cmd-Klick und mittlere Maustaste öffnen wie gewohnt einen neuen Tab.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (onGo) onGo();
    else navigate(to, slug);
  };
  return <a href={urlFor(to, slug)} onClick={click} className={className}>{children}</a>;
}
