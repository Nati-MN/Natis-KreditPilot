/**
 * Adressen der Webseite: Jeder Bereich hat einen eigenen Pfad, Titel und Beschreibungstext.
 * Dieselben Angaben nutzt der Build, um je Pfad eine eigene HTML-Seite und die sitemap.xml zu erzeugen.
 */
import { ARTICLES, findArticle } from './articles';
import { SITE } from './site';
import type { Section } from './state';

export interface Page {
  path: string;
  /** Titel im Browser-Tab und in Suchergebnissen. */
  title: string;
  /** Beschreibung für Suchmaschinen und geteilte Links. */
  description: string;
  /** Überschrift der statischen Seite. */
  heading: string;
  /** Rechner-Seiten werden in den strukturierten Daten als Anwendung ausgewiesen. */
  kind: 'start' | 'rechner' | 'text';
}

export const PAGES: Record<Section, Page> = {
  start: { path: '/', kind: 'start', title: 'Kredit Pilot – Kreditrechner für Österreich', heading: 'Kreditrechner für Österreich',
    description: 'Kostenloser Kreditrechner für Österreich: Monatsrate, Zinsen, Tilgungsplan, Leistbarkeit und Vermietung. Ohne Anmeldung, ohne Cookies.' },
  kredit: { path: '/kreditrechner', kind: 'rechner', title: 'Kreditrechner: Rate, Zinsen und Tilgungsplan | Kredit Pilot', heading: 'Kreditrechner mit Tilgungsplan',
    description: 'Monatsrate, Gesamtzinsen, Effektivzins und Tilgungsplan berechnen. Mit Fixzins, variablem Zins, Sondertilgung und Kaufnebenkosten für Österreich.' },
  vergleich: { path: '/kreditvergleich', kind: 'rechner', title: 'Kreditangebote vergleichen | Kredit Pilot', heading: 'Kreditangebote vergleichen',
    description: 'Mehrere Kreditangebote nebeneinander: Rate, Effektivzins, Gebühren und Gesamtkosten. Eigene Angebote eintragen und das günstigste finden.' },
  leistbarkeit: { path: '/leistbarkeit', kind: 'rechner', title: 'Leistbarkeitsrechner: Wie viel Kredit kann ich mir leisten? | Kredit Pilot', heading: 'Kann ich mir das leisten?',
    description: 'Einkommen, Ausgaben und Kreditrate gegenüberstellen. Mit den Orientierungswerten der österreichischen Finanzmarktaufsicht: 40 % Rate, 90 % Beleihung, 35 Jahre.' },
  umschuldung: { path: '/umschuldung', kind: 'rechner', title: 'Umschuldungsrechner: Lohnt sich der Wechsel? | Kredit Pilot', heading: 'Umschuldung berechnen',
    description: 'Bestehenden Kredit mit einem neuen Angebot vergleichen: Ersparnis, Wechselkosten und ab wann sich die Umschuldung rechnet.' },
  tilgen: { path: '/tilgen-oder-investieren', kind: 'rechner', title: 'Sondertilgung oder investieren? Rechner | Kredit Pilot', heading: 'Tilgen oder investieren',
    description: 'Zusätzliches Geld in den Kredit stecken oder anlegen? Der Rechner vergleicht beide Wege mit deinen Annahmen zu Rendite und Steuer.' },
  invest: { path: '/immobilie-vermieten', kind: 'rechner', title: 'Mietrendite-Rechner: Immobilie vermieten | Kredit Pilot', heading: 'Immobilie vermieten: Rendite und Cashflow',
    description: 'Miete, Kosten, Kredit und Steuer einer vermieteten Immobilie durchrechnen: Cashflow pro Monat, Brutto- und Nettomietrendite, Prognose über die Jahre.' },
  immobilien: { path: '/meine-immobilien', kind: 'rechner', title: 'Meine Immobilien | Kredit Pilot', heading: 'Meine Immobilien',
    description: 'Gespeicherte Immobilien auf einen Blick: Kaufpreis, Kredit, Miete, Cashflow und Rendite. Die Daten bleiben auf deinem Gerät.' },
  ratgeber: { path: '/ratgeber', kind: 'text', title: 'Ratgeber: Kredit und Immobilie kurz erklärt | Kredit Pilot', heading: 'Ratgeber',
    description: 'Kurze Erklärungen zu Fixzins, Leistbarkeit, Sondertilgung, Kaufnebenkosten, Effektivzins und Vermietung, jeweils mit Rechenbeispiel.' },
  quellen: { path: '/quellen', kind: 'text', title: 'Quellen und Annahmen | Kredit Pilot', heading: 'Quellen und Annahmen',
    description: 'Woher die Gebühren, Steuersätze und Orientierungswerte in Kredit Pilot stammen, was eigene Annahmen sind und wo die Berechnung endet.' },
  datenschutz: { path: '/datenschutz', kind: 'text', title: 'Datenschutzerklärung | Kredit Pilot', heading: 'Datenschutzerklärung',
    description: 'Welche Daten beim Besuch von Kredit Pilot verarbeitet werden: keine Anmeldung, keine Cookies, Berechnungen nur im Browser.' },
  nutzung: { path: '/nutzungsbedingungen', kind: 'text', title: 'Nutzungsbedingungen | Kredit Pilot', heading: 'Nutzungsbedingungen',
    description: 'Bedingungen für die Nutzung von Kredit Pilot: kostenlose Modellrechnungen, keine Beratung, kein Kreditangebot.' },
  cookies: { path: '/cookies', kind: 'text', title: 'Cookie-Richtlinie | Kredit Pilot', heading: 'Cookie-Richtlinie',
    description: 'Kredit Pilot setzt keine Cookies. Hier steht, was im Browser gespeichert wird und wie du es löschst.' },
  erstattung: { path: '/rueckerstattung', kind: 'text', title: 'Rückerstattung | Kredit Pilot', heading: 'Rückerstattung',
    description: 'Kredit Pilot ist kostenlos. Es gibt keine Käufe und daher nichts zu erstatten.' },
};

export interface Route {
  section: Section;
  /** Kurzname eines Ratgebertexts, sonst null. */
  slug: string | null;
}

/** Im eingebetteten Einzeldatei-Build gibt es keine eigenen Pfade; dort stehen die Bereiche hinter dem #. */
export const HASH_ROUTER = import.meta.env?.VITE_ROUTER === 'hash';
export const ORIGIN = `https://${SITE.domain}`;

const SECTION_KEYS = Object.keys(PAGES) as Section[];

export function pathFor(section: Section, slug: string | null = null): string {
  return section === 'ratgeber' && slug && findArticle(slug) ? `${PAGES.ratgeber.path}/${slug}` : PAGES[section].path;
}

/** Adresse für Links und den Browser-Verlauf. */
export function urlFor(section: Section, slug: string | null = null): string {
  if (!HASH_ROUTER) return pathFor(section, slug);
  return section === 'start' ? '#' : `#${section}${section === 'ratgeber' && slug ? `/${slug}` : ''}`;
}

/** Liest einen Pfad wie /kreditrechner oder /ratgeber/sondertilgung. Unbekannte Pfade ergeben null. */
export function parsePath(pathname: string): Route | null {
  const path = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  if (path === '/index') return { section: 'start', slug: null };
  const prefix = `${PAGES.ratgeber.path}/`;
  if (path.startsWith(prefix)) {
    const slug = path.slice(prefix.length);
    return findArticle(slug) ? { section: 'ratgeber', slug } : null;
  }
  const section = SECTION_KEYS.find((k) => PAGES[k].path === path);
  return section ? { section, slug: null } : null;
}

/** Liest #kredit oder #ratgeber/sondertilgung (Einzeldatei-Build und alte Links). */
export function parseHash(hash: string): Route | null {
  const [name, slug] = hash.replace(/^#/, '').split('/');
  if (!SECTION_KEYS.includes(name as Section)) return null;
  return { section: name as Section, slug: name === 'ratgeber' && slug && findArticle(slug) ? slug : null };
}

const START: Route = { section: 'start', slug: null };

/** Der Bereich, den die aktuelle Adresse meint. */
export function readRoute(): Route {
  if (typeof location === 'undefined') return START;
  if (HASH_ROUTER) return parseHash(location.hash) ?? START;
  // Alte Links mit # (z. B. /#kredit) führen weiterhin zum richtigen Bereich.
  if (parsePath(location.pathname)?.section === 'start' && location.hash.length > 1) return parseHash(location.hash) ?? START;
  return parsePath(location.pathname) ?? START;
}

export interface Meta {
  title: string;
  description: string;
  /** Vollständige Adresse der Seite. */
  url: string;
}

export function metaFor(section: Section, slug: string | null = null): Meta {
  const article = section === 'ratgeber' && slug ? findArticle(slug) : undefined;
  const url = ORIGIN + pathFor(section, slug);
  if (article) return { title: `${article.title} | Kredit Pilot`, description: article.description, url };
  return { title: PAGES[section].title, description: PAGES[section].description, url };
}

/** Alle Seiten für sitemap.xml und die statischen HTML-Dateien. */
export function allRoutes(): Route[] {
  return [...SECTION_KEYS.map((section) => ({ section, slug: null })), ...ARTICLES.map((a) => ({ section: 'ratgeber' as Section, slug: a.slug }))];
}

/** Setzt Titel, Beschreibung und kanonische Adresse nach einem Seitenwechsel. */
export function applyMeta(section: Section, slug: string | null): void {
  if (typeof document === 'undefined') return;
  const m = metaFor(section, slug);
  document.title = m.title;
  const set = (selector: string, attr: string, value: string) => document.head.querySelector(selector)?.setAttribute(attr, value);
  set('meta[name="description"]', 'content', m.description);
  set('link[rel="canonical"]', 'href', m.url);
  set('meta[property="og:title"]', 'content', m.title);
  set('meta[property="og:description"]', 'content', m.description);
  set('meta[property="og:url"]', 'content', m.url);
}
