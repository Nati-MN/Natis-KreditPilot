# Kredit Pilot

Kredit-, Finanzierungs- und Vermietungsrechner für Österreich. React + TypeScript + Tailwind CSS + Recharts (Vite).

    npm install
    npm run dev      # Entwicklungsserver
    npm test         # 72 Tests der Berechnungslogik (Vitest)
    npm run build    # prüft Typen und baut nach dist/

Bereiche: Kreditrechner (Tilgungsplan, Sondertilgung, Zins-Simulator, Meilensteine), Vergleich (Kreditangebote, Varianten, Szenarien), Leistbarkeit, Umschuldung, Tilgen oder investieren, Immobilie vermieten. Unten links lässt sich zwischen vereinfachter und erweiterter Ansicht wechseln.

Aufbau, Formeln, Quellen, Konkurrenzvergleich und offene Punkte stehen in `docs/ANALYSE.md`.

Alle Berechnungen laufen im Browser. Eingaben werden nur lokal gespeichert. Gebühren-, Steuersätze und Orientierungswerte: Österreich, Stand Oktober 2026. Ergebnisse sind Modellrechnungen und kein verbindliches Angebot.

## Datenschutz und Barrierefreiheit

- Keine Cookies, keine Drittanbieter-Einbindungen. Schriften liegen im Projekt (`@fontsource`).
- Besucherzählung (Vercel Web Analytics) wird erst nach Zustimmung geladen (`src/lib/consent.ts`).
- Rechtsseiten: Datenschutz, Nutzungsbedingungen, Cookies, Rückerstattung (`src/components/Legal.tsx`). Betreiberangaben stehen in `src/lib/site.ts`.
- Jeder Bereich hat einen Anker in der Adresse (z. B. `#kredit`), dadurch funktioniert die Zurück-Taste des Browsers.
- Sprunglink zum Inhalt, Pfeiltasten in Auswahlgruppen, beschriftete Felder, Textalternativen für Diagramme.
