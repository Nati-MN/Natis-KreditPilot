/** Seitenwechsel aus beliebigen Komponenten: App meldet sich als Empfänger an, Links rufen `navigate` auf. */
import type { Route } from './routes';
import type { Section } from './state';

let handler: ((r: Route) => void) | null = null;
export const onNavigate = (h: ((r: Route) => void) | null): void => {
  handler = h;
};
export const navigate = (section: Section, slug: string | null = null): void => handler?.({ section, slug });
