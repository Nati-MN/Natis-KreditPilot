# Kredit Pilot

Kredit-, Finanzierungs- und Vermietungsrechner für Österreich. React + TypeScript + Tailwind CSS + Recharts (Vite).

    npm install
    npm run dev      # Entwicklungsserver
    npm test         # 71 Tests der Berechnungslogik (Vitest)
    npm run build    # prüft Typen und baut nach dist/

Bereiche: Kreditrechner (Tilgungsplan, Sondertilgung, Zins-Simulator, Meilensteine), Vergleich (Kreditangebote, Varianten, Szenarien), Leistbarkeit, Umschuldung, Tilgen oder investieren, Immobilie vermieten. Unten links lässt sich zwischen vereinfachter und erweiterter Ansicht wechseln.

Aufbau, Formeln, Quellen, Konkurrenzvergleich und offene Punkte stehen in `docs/ANALYSE.md`.

Alle Berechnungen laufen im Browser. Eingaben werden nur lokal gespeichert. Gebühren-, Steuersätze und Orientierungswerte: Österreich, Stand Oktober 2026. Ergebnisse sind Modellrechnungen und kein verbindliches Angebot.
