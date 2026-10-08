// de-DE liefert das gewünschte Format "119.000,00 €" (de-AT stellt das €-Zeichen voran).
const eur2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const euro = (v: number) => eur2.format(v);
export const euro0 = (v: number) => eur0.format(v);
export const number2 = (v: number) => num2.format(v);
export const percent = (v: number, digits = 2) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: Math.min(1, digits), maximumFractionDigits: digits }).format(v) + ' %';
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

/** 'YYYY-MM-DD' → 'TT.MM.JJJJ'. */
export function dateDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '–';
}
const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** 'YYYY-MM-DD' → 'Oktober 2026'. */
export function monthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '–';
}
/** Laufzeit als „25 Jahre 3 Monate“. */
export function years(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y === 1 ? '1 Jahr' : `${y} Jahre`;
  const ms = m === 1 ? '1 Monat' : `${m} Monate`;
  return y === 0 ? ms : m === 0 ? ys : `${ys} ${ms}`;
}
export const signedEuro = (v: number) => `${v > 0 ? '+' : ''}${euro(v)}`;
