# NATI KreditPilot – Immobilienkredit und Vermietung einfach verstehen

React + TypeScript + Tailwind CSS + Recharts (Vite).

    npm install
    npm run dev      # Entwicklungsserver
    npm test         # Tests der Berechnungslogik (Vitest)
    npm run build    # erzeugt eine einzelne, eigenständige dist/index.html

## Berechnungslogik (ohne UI, getestet)
- `src/lib/loan.ts` – Kredit: Annuität, Fix/variabel, Zinsänderungen, Sondertilgungen
- `src/lib/purchase.ts` – Kaufnebenkosten Österreich als Einzelposten
- `src/lib/invest.ts` – Miete/USt, Kosten, Cashflow, Renditen, Steuer, Prognose, Break-even-Formeln
- `src/lib/analysis.ts` – verbindet Kredit und Investment (`analyze`), Break-even-Suche, Vergleichskennzahlen
- `src/lib/state.ts` – Eingaben, Standardwerte, Finanzierung (`financing`), vereinfachte Ansicht (`effectiveState`), Speicherung
- `src/lib/export.ts` – CSV- und PDF-Export
- `src/lib/*.test.ts` – 28 Tests

## Oberfläche
- `src/App.tsx` – Aufbau, Bereichswahl, Umschalter vereinfachte/erweiterte Ansicht (links unten)
- `src/components/Settings.tsx` – Immobilie, Kaufnebenkosten, Kreditmodell
- `src/components/InvestSettings.tsx` – Mieteinnahmen, Kosten, Szenario, Steuern
- `src/components/InvestViews.tsx` – Dashboard, Monatsrechnung, Break-even, Prognose-Tabelle, Immobilienvergleich
- `src/components/InvestCharts.tsx` – Investment-Diagramme
- `src/components/Charts.tsx`, `ScheduleTable.tsx`, `Comparison.tsx`, `ExtraPanel.tsx`, `Scenarios.tsx`, `ui.tsx`

Gebühren- und Steuersätze: Österreich, Stand Oktober 2026. Steuerwerte sind vereinfachte Schätzungen.
