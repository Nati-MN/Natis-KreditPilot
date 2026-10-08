/**
 * Kaufnebenkosten (Österreich) als Einzelposten.
 * Gesetzliche Sätze, Stand Oktober 2026: Grunderwerbsteuer 3,5 %, Grundbuch 1,1 %, Pfandrecht 1,2 %.
 * Die befristete Gebührenbefreiung (§ 25a GGG) galt nur für Hauptwohnsitze bis 500.000 € und ist mit
 * 30.6.2026 ausgelaufen. Sie wird deshalb nicht automatisch angewendet.
 */
export interface PurchaseItem {
  id: string;
  name: string;
  enabled: boolean;
  unit: 'percent' | 'euro';
  value: number;
  /** Bemessungsgrundlage für Prozentwerte. */
  base: 'price' | 'loan';
  /** Zuzüglich 20 % Umsatzsteuer. */
  vat: boolean;
  /** Anschaffungsnebenkosten (über AfA) oder Finanzierungskosten (über die Laufzeit verteilt). */
  kind: 'anschaffung' | 'finanzierung';
  hint: string;
}

export const DEFAULT_PURCHASE_ITEMS: PurchaseItem[] = [
  { id: 'grest', name: 'Grunderwerbsteuer', enabled: true, unit: 'percent', value: 3.5, base: 'price', vat: false, kind: 'anschaffung', hint: 'Gesetzlich 3,5 % des Kaufpreises.' },
  { id: 'grundbuch', name: 'Grundbuch-Eintragungsgebühr', enabled: true, unit: 'percent', value: 1.1, base: 'price', vat: false, kind: 'anschaffung', hint: 'Gesetzlich 1,1 % des Kaufpreises. Die befristete Befreiung für Hauptwohnsitze ist am 30.6.2026 ausgelaufen.' },
  { id: 'makler', name: 'Maklerprovision', enabled: true, unit: 'percent', value: 3, base: 'price', vat: true, kind: 'anschaffung', hint: 'Höchstens 3 % + 20 % USt bei Kaufpreisen über 48.448,51 €. Ohne Makler ausschalten.' },
  { id: 'vertrag', name: 'Vertragserrichtung', enabled: true, unit: 'percent', value: 1.5, base: 'price', vat: true, kind: 'anschaffung', hint: 'Richtwert 1–3 % + 20 % USt, frei vereinbar.' },
  { id: 'notar', name: 'Notarkosten / Treuhand', enabled: true, unit: 'euro', value: 600, base: 'price', vat: false, kind: 'anschaffung', hint: 'Richtwert inkl. USt. Oft schon in der Vertragserrichtung enthalten.' },
  { id: 'beglaubigung', name: 'Beglaubigungskosten', enabled: true, unit: 'euro', value: 250, base: 'price', vat: false, kind: 'anschaffung', hint: 'Richtwert für Unterschriftsbeglaubigungen.' },
  { id: 'pfandrecht', name: 'Pfandrechtseintragungsgebühr', enabled: true, unit: 'percent', value: 1.2, base: 'loan', vat: false, kind: 'finanzierung', hint: 'Gesetzlich 1,2 % des eingetragenen Pfandrechts. Banken tragen oft 120–130 % des Kredits ein.' },
  { id: 'bank', name: 'Bankbearbeitungsgebühr', enabled: true, unit: 'percent', value: 1, base: 'loan', vat: false, kind: 'finanzierung', hint: 'Richtwert. Je nach Bank 0–3 % des Kredits, verhandelbar.' },
  { id: 'bewertung', name: 'Immobilienbewertung', enabled: true, unit: 'euro', value: 400, base: 'price', vat: false, kind: 'finanzierung', hint: 'Richtwert für die Schätzung durch die Bank.' },
  { id: 'sonstige', name: 'Sonstige Kaufnebenkosten', enabled: true, unit: 'euro', value: 0, base: 'price', vat: false, kind: 'anschaffung', hint: 'Zum Beispiel Finanzierungsberater oder Übersiedlung.' },
];

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function purchaseItemAmount(item: PurchaseItem, price: number, loan: number): number {
  if (!item.enabled) return 0;
  const net = item.unit === 'percent' ? ((item.base === 'loan' ? loan : price) * item.value) / 100 : item.value;
  return r2(Math.max(0, net) * (item.vat ? 1.2 : 1));
}

export interface PurchaseCosts {
  total: number;
  acquisition: number;
  financing: number;
  lines: { id: string; name: string; amount: number }[];
}

export function purchaseCostsDetail(items: PurchaseItem[], price: number, loan: number): PurchaseCosts {
  const lines = items.map((i) => ({ id: i.id, name: i.name, amount: purchaseItemAmount(i, price, loan) }));
  const sum = (kind: PurchaseItem['kind']) => r2(items.reduce((s, i) => s + (i.kind === kind ? purchaseItemAmount(i, price, loan) : 0), 0));
  const acquisition = sum('anschaffung');
  const financing = sum('finanzierung');
  return { total: r2(acquisition + financing), acquisition, financing, lines };
}
