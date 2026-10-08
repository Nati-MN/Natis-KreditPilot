// de-DE liefert das gewünschte Format "119.000,00 €" (de-AT stellt das €-Zeichen voran).
const eur2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const euro = (v: number) => eur2.format(v);
export const euro0 = (v: number) => eur0.format(v);
export const number2 = (v: number) => num2.format(v);
export const percent = (v: number, digits = 2) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: digits }).format(v) + ' %';
export const compactEuro = (v: number) =>
  Math.abs(v) >= 1000 ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v / 1000) + ' T€' : euro0(v);

export function duration(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} Monaten`;
  if (m === 0) return `${y} Jahren`;
  return `${y} J. ${m} Mon.`;
}

/** Liest deutsche Zahleneingaben wie "119.000,50" oder "3,2". */
export function parseNumber(text: string): number {
  const t = text.trim().replace(/[€%\s]/g, '');
  if (t === '') return NaN;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t;
  return Number(normalized);
}
