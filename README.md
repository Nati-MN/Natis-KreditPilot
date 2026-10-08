# KreditPilot – Immobilienkredit einfach verstehen

React + TypeScript + Tailwind CSS + Recharts (Vite).

    npm install
    npm run dev      # Entwicklungsserver
    npm test         # Tests der Berechnungslogik (Vitest)
    npm run build    # erzeugt eine einzelne, eigenständige dist/index.html

- `src/lib/loan.ts` – Berechnungslogik ohne UI (Annuität, Fix/variabel, Zinsänderungen, Sondertilgungen)
- `src/lib/loan.test.ts` – Tests (0 %, 119.000 € / 3,2 % / 30 J., Fixzinswechsel, Zinsszenarien, Sondertilgungen)
- `src/lib/state.ts` – Eingaben, Standardwerte, Speicherung im Browser
- `src/lib/export.ts` – CSV- und PDF-Export
- `src/components/` – Slider, Ergebniskarten, Kreditmodell, Diagramme, Tilgungsplan, Vergleich, Szenarien
