# Kredit Pilot

Kredit-, Finanzierungs- und Vermietungsrechner für Österreich. React + TypeScript + Tailwind CSS + Recharts (Vite).

    npm install
    npm run dev      # Entwicklungsserver
    npm test         # 81 Tests der Berechnungslogik, Ratgeber-Zahlen und Adressen (Vitest)
    npm run build    # prüft Typen und baut nach dist/

Bereiche: Kreditrechner (Tilgungsplan, Sondertilgung, Zins-Simulator, Meilensteine), Vergleich (Kreditangebote, Varianten, Szenarien), Leistbarkeit, Umschuldung, Tilgen oder investieren, Immobilie vermieten. Unten links lässt sich zwischen vereinfachter und erweiterter Ansicht wechseln.

Aufbau, Formeln, Quellen, Konkurrenzvergleich und offene Punkte stehen in `docs/ANALYSE.md`.

Alle Berechnungen laufen im Browser. Eingaben werden nur lokal gespeichert. Gebühren-, Steuersätze und Orientierungswerte: Österreich, Stand Oktober 2026. Ergebnisse sind Modellrechnungen und kein verbindliches Angebot.

## Datenschutz und Barrierefreiheit

- Keine Cookies, keine Drittanbieter-Einbindungen. Schriften liegen im Projekt (`@fontsource`).
- Besucherzählung (Vercel Web Analytics) wird erst nach Zustimmung geladen (`src/lib/consent.ts`).
- Rechtsseiten: Datenschutz, Nutzungsbedingungen, Cookies, Rückerstattung (`src/components/Legal.tsx`). Betreiberangaben stehen in `src/lib/site.ts`.
- Jeder Bereich hat eine eigene Adresse (z. B. `/kreditrechner`), dadurch funktioniert die Zurück-Taste des Browsers.
- Sprunglink zum Inhalt, Pfeiltasten in Auswahlgruppen, beschriftete Felder, Textalternativen für Diagramme.

## Adressen, Suchmaschinen und App

- Adressen, Titel und Beschreibungen aller Seiten stehen in `src/lib/routes.ts`, die Ratgebertexte in `src/lib/articles.ts`.
- Der Build (`vite.config.ts`) erzeugt je Adresse eine eigene HTML-Datei mit lesbarem Inhalt und strukturierten Daten, dazu `sitemap.xml`, `robots.txt` und `404.html`.
- `vercel.json` schaltet Adressen ohne `.html` ein. Alte Links mit `#` werden weitergeleitet.
- `public/`: Symbole, `manifest.webmanifest`, Vorschaubild `og.png` und der Service Worker `sw.js` (Offline-Betrieb; speichert nur Dateien der Webseite, keine Eingaben).
- Diagramme, große Rechner und der PDF-Export werden erst bei Bedarf geladen.
- Nach einer Änderung an Gebühren oder Steuersätzen: `articles.ts`, `sources.ts` und die Rechtstexte gemeinsam prüfen. `npm test` rechnet die Beispiele der Ratgebertexte nach.
