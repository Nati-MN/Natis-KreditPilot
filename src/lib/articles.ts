/**
 * Ratgebertexte. Reine Daten, damit die Oberfläche und der Build (statische Seiten für Suchmaschinen) dasselbe anzeigen.
 * Alle Rechenbeispiele stammen aus dem Rechenkern und werden in articles.test.ts nachgerechnet.
 * Zinssätze in den Beispielen sind frei gewählt und keine Marktwerte.
 */
import type { Section } from './state';

export interface ArticleSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface Article {
  slug: string;
  title: string;
  /** Ein Satz für die Übersicht und für Suchmaschinen. */
  description: string;
  lead: string;
  sections: ArticleSection[];
  /** Das Wichtigste in drei Punkten. */
  summary: string[];
  /** Knopf zum passenden Rechner. */
  cta: { label: string; section: Section; advanced?: boolean; choice?: 'kredit' | 'kauf' | 'vermieten'; tab?: 'sondertilgung' | 'zinsen' };
}

export const ARTICLES_DATE = '8. Oktober 2026';
export const ARTICLES_DATE_ISO = '2026-10-08';

export const ARTICLES: Article[] = [
  {
    slug: 'fixzins-oder-variabel',
    title: 'Fixzins oder variabler Zins: Was passt zu dir?',
    description: 'Fixzins gibt Planbarkeit, variabler Zins bewegt sich mit dem Markt. Ein Rechenbeispiel zeigt, was ein Zinsanstieg kostet.',
    lead: 'Beim Fixzins bleibt deine Rate über die vereinbarte Zeit gleich. Beim variablen Zins bewegt sie sich mit dem Markt, nach oben wie nach unten.',
    sections: [
      { heading: 'Fixzins: planbar, dafür weniger beweglich', paragraphs: [
        'Der Zinssatz wird für eine vereinbarte Dauer festgeschrieben, zum Beispiel für 10, 15 oder 20 Jahre oder für die gesamte Laufzeit. In dieser Zeit ändert sich deine Rate nicht, egal was am Markt passiert.',
        'Der Preis dafür: Der Fixzins liegt häufig über dem variablen Zins zum selben Zeitpunkt. Und wenn du in der Fixzinsphase vorzeitig zurückzahlst, darf die Bank eine Entschädigung verlangen, üblicherweise höchstens 1 % des vorzeitig gezahlten Betrags. Was genau gilt, steht in deinem Vertrag.',
      ] },
      { heading: 'Variabler Zins: beweglich, mit Risiko', paragraphs: [
        'Der variable Zins besteht meist aus einem Referenzzins, häufig dem 3-Monats-EURIBOR, und einem festen Aufschlag der Bank. Er wird regelmäßig angepasst. Sinkt der Referenzzins, zahlst du weniger. Steigt er, steigt deine Rate.',
        'Dafür bist du beweglicher: Vorzeitige Rückzahlungen sind bei variablem Zins üblicherweise ohne Entschädigung möglich.',
      ] },
      { heading: 'Ein Rechenbeispiel', paragraphs: [
        '300.000 € Kredit, 30 Jahre Laufzeit, 3,5 % Zins: Die Monatsrate beträgt 1.347,13 €.',
        'Angenommen, der Zins ist nur 10 Jahre fix und steigt danach auf 5,5 %: Die Rate klettert auf 1.597,83 €, also rund 250 € mehr pro Monat. Die Zinsen über die ganze Laufzeit steigen von 184.970 € auf 245.136 €. Fällt der Zins stattdessen auf 2,5 %, sinkt die Rate auf 1.230,87 €.',
        'Die Zinssätze sind frei gewählte Beispiele, keine Marktwerte und keine Vorhersage.',
      ] },
      { heading: 'So findest du deine Antwort', list: [
        'Könntest du eine um 250 € höhere Rate über Jahre zahlen? Wenn nicht, spricht viel für den Fixzins.',
        'Hast du vor, früh viel zurückzuzahlen oder zu verkaufen? Dann ist die Beweglichkeit des variablen Zinses mehr wert.',
        'Auch eine Mischform ist üblich: Fixzins für die ersten Jahre, danach variabel.',
      ] },
    ],
    summary: ['Fixzins: gleiche Rate, dafür oft etwas teurer und weniger beweglich.', 'Variabler Zins: Chance auf niedrigere, Risiko höherer Raten.', 'Entscheidend ist, ob du einen Zinsanstieg tragen könntest.'],
    cta: { label: 'Zinsanstieg mit eigenen Zahlen durchrechnen', section: 'kredit', advanced: true, tab: 'zinsen' },
  },
  {
    slug: 'wie-viel-kredit-kann-ich-mir-leisten',
    title: 'Wie viel Kredit kann ich mir leisten?',
    description: 'Die Orientierungswerte der Finanzmarktaufsicht und ein Rechenbeispiel: Welche Rate tragbar ist und welcher Kreditbetrag dazu passt.',
    lead: 'Entscheidend ist nicht, wie viel eine Bank höchstens hergibt, sondern welche Rate du jeden Monat gut tragen kannst.',
    sections: [
      { heading: 'Drei Orientierungswerte der Aufsicht', paragraphs: ['Die österreichische Finanzmarktaufsicht (FMA) erwartet von Banken bei Wohnkrediten:'], list: [
        'Alle Kreditraten zusammen höchstens 40 % des Netto-Haushaltseinkommens.',
        'Kredit höchstens 90 % des Immobilienwerts (Beleihungsquote).',
        'Laufzeit höchstens 35 Jahre.',
      ] },
      { heading: 'Wie verbindlich ist das?', paragraphs: [
        'Bis 30. Juni 2025 standen diese Grenzen in einer Verordnung. Seither gelten sie als Erwartung der Aufsicht an die Banken, nicht als Gesetz. Eine Bank kann im Einzelfall abweichen, sie kann aber auch strenger sein. Für Kredite unter 50.000 € gelten die Werte nicht.',
      ] },
      { heading: 'Ein Rechenbeispiel', paragraphs: [
        'Bei 3.000 € Netto-Haushaltseinkommen sind 40 % genau 1.200 € Rate pro Monat. Wie viel Kredit das ergibt, hängt stark von Zins und Laufzeit ab:',
      ], list: [
        '3,5 % Zins, 30 Jahre: rund 267.000 € Kredit.',
        '3,5 % Zins, 25 Jahre: rund 240.000 € Kredit.',
        '5,5 % Zins, 30 Jahre: rund 211.000 € Kredit.',
      ] },
      { heading: 'Was du zusätzlich einplanen solltest', list: [
        'Bestehende Kredite und Leasingraten zählen zu den 40 % dazu.',
        'Kaufnebenkosten kommen zum Kaufpreis dazu und müssen meist aus Eigenkapital bezahlt werden.',
        'Bei variablem Zins: ein Puffer für steigende Raten.',
        'Rücklagen für Reparaturen und für Zeiten mit weniger Einkommen, etwa Karenz oder Jobwechsel.',
      ] },
    ],
    summary: ['Faustregel der Aufsicht: Rate höchstens 40 % vom Nettoeinkommen.', 'Zins und Laufzeit verändern den möglichen Kreditbetrag stark.', 'Rechne mit Puffer, nicht bis an die Grenze.'],
    cta: { label: 'Leistbarkeit mit eigenen Zahlen prüfen', section: 'leistbarkeit' },
  },
  {
    slug: 'sondertilgung',
    title: 'Sondertilgung: Wie viel sie wirklich bringt',
    description: 'Zusätzliche Zahlungen senken die Restschuld sofort. Rechenbeispiele zeigen, warum frühe Sondertilgungen viel mehr sparen als späte.',
    lead: 'Eine Sondertilgung ist eine Zahlung zusätzlich zur normalen Rate. Sie senkt die Restschuld sofort, und auf weniger Schuld fallen weniger Zinsen an.',
    sections: [
      { heading: 'Früh wirkt stärker als spät', paragraphs: [
        'Beispiel: 300.000 € Kredit, 3,5 % Zins, 30 Jahre. Wer am Ende des dritten Jahres einmalig 20.000 € zusätzlich zahlt, spart 28.794 € Zinsen und ist 3 Jahre früher schuldenfrei.',
        'Dieselben 20.000 € am Ende des zwanzigsten Jahres sparen nur noch 7.570 € Zinsen und 20 Monate. Der Grund: Früh getilgtes Geld spart über viele Jahre Zinsen, spät getilgtes nur noch über wenige.',
      ] },
      { heading: 'Regelmäßig statt einmalig', paragraphs: [
        'Auch kleinere Beträge wirken, wenn sie regelmäßig kommen. Im selben Beispiel führen 3.000 € zusätzlich am Ende jedes Jahres dazu, dass der Kredit nach 23 statt 30 Jahren zurückgezahlt ist. Die Zinsersparnis beträgt 48.017 €.',
      ] },
      { heading: 'Laufzeit verkürzen oder Rate senken', paragraphs: [
        'Nach einer Sondertilgung gibt es zwei Wege. Bleibt die Rate gleich, wird der Kredit früher fertig; das spart am meisten Zinsen. Oder die Laufzeit bleibt gleich und die Rate sinkt; das schafft Spielraum im Monat. Welcher Weg möglich ist, regelt dein Vertrag.',
      ] },
      { heading: 'Worauf du achten musst', list: [
        'In der Fixzinsphase darf die Bank eine Entschädigung verlangen, üblicherweise höchstens 1 % des vorzeitig gezahlten Betrags, im letzten Jahr 0,5 %. Bei variablem Zins fällt üblicherweise keine an.',
        'Manche Verträge erlauben pro Jahr einen bestimmten Betrag kostenlos. Lies nach, bevor du zahlst.',
        'Behalte eine Reserve für Notfälle. Geld im Kredit bekommst du nicht einfach zurück.',
      ] },
    ],
    summary: ['Je früher die Sondertilgung, desto größer die Ersparnis.', 'Regelmäßige kleine Beträge verkürzen die Laufzeit um Jahre.', 'Vorher Vertrag prüfen: Entschädigung und kostenlose Beträge.'],
    cta: { label: 'Sondertilgung im Kreditrechner ausprobieren', section: 'kredit', advanced: true, tab: 'sondertilgung' },
  },
  {
    slug: 'kaufnebenkosten-oesterreich',
    title: 'Kaufnebenkosten in Österreich: Womit du rechnen musst',
    description: 'Grunderwerbsteuer, Grundbuch, Makler, Vertrag und Pfandrecht: alle Posten beim Immobilienkauf in Österreich mit Beispielrechnung.',
    lead: 'Zum Kaufpreis kommen in Österreich häufig rund 10 % Nebenkosten dazu. Banken finanzieren sie oft nicht mit, du brauchst sie also meist als Eigenkapital.',
    sections: [
      { heading: 'Kosten rund um den Kauf', list: [
        'Grunderwerbsteuer: 3,5 % des Kaufpreises.',
        'Eintragung ins Grundbuch: 1,1 % des Kaufpreises.',
        'Maklerprovision: höchstens 3 % plus 20 % Umsatzsteuer, also 3,6 %. Ohne Makler entfällt sie.',
        'Kaufvertrag und Treuhand durch Notar oder Anwalt: frei vereinbar, als Richtwert 1 bis 3 % plus Umsatzsteuer.',
        'Beglaubigungen und Barauslagen: meist einige hundert Euro.',
      ] },
      { heading: 'Kosten rund um den Kredit', list: [
        'Eintragung des Pfandrechts: 1,2 % des eingetragenen Betrags. Banken tragen oft mehr ein als den Kreditbetrag.',
        'Bearbeitungsgebühr der Bank: je nach Bank verschieden und verhandelbar.',
        'Schätzung der Immobilie durch die Bank.',
      ] },
      { heading: 'Ein Rechenbeispiel', paragraphs: [
        'Bei 300.000 € Kaufpreis fallen an: 10.500 € Grunderwerbsteuer, 3.300 € Grundbuchgebühr und bis zu 10.800 € Maklerprovision. Das sind schon 24.600 € oder 8,2 % des Kaufpreises, noch ohne Vertragserrichtung und Kreditkosten.',
      ] },
      { heading: 'Gebührenbefreiung ist ausgelaufen', paragraphs: [
        'Die befristete Befreiung von Grundbuch- und Pfandrechtsgebühr für den Hauptwohnsitz endete am 30. Juni 2026. Kredit Pilot rechnet deshalb mit den vollen Sätzen.',
      ] },
    ],
    summary: ['Rund 10 % des Kaufpreises zusätzlich einplanen.', 'Die größten Posten: Grunderwerbsteuer, Makler, Grundbuch.', 'Nebenkosten kommen meist aus dem Eigenkapital.'],
    cta: { label: 'Finanzierung mit Nebenkosten berechnen', section: 'kredit', choice: 'kauf' },
  },
  {
    slug: 'effektivzins-und-nominalzins',
    title: 'Nominalzins und Effektivzins: Welcher zählt beim Vergleich?',
    description: 'Der Nominalzins bestimmt die Zinsen, der Effektivzins rechnet die Kreditkosten mit ein. Ein Beispiel zeigt, warum der niedrigere Nominalzins teurer sein kann.',
    lead: 'Der Nominalzins bestimmt, wie viel Zinsen du zahlst. Der Effektivzins rechnet zusätzlich die Kosten des Kredits ein und ist deshalb die bessere Vergleichszahl.',
    sections: [
      { heading: 'Nominalzins', paragraphs: ['Das ist der Zinssatz, der auf deine Restschuld angewendet wird. Aus ihm, dem Kreditbetrag und der Laufzeit ergibt sich deine Rate.'] },
      { heading: 'Effektivzins', paragraphs: [
        'Der effektive Jahreszins bezieht neben den Zinsen auch Kosten wie Bearbeitungsgebühr und Kontoführung ein und drückt alles als einen Prozentsatz pro Jahr aus. Banken müssen ihn im Angebot angeben. Welche Kosten eingerechnet sind, steht dort ebenfalls.',
      ] },
      { heading: 'Ein Rechenbeispiel', paragraphs: ['Zwei Angebote über 200.000 € und 25 Jahre:'], list: [
        'Angebot A: 3,4 % Nominalzins, 5.000 € Bearbeitungsgebühr, 8 € Kontoführung pro Monat. Rate 990,55 €, Effektivzins 3,78 %, Zinsen und Gebühren zusammen 104.566 €.',
        'Angebot B: 3,6 % Nominalzins, keine Gebühren. Rate 1.012,01 €, Effektivzins 3,66 %, Zinsen zusammen 103.601 €.',
      ] },
      { heading: 'Was das Beispiel zeigt', paragraphs: [
        'Angebot A wirkt mit dem niedrigeren Nominalzins und der niedrigeren Rate günstiger. Über die ganze Laufzeit ist aber Angebot B um rund 965 € billiger, und genau das zeigt der niedrigere Effektivzins an.',
      ] },
      { heading: 'Grenzen des Effektivzinses', list: [
        'Bei variablem Zins gilt er nur unter der Annahme, dass der Zins so bleibt wie am Anfang.',
        'Angebote mit unterschiedlicher Laufzeit oder Zinsbindung lassen sich damit nicht direkt vergleichen.',
        'Sieh dir deshalb zusätzlich die Gesamtkosten in Euro an.',
      ] },
    ],
    summary: ['Nominalzins: Grundlage für Zinsen und Rate.', 'Effektivzins: Zinsen plus Kreditkosten, die bessere Vergleichszahl.', 'Zusätzlich immer die Gesamtkosten in Euro vergleichen.'],
    cta: { label: 'Kreditangebote nebeneinander vergleichen', section: 'vergleich', advanced: true },
  },
  {
    slug: 'wohnung-vermieten-rendite',
    title: 'Wohnung vermieten: So rechnest du, ob es sich lohnt',
    description: 'Bruttomietrendite, Nettomietrendite und Cashflow einfach erklärt, mit Rechenbeispiel für eine vermietete Wohnung in Österreich.',
    lead: 'Ob sich eine vermietete Wohnung rechnet, zeigt nicht die Miete allein, sondern was nach allen Kosten und der Kreditrate übrig bleibt.',
    sections: [
      { heading: 'Bruttomietrendite: der schnelle erste Blick', paragraphs: [
        'Jahresmiete geteilt durch Kaufpreis. Beispiel: 750 € Miete pro Monat ohne Betriebskosten sind 9.000 € im Jahr. Bei 200.000 € Kaufpreis ergibt das 4,5 %. Diese Zahl lässt Kaufnebenkosten und laufende Kosten weg und eignet sich nur für einen ersten Vergleich.',
      ] },
      { heading: 'Nettomietrendite: näher an der Wirklichkeit', paragraphs: ['Hier zählt die Jahresmiete nach Abzug der Kosten, die bei dir als Vermieter bleiben, geteilt durch die gesamte Investition samt Kaufnebenkosten. Typische Kosten:'], list: [
        'Rücklage für Reparaturen. Im Wohnungseigentum gilt seit 1. Jänner 2026 eine Mindestrücklage von 1,12 € pro m² und Monat.',
        'Hausverwaltung und Versicherung, soweit nicht auf den Mieter überwälzbar.',
        'Leerstand: Monate ohne Miete zwischen zwei Mietern.',
      ] },
      { heading: 'Cashflow: Was bleibt im Monat?', paragraphs: [
        'Miete minus Vermieterkosten minus Kreditrate. Beispiel: 750 € Miete, 100 € Kosten, 718,47 € Rate für 160.000 € Kredit zu 3,5 % über 30 Jahre. Es fehlen rund 68 € pro Monat, die du zuschießen musst.',
        'Ein negativer Cashflow heißt nicht automatisch, dass sich die Wohnung nicht lohnt: Mit jeder Rate sinkt die Schuld, und das ist dein Vermögensaufbau. Du musst den Fehlbetrag aber dauerhaft tragen können, auch bei Leerstand.',
      ] },
      { heading: 'Steuer nicht vergessen', paragraphs: [
        'Mieteinnahmen sind einkommensteuerpflichtig. Abziehen kannst du unter anderem die Kreditzinsen und die Abschreibung des Gebäudes mit 1,5 % pro Jahr, nicht aber die Tilgung. Umsatzsteuer fällt bis 55.000 € Jahresumsatz nicht an (Kleinunternehmerregelung).',
      ] },
    ],
    summary: ['Bruttomietrendite ist nur ein erster Blick.', 'Entscheidend sind Kosten, Leerstand und Kreditrate.', 'Ein Fehlbetrag pro Monat muss dauerhaft tragbar sein.'],
    cta: { label: 'Eigene Wohnung durchrechnen', section: 'invest', choice: 'vermieten' },
  },
];

export const findArticle = (slug: string): Article | undefined => ARTICLES.find((a) => a.slug === slug);
