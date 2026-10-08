import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';
import { ARTICLES, ARTICLES_DATE_ISO, findArticle, type Article } from './src/lib/articles';
import { allRoutes, metaFor, ORIGIN, PAGES, pathFor, type Route } from './src/lib/routes';
import type { Section } from './src/lib/state';

/** Nur für die eingebettete Vorschau: alles in einer einzigen HTML-Datei, Bereiche hinter dem #. */
const SINGLE = process.env.VITE_SINGLEFILE === '1';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (r: Route, text: string) => `<a href="${pathFor(r.section, r.slug)}">${esc(text)}</a>`;

const CALCULATORS: Section[] = ['kredit', 'leistbarkeit', 'invest', 'vergleich', 'umschuldung', 'tilgen'];
const FOOTER: Section[] = ['start', 'kredit', 'leistbarkeit', 'invest', 'vergleich', 'umschuldung', 'tilgen', 'ratgeber', 'quellen', 'datenschutz', 'nutzung', 'cookies', 'erstattung'];

function articleHtml(a: Article): string {
  const sections = a.sections.map((s) => `<h2>${esc(s.heading)}</h2>${(s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('')}${s.list ? `<ul>${s.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`).join('');
  return `<p>${esc(a.lead)}</p><h2>Kurz gesagt</h2><ul>${a.summary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${sections}<p>${link({ section: a.cta.section, slug: null }, a.cta.label)}</p>`;
}

/** Lesbarer Inhalt je Seite, bevor (oder falls nie) das Programm startet. */
function staticBody(r: Route): string {
  const article = r.slug ? findArticle(r.slug) : undefined;
  const page = PAGES[r.section];
  const list = (routes: Route[], text: (x: Route) => string, desc?: (x: Route) => string) =>
    `<ul>${routes.map((x) => `<li>${link(x, text(x))}${desc ? `: ${esc(desc(x))}` : ''}</li>`).join('')}</ul>`;
  const articles = ARTICLES.map((a) => ({ section: 'ratgeber' as Section, slug: a.slug }));
  let main: string;
  if (article) main = `<h1>${esc(article.title)}</h1>${articleHtml(article)}`;
  else if (r.section === 'start') {
    main = `<h1>${esc(page.heading)}</h1><p>${esc(page.description)}</p><h2>Rechner</h2>${list(CALCULATORS.map((section) => ({ section, slug: null })), (x) => PAGES[x.section].heading, (x) => PAGES[x.section].description)}`
      + `<h2>Ratgeber</h2>${list(articles, (x) => findArticle(x.slug ?? '')?.title ?? '')}`;
  } else if (r.section === 'ratgeber') {
    main = `<h1>${esc(page.heading)}</h1><p>${esc(page.description)}</p>${list(articles, (x) => findArticle(x.slug ?? '')?.title ?? '', (x) => findArticle(x.slug ?? '')?.description ?? '')}`;
  } else main = `<h1>${esc(page.heading)}</h1><p>${esc(page.description)}</p>`;
  const nav = `<nav aria-label="Seiten"><ul>${FOOTER.map((section) => `<li>${link({ section, slug: null }, section === 'start' ? 'Startseite' : PAGES[section].heading)}</li>`).join('')}</ul></nav>`;
  return `<div class="kp-static"><p class="kp-brand">Kredit Pilot</p>${main}<noscript><p>Für die Rechner muss JavaScript eingeschaltet sein.</p></noscript>${nav}</div>`;
}

/** Strukturierte Daten (schema.org) für Suchmaschinen. */
function jsonLd(r: Route): string {
  const m = metaFor(r.section, r.slug);
  const article = r.slug ? findArticle(r.slug) : undefined;
  const org = { '@type': 'Organization', name: 'Kredit Pilot', url: `${ORIGIN}/`, logo: `${ORIGIN}/icons/icon-512.png` };
  const items: Record<string, unknown>[] = [];
  if (article) {
    items.push({ '@type': 'Article', headline: article.title, description: article.description, inLanguage: 'de-AT', datePublished: ARTICLES_DATE_ISO, dateModified: ARTICLES_DATE_ISO,
      mainEntityOfPage: m.url, image: `${ORIGIN}/og.png`, author: org, publisher: org });
    items.push({ '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Start', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Ratgeber', item: ORIGIN + PAGES.ratgeber.path },
      { '@type': 'ListItem', position: 3, name: article.title, item: m.url },
    ] });
  } else if (PAGES[r.section].kind === 'start') {
    items.push({ '@type': 'WebSite', name: 'Kredit Pilot', url: `${ORIGIN}/`, inLanguage: 'de-AT', description: m.description });
  }
  if (!article && PAGES[r.section].kind !== 'text') {
    items.push({ '@type': 'WebApplication', name: r.section === 'start' ? 'Kredit Pilot' : `Kredit Pilot: ${PAGES[r.section].heading}`, url: m.url, description: m.description, inLanguage: 'de-AT',
      applicationCategory: 'FinanceApplication', operatingSystem: 'Alle (läuft im Browser)', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } });
  }
  if (!items.length) return '';
  // „<“ maskieren, damit kein Text das Skript-Element vorzeitig beenden kann.
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': items }).replace(/</g, '\\u003c')}</script>`;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Nach dem Build: je Adresse eine eigene HTML-Datei mit eigenem Titel, Beschreibung und lesbarem Inhalt,
 * dazu sitemap.xml, robots.txt, 404.html und die Dateiliste für den Service Worker.
 */
function staticPages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'kredit-pilot-static-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const template = readFileSync(join(outDir, 'index.html'), 'utf8');
      if (!template.includes('<!--kp:head-->') || !template.includes('<!--kp:static-->')) throw new Error('index.html: Platzhalter kp:head oder kp:static fehlt');
      const startMeta = metaFor('start');
      const render = (r: Route, extraHead = ''): string => {
        const m = metaFor(r.section, r.slug);
        let html = template
          .split(esc(startMeta.title)).join(esc(m.title))
          .split(esc(startMeta.description)).join(esc(m.description))
          .replace(`<link rel="canonical" href="${startMeta.url}" />`, `<link rel="canonical" href="${m.url}" />`)
          .replace(`<meta property="og:url" content="${startMeta.url}" />`, `<meta property="og:url" content="${m.url}" />`);
        if (r.slug) html = html.replace('<meta property="og:type" content="website" />', '<meta property="og:type" content="article" />');
        return html.replace('<!--kp:head-->', extraHead + jsonLd(r)).replace('<!--kp:static-->', staticBody(r));
      };
      if (!template.includes(esc(startMeta.title)) || !template.includes(`<link rel="canonical" href="${startMeta.url}" />`)) throw new Error('index.html: Titel oder kanonische Adresse passen nicht zu routes.ts');

      const routes = allRoutes();
      for (const r of routes) {
        const path = pathFor(r.section, r.slug);
        const file = join(outDir, path === '/' ? 'index.html' : `${path.slice(1)}.html`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, render(r));
      }
      // Unbekannte Adressen: Startseite anzeigen, aber nicht in Suchmaschinen aufnehmen.
      writeFileSync(join(outDir, '404.html'), render({ section: 'start', slug: null }, '<meta name="robots" content="noindex" />'));

      const today = new Date().toISOString().slice(0, 10);
      const listed = routes.filter((r) => r.section !== 'immobilien');
      writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
        listed.map((r) => `  <url><loc>${ORIGIN}${pathFor(r.section, r.slug)}</loc><lastmod>${r.slug ? ARTICLES_DATE_ISO : today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
      writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

      // Service Worker: alle Seiten und Dateien, die offline gebraucht werden.
      // Nicht dabei: Dateien nur für Suchmaschinen, große Installationssymbole, alte Schriftformate und
      // Zusatzteile der PDF-Bibliothek, die Kredit Pilot nie aufruft.
      const skip = /(^|\/)(sw\.js|404\.html|sitemap\.xml|robots\.txt|og\.png|apple-touch-icon\.png)$|^icons\/|\.(woff|map)$|\/(html2canvas|purify|index\.es)[.-]/;
      const files = walk(outDir).map((f) => relative(outDir, f).split('\\').join('/')).filter((f) => !skip.test(f)).sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const urls = files.map((f) => (f === 'index.html' ? '/' : `/${f.replace(/\.html$/, '')}`));
      const sw = readFileSync(join(outDir, 'sw.js'), 'utf8');
      if (!sw.includes('/*__FILES__*/') || !sw.includes('__VERSION__')) throw new Error('public/sw.js: Platzhalter fehlen');
      writeFileSync(join(outDir, 'sw.js'), sw.replace('__VERSION__', hash.digest('hex').slice(0, 12)).replace('/*__FILES__*/', urls.map((u) => JSON.stringify(u)).join(', ')));
      console.log(`\n${routes.length} Seiten, sitemap.xml, robots.txt und Service Worker (${urls.length} Dateien) erzeugt.`);
    },
  };
}

export default defineConfig({
  plugins: [react(), ...(SINGLE ? [viteSingleFile()] : [staticPages()])],
  publicDir: SINGLE ? false : 'public',
  build: { chunkSizeWarningLimit: SINGLE ? 4000 : 700 },
  test: { environment: 'node' },
});
