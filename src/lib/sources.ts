/**
 * Woher die Regeln, Sätze und Vergleichswerte in Kredit Pilot stammen.
 * `status`: 'geprüft' = am angegebenen Datum auf der Quelle nachgelesen; 'fachwissen' = allgemein bekannter Wert, nicht eigens nachgeschlagen.
 */
export interface Source {
  topic: string;
  /** Was im Programm verwendet wird. */
  used: string;
  name: string;
  url?: string;
  status: 'geprüft' | 'fachwissen';
  note?: string;
}

export const SOURCES_DATE = '8. Oktober 2026';

export const SOURCES: Source[] = [
  { topic: 'Orientierungswerte für Wohnkredite', used: 'Schuldendienstquote höchstens 40 %, Beleihungsquote höchstens 90 %, Laufzeit höchstens 35 Jahre; nicht für Kredite unter 50.000 €',
    name: 'Finanzmarktaufsicht (FMA): Wohnimmobilienkredite', url: 'https://www.fma.gv.at/banken/wohnimmobilienkredite/', status: 'geprüft',
    note: 'Seit dem Auslaufen der KIM-Verordnung am 30.6.2025 gelten die Werte als Erwartung der Aufsicht (Rundschreiben vom 26.6.2025), nicht als Gesetz. In der erweiterten Ansicht einstellbar.' },
  { topic: 'Grundbuch- und Pfandrechtsgebühr', used: 'Grundbucheintragung 1,1 % des Kaufpreises, Pfandrechtseintragung 1,2 % des Pfandrechts; die befristete Befreiung für Hauptwohnsitze endete am 30.6.2026 und wird nicht angewendet',
    name: 'RKP Steuerberatung: Gebührenbefreiung endet mit 30. Juni 2026', url: 'https://www.rkp.at/aktuelles/gebuehrenbefreiung-beim-immobilienkauf-endet-mit-30-juni-2026/', status: 'geprüft' },
  { topic: 'Kleinunternehmerregelung (Umsatzsteuer)', used: 'Grenze 55.000 € Jahresumsatz, darunter keine Umsatzsteuer auf die Miete',
    name: 'Unternehmensserviceportal des Bundes (USP): Kleinunternehmen', url: 'https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/weitere-informationen-zur-umsatzsteuer/weitere-steuertatbestaende-und-befreiungen/kleinunternehmen.html', status: 'geprüft' },
  { topic: 'Mindestrücklage im Wohnungseigentum', used: '1,12 € pro m² Nutzfläche und Monat seit 1.1.2026 (als Richtwert für die Instandhaltungsrücklage)',
    name: 'Wirtschaftskammer Österreich (WKO): Mindestrücklage Wohnungseigentumsgesetz', url: 'https://www.wko.at/oe/information-consulting/immobilien-vermoegenstreuhaender/mindestruecklage-wohnungseigentumsgesetz', status: 'geprüft' },
  { topic: 'Abschreibung bei Vermietung (AfA)', used: '1,5 % pro Jahr vom Gebäudeanteil, Grundanteil pauschal 40 %; Tilgung ist nicht abzugsfähig, Zinsen schon',
    name: 'finanzinfo.at: Mieteinnahmen versteuern', url: 'https://finanzinfo.at/immobilien/mieteinnahmen/', status: 'geprüft' },
  { topic: 'Mieterhöhungen (Mietpreisbremse)', used: 'Hinweis bei der Mietsteigerung: Inflation über 3 % zählt nur zur Hälfte, Erhöhung nur einmal jährlich',
    name: 'Arbeiterkammer Wien: Mietpreisbremse', url: 'https://wien.arbeiterkammer.at/beratung/Wohnen/mietwohnung/aktuelles/Mietpreisbremse.html', status: 'geprüft' },
  { topic: 'Entschädigung bei vorzeitiger Rückzahlung', used: 'Hinweistext: in der Fixzinsphase üblicherweise höchstens 1 %, im letzten Jahr 0,5 %, bei variablem Zins keine. Standardwert im Kreditrechner: 0 %',
    name: 'capitalo.at: Kredit vorzeitig ablösen', url: 'https://www.capitalo.at/kredit/ratgeber/kredit-vorzeitig-abloesen', status: 'geprüft',
    note: 'Ratgeberseite, nicht der Gesetzestext. Die Seite nennt an einer Stelle abweichend bis zu 4 %. Maßgeblich ist dein Kreditvertrag.' },
  { topic: 'Kontrollrechnung für den Rechenkern', used: 'Vergleichsfall 400.000 €, 3,7 % Zins, 2 % Anfangstilgung: Rate 1.900 €, Restschuld nach 10 Jahren 303.371 €, Laufzeit 28,4 Jahre',
    name: 'BaufiBlick: Tilgungsrechner', url: 'https://baufiblick.de/tilgungsrechner/', status: 'geprüft', note: 'Der Rechenkern trifft diese Werte in einem automatischen Test.' },
  { topic: 'Effektiver Jahreszins', used: 'Formel der EU-Verbraucherkreditrichtlinie: Auszahlung = Summe aller Zahlungen, abgezinst mit dem Effektivzins. Drei Rechenbeispiele der Richtlinie dienen als Test',
    name: 'EU-Richtlinie über Verbraucherkredite, Anhang zur Berechnung des effektiven Jahreszinses', status: 'fachwissen', note: 'Formel und Beispiele aus Fachwissen, nicht eigens abgerufen.' },
  { topic: 'Grunderwerbsteuer und Maklerprovision', used: 'Grunderwerbsteuer 3,5 % des Kaufpreises; Maklerprovision höchstens 3 % plus 20 % Umsatzsteuer bei Kaufpreisen über 48.448,51 €', name: 'Grunderwerbsteuergesetz, Immobilienmaklerverordnung', status: 'fachwissen' },
  { topic: 'Umsatzsteuersätze bei Vermietung', used: '10 % auf Wohnungsmiete und Betriebskosten, 20 % auf Heizung, Stellplatz und Möbel (nur ohne Kleinunternehmerregelung)', name: 'Umsatzsteuergesetz', status: 'fachwissen' },
  { topic: 'Weitere Steuerregeln', used: 'Beschleunigte AfA (Jahr 1 dreifach, Jahr 2 doppelt), Verteilung von Instandsetzung auf 15 Jahre, Grundanteile 20 % und 30 %, Kapitalertragsteuer 27,5 %', name: 'Einkommensteuergesetz', status: 'fachwissen', note: 'Alle Werte sind in der erweiterten Ansicht einstellbar.' },
];

/** Eigene Richtwerte ohne gesetzliche Grundlage; sie sind Startwerte zum Anpassen. */
export const ASSUMPTIONS: string[] = [
  'Vertragserrichtung 1,5 %, Notar 600 €, Beglaubigung 250 €, Bankbearbeitung 1 %, Bewertung 400 €.',
  'Laufende Vermieterkosten: 62 € Rücklage, 25 € Verwaltung, 13 € Versicherung pro Monat.',
  'Szenarien für Miete, Leerstand, Kosten und Wertentwicklung (optimistisch, realistisch, pessimistisch).',
  'Beispielwerte bei Leistbarkeit, Umschuldung und den drei Start-Kreditangeboten.',
  'Alle Zinssätze: Kredit Pilot lädt keine aktuellen Marktzinsen oder EURIBOR-Werte. Jeder Zinssatz ist deine Eingabe.',
];

export const LIMITS: string[] = [
  'Gerechnet wird mit monatlicher Verzinsung und Rundung auf Cent. Banken können je nach Vertrag anders rechnen, etwa mit vierteljährlichem Zinsabschluss.',
  'Der Effektivzins gilt bei variablem Zins nur für deine Annahmen und ist nicht der Wert, den eine Bank im Vertrag ausweist.',
  'Steuerberechnungen sind vereinfachte Schätzungen ohne Verlustvortrag und ohne Immobilienertragsteuer beim Verkauf.',
  'Gebühren, Steuersätze und Orientierungswerte können sich ändern. Der Stand steht oben auf dieser Seite.',
  'Die Ergebnisse sind keine Beratung und kein Kreditangebot.',
];
