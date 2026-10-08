# Kredit Pilot – Analyse, Vergleich, Plan und Teststand

Stand: 8. Oktober 2026. Dieses Dokument gehört zum Projekt und beschreibt, was geprüft, gebaut und getestet wurde und was offen ist.

## 1. Bestandsaufnahme vor dieser Etappe

- Technik: React 18, TypeScript, Tailwind CSS 3, Recharts, Vite mit Einzeldatei-Build, Vitest. Keine Datenbank, kein Server, kein Routing. Zustand in einem `AppState`-Objekt, gespeichert im Browser (`localStorage`).
- Vorhanden: Annuitätenkredit mit Fixzins oder Fix-dann-variabel, Zinsänderungen, Referenzzins + Aufschlag, drei einfache Sondertilgungen, Tilgungsplan (Monat/Jahr), CSV/PDF, Kreditvergleich A/B, gespeicherte Szenarien, Kaufnebenkosten Österreich, Vermietungsmodul (Cashflow, Rendite, Steuer, Prognose, Break-even, Immobilienvergleich), vereinfachte und erweiterte Ansicht.
- Gefundene Schwächen:
  - Kein Effektivzins, keine Kreditgebühren im Kreditrechner.
  - Nur Annuität, keine tilgungsfreie Zeit, kein Datum, nur Monatsraten, nur 30/360.
  - Sondertilgungen nur als drei feste Regler, ohne Vertragsgrenze und Entschädigung.
  - Vergleich auf zwei Angebote beschränkt, ohne Gebühren.
  - CSV-Export hätte Datumswerte beschädigt (Punkte wurden entfernt). Behoben.
  - Import gespeicherter Daten ohne Typprüfung. Behoben.

## 2. Konkurrenzanalyse

Abgerufen am 8.10.2026 über den Seitentext. Rechner, die erst per JavaScript Werte füllen, zeigen im Seitentext nicht alles. „geprüft“ heißt: im abgerufenen Seitentext sichtbar. „nicht prüfbar“ heißt: dort nicht erkennbar; es wurde nichts dazuerfunden.

| Funktion | Kredit Pilot (jetzt) | Finta | i24app | BaufiBlick | CHECK24 | Umgesetzt |
|---|---|---|---|---|---|---|
| Kaufpreis, Nebenkosten, Eigenkapital | ja, Einzelposten | geprüft (Nebenkosten als ein Betrag, Schätzknopf) | nicht prüfbar | nein (nur Darlehenssumme) | nein | war vorhanden, erweitert |
| Annuitätendarlehen | ja | geprüft | geprüft | geprüft | geprüft | ja |
| Tilgungsdarlehen (konstante Tilgung) | ja | nicht prüfbar | geprüft, inkl. Vergleich beider Arten | nein | nein | neu |
| Endfällig, tilgungsfreie Zeit | ja | nicht prüfbar | nicht prüfbar | nein | nein | neu |
| Anfangstilgung statt Laufzeit | ja | nicht prüfbar | geprüft | geprüft (Mindesttilgung 0,5 %) | nein | neu |
| Wunschrate / Rückwärtsrechnung | ja | nicht prüfbar | nicht prüfbar | nein | geprüft (Rate als Eingabe) | neu |
| Fixzins mit Anschlusszins | ja, mehrere Phasen | geprüft (Anschlusszins-Annahme) | im Text erwähnt, Feld nicht sichtbar | geprüft (Zinsbindung 5–30 J.) | nein | war vorhanden, erweitert |
| Zinsober-/untergrenze, Referenzzins | ja | nicht prüfbar | nicht prüfbar | nein | nein | neu (Cap/Floor) |
| Sondertilgung | ja, frei definierbar | Bereich vorhanden, Felder nicht sichtbar | Feld vorhanden, Wirkung nicht sichtbar | geprüft (jährlich) | nein | stark erweitert |
| Effektivzins | ja, aus Zahlungsströmen | geprüft (ohne Bankspesen) | geprüft | nein (Sollzins) | geprüft (als Eingabe) | neu |
| Gebühren (Bearbeitung, Konto) | ja | nein (ausdrücklich ohne Spesen) | nicht prüfbar | nein | nicht prüfbar | neu |
| Tilgungsplan | ja, Monat/Jahr, Datum, Filter | im Titel genannt, nicht sichtbar | geprüft (Jahreswerte) | geprüft (Jahre, 10 sichtbar) | geprüft (Jahre) | erweitert |
| Restschuld am Ende der Zinsbindung | ja | nicht prüfbar | im Text erwähnt | geprüft | nein | ja |
| Vergleich Tilgungssätze / Laufzeiten | ja, Schnellvergleich | nicht prüfbar | nein | geprüft (statische Tabelle) | geprüft (alternative Laufzeiten) | neu |
| Vergleich mehrerer Kreditangebote | ja, bis 8 | nein | nein | nein | führt zum Angebotsvergleich (nicht im Rechner) | neu |
| FMA-Orientierungswerte | ja, einstellbar | geprüft (Beleihung, Laufzeit; Schuldendienstquote nur in FAQ) | nein | nein (DE) | nein | neu |
| Leistbarkeit / Haushalt | ja, mit Szenarien | Bereich „Haushalt“ vorhanden, Felder nicht sichtbar | nein | nein | nein | neu |
| Umschuldung | ja | nein | nein | verlinkt (Anschlussfinanzierung) | festes Beispiel, kein Rechner | neu |
| Tilgen oder investieren | ja | nein | nein | nein | nein | neu |
| Diagramme | ja, viele | geprüft (Restschuld) | geprüft (ein Diagramm) | keine | keine | erweitert |
| CSV-Export | ja | nicht prüfbar | geprüft | geprüft | nicht sichtbar | ja |
| Excel-Export | ja | nicht prüfbar | geprüft | nein | nein | neu |
| PDF-Export | ja, Bericht | nicht prüfbar | geprüft | nein | nein | erweitert |
| Drucken | nein (PDF-Bericht stattdessen) | nicht prüfbar | geprüft | nein | geprüft | bewusst nicht |
| Teilen per Link | nein, bewusst | geprüft („Szenario teilen“) | geprüft („Link teilen“) | nein | nein | bewusst nicht (Datenschutz) |
| Lokales Speichern | ja | geprüft | nicht prüfbar | nein | nein | erweitert (Datei-Import/Export) |
| Live-Kreditangebote von Banken | nein | nein | nein | nein | ja (Geschäftsmodell) | nein, kein Ziel |

Unabhängiger Referenzfall aus der Analyse: BaufiBlick zeigt für 400.000 €, 3,7 % Sollzins und 2 % Anfangstilgung eine Rate von 1.900 €, Restschuld nach 10 Jahren 303.371 €, Zinsen in der Zinsbindung 131.371 €, schuldenfrei nach 28,4 Jahren, Zinsen gesamt 246.370 €. Der Rechenkern trifft diese Werte (Test in `loan2.test.ts`).

## 3. Gap-Analyse und Stand

Umgesetzt in dieser Etappe:

1. Gemeinsamer Rechenkern (`src/lib/loan.ts`): Annuität, Ratentilgung, endfällig, tilgungsfreie Zeit, mehrere Zinsphasen, Zinsober-/untergrenze, Zahlungsintervall (monatlich bis jährlich), Zinsmethoden 30/360, taggenau/360, taggenau/365, Kreditbeginn und erste Fälligkeit, feste Rate (Anfangstilgung, Wunschrate), Gebühren, Effektivzins, Rückwärtsrechnung.
2. Tilgungsplan mit Datum, Anfangsschuld, Gebühren, Gesamtzahlung, Jahresfilter, Monatssuche, Markierung von Zinsänderungen und Sondertilgungen.
3. Sondertilgungen: beliebig viele Regeln (einmalig, monatlich, vierteljährlich, jährlich, Zeitraum, Euro oder Prozent der Restschuld), Vertragsgrenze pro Jahr, Entschädigung mit Freibetrag, drei Wirkungen (Laufzeit, Rate, halb/halb), Kalender.
4. Zins-Simulator: unverändert, +1, +2, −1, eigenes Szenario.
5. Kreditvergleich: bis 8 Angebote mit Gebühren, Effektivzins und drei getrennten Bewertungen.
6. Schnellvergleich von Varianten (Laufzeit, Zins, Eigenkapital, Sondertilgung, Fixzinsdauer) und Vergleich gespeicherter Szenarien mit Unterschieden in Euro und Prozent.
7. Leistbarkeit mit Haushaltsrechnung, einstellbaren Orientierungswerten und sechs Belastungsszenarien.
8. Umschuldung mit Break-even und Zinsszenarien.
9. Tilgen oder investieren mit Break-even-Rendite.
10. Meilensteine, schuldenfreies Datum, Restschuld zu einem Datum, reale Belastung mit Inflation.
11. Exporte: PDF-Bericht mit zwei Vektor-Diagrammen, Excel mit mehreren Blättern und Summenformeln, CSV. Sicherung und Wiederherstellung als JSON-Datei mit Prüfung.

Bewusst nicht umgesetzt, mit Begründung:

- Aktuelle oder historische EURIBOR-Daten: keine verlässliche, frei nutzbare Quelle ohne eigenen Server; EURIBOR-Daten sind lizenzpflichtig. Zinssätze bleiben eigene Eingaben.
- Teilbare Links: würden Finanzdaten in Adressen und Verläufe schreiben. Ersatz: Sicherungsdatei.
- Benutzerkonten: nicht nötig, alle Rechnungen laufen im Browser.
- Druckfunktion: ersetzt durch den PDF-Bericht.

Offen für eine nächste Etappe:

- Unregelmäßige Zahlungstermine über die erste Fälligkeit hinaus und frei definierbare Ratenstrukturen.
- Vierteljährlicher Zinsabschluss bei monatlicher Zahlung (in Österreich verbreitet).
- Vergleich von Zinsbindungen mit je eigenem Zinssatz (derzeit gleicher Fixzins).
- Diagramme der Oberfläche als Bild im PDF (derzeit zwei eigens gezeichnete Diagramme).
- Voreinstellungen für Konsum- und Autokredit (rechnerisch abgedeckt, aber ohne eigene Maske und ohne die Sonderregeln des VKrG).
- Festkommaarithmetik: derzeit Gleitkomma mit Rundung auf Cent bei jeder Buchung.
- Automatisierte UI-Tests im Projekt (bisher ein einmaliger Browser-Durchlauf außerhalb des Repos).

## 4. Architektur

```
src/lib/loan.ts        Rechenkern: Plan, Effektivzins, Datum, Meilensteine (keine UI)
src/lib/offers.ts      Kreditangebote vergleichen, Zins-Szenarien
src/lib/afford.ts      Leistbarkeit, Orientierungswerte als Parameter
src/lib/refinance.ts   Umschuldung
src/lib/payinvest.ts   Tilgen oder investieren
src/lib/purchase.ts    Kaufnebenkosten Österreich
src/lib/invest.ts      Vermietung
src/lib/analysis.ts    verbindet Zustand, Finanzierung, Kredit und Vermietung
src/lib/state.ts       Datenmodell, Standardwerte, Prüfung, Speicherung, Import/Export
src/lib/export.ts      CSV, PDF-Bericht, Excel
src/lib/xlsx.ts        kleiner Excel-Schreiber
src/components/*       Oberfläche; ruft nur Funktionen aus src/lib auf
```

Alle Module rechnen Kredite ausschließlich über `calculateLoan`. Neue Abhängigkeit: `fflate` (Zip für Excel, war bereits über jsPDF vorhanden). Keine externen Datenquellen, keine API-Schlüssel, keine kostenpflichtigen Dienste.

## 5. Formeln

- Annuität je Periode: `A = K · i · (1+i)^n / ((1+i)^n − 1)`, `i` = Nominalzins × Periodenlänge. Bei 0 %: `K / n`.
- Zinsen je Monat: `Restschuld × Nominalzins × Tagesanteil`; 30/360: 1/12, taggenau: Kalendertage / 360 bzw. / 365.
- Ratentilgung: Tilgung `K / n`, Rate = Tilgung + Zinsen. Endfällig: nur Zinsen, Kapital am Ende.
- Feste Rate aus Anfangstilgung: `K × (Zins + Tilgung) / 12`.
- Effektivzins `X`: `Auszahlung − Kosten = Σ Zahlung_t / (1+X)^t`, `t` in Jahren (Monat = 1/12), per Bisektion. Einbezogen: Raten, laufende Gebühren, einmalige Kreditkosten (Bearbeitung, Pfandrechtseintragung, Schätzung). Nicht einbezogen: Sondertilgungen, Notar, Makler, Grundbuchgebühr für den Eigentumserwerb. Bei variablem Zins gilt der Wert nur für die eingestellten Annahmen und ist kein gesetzlicher Effektivzins laut Vertrag.
- Tragbare Rate: `min(frei verfügbar − Puffer, Quote × Einkommen − bestehende Kredite)`; möglicher Kredit = Barwert dieser Rate.
- Umschuldung, Vorteil im Monat m: `Σ(alt − neu gezahlt) − bar bezahlte Kosten − (Restschuld neu − Restschuld alt)`.
- Tilgen oder investieren: beide Wege mit gleichem Monatsbudget, Nettovermögen = Depot nach Steuer − Restschuld.

## 6. Österreichische Regeln und Quellen

| Thema | Wert im Programm | Status | Quelle |
|---|---|---|---|
| Orientierungswerte Wohnkredit | Schuldendienst ≤ 40 %, Beleihung ≤ 90 %, Laufzeit ≤ 35 J. | Erwartung der Aufsicht per Rundschreiben vom 26.6.2025; KIM-V lief am 30.6.2025 aus. Einstellbar, nicht fest verdrahtet. | FMA, Seite „Wohnimmobilienkredite“, geändert 15.12.2025 |
| Entschädigung vorzeitige Rückzahlung | bis 1 %, im letzten Jahr halbiert, bei variablem Zins 0 | marktübliche Darstellung, Standard im Programm 0 %; Freibetrag frei einstellbar. Nicht am Gesetzestext geprüft. | capitalo.at; Gesetzestext HIKrG/VKrG nicht abgerufen |
| Grunderwerbsteuer, Grundbuch, Pfandrecht | 3,5 % / 1,1 % / 1,2 % | gesetzlich; Befreiung bis 30.6.2026 nur für Hauptwohnsitze, wird nicht angewendet | rkp.at |
| Kapitalertragsteuer | 27,5 % | Standardwert, einstellbar; aus Vorwissen, nicht nachgeschlagen | – |

## 7. Tests

`npm test` führt 71 Tests in 5 Dateien aus:

- `loan.test.ts` (14): Annuität, 0 %, Fixzinswechsel, Zinsänderungen, Referenzzins, Sondertilgungen, 720 Kombinationen.
- `loan2.test.ts` (24): Effektivzins gegen drei EU-Referenzbeispiele, Ratentilgung mit geschlossener Formel, endfällig, tilgungsfreie Zeit, Quartalszahlung, BaufiBlick-Referenzfall, Rate unter den Zinsen, Monatsende und Schaltjahr, Zinsmethoden, abweichende erste Fälligkeit, Sondertilgung am ersten Termin, kurz vor Ende und vollständig, Vertragsgrenze, Entschädigung, drei Strategien, Zinsgrenzen, Meilensteine, Inflation, 324 Kombinationen mit Zeilenprüfung (Anfangsschuld − Tilgung − Sondertilgung = Restschuld).
- `modules.test.ts` (15): Kreditvergleich, Zins-Simulator, Leistbarkeit, Umschuldung, Tilgen oder investieren, Anfangstilgung und Wunschrate, Kapitalbedarf, Import/Export inklusive Abwehr ungültiger Daten.
- `invest.test.ts` (14): Vermietungsmodul.
- `export.test.ts` (4): Tabellenwerte gleich Ergebnisobjekt, CSV-Format und Formelschutz, Excel und PDF werden erzeugt.

Zusätzlich einmalig von Hand geprüft: Browser-Durchlauf durch alle Bereiche in Desktop- und Handybreite ohne Fehlermeldungen; PDF-, Excel-, CSV- und JSON-Download im Browser ausgelöst und die Dateien geöffnet.
