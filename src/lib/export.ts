/**
 * Exporte: CSV und Excel sowie die gemeinsamen Tabellen. Der PDF-Teil liegt in pdf.ts und wird erst beim Klick geladen.
 * Alle Exporte lesen dieselben Ergebnisobjekte wie die Oberfläche.
 */
import { dateDe, number2 } from './format';
import type { LoanResult } from './loan';
import { buildXlsx, type Cell, type Sheet } from './xlsx';

type Downloads = { save(req: { filename: string; data: string | Blob }): Promise<unknown> };
declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> };
  }
}

// In der Claude-Ansicht läuft das Speichern über die Plattform, sonst als normaler Browser-Download.
let downloadsPromise: Promise<Downloads | null> | null = null;
function getDownloads(): Promise<Downloads | null> {
  if (!downloadsPromise) {
    const use = typeof window !== 'undefined' ? window.claude?.use : undefined;
    downloadsPromise = use ? use('downloads').then((d) => (d as Downloads) ?? null).catch(() => null) : Promise.resolve(null);
  }
  return downloadsPromise;
}

/** Liefert eine Meldung für den Nutzer oder null, wenn nichts zu melden ist. */
export async function saveFile(filename: string, blob: Blob): Promise<string | null> {
  const downloads = await getDownloads();
  if (downloads) {
    try {
      await downloads.save({ filename, data: blob });
      return `${filename} gespeichert.`;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return null;
      if (code === 'rate_limited') return 'Es ist bereits ein Speichern-Dialog offen. Bitte kurz warten und erneut versuchen.';
      return 'Der Export ist in dieser Ansicht nicht verfügbar.';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return `${filename} wird heruntergeladen.`;
}

export const toBlob = (data: Uint8Array | ArrayBuffer | string, type: string) => new Blob([data as BlobPart], { type });
export const MIME = {
  csv: 'text/csv;charset=utf-8',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
};

/** PDF-Standardschrift kennt kein €-Zeichen. */
export const pdfEuro = (text: string) => text.replace(/\s?€/g, ' EUR');

export type PlanView = 'monat' | 'jahr';

/** Tilgungsplan als Tabelle: Rohwerte für Excel, formatierte Texte für Anzeige, CSV und PDF. */
export interface PlanTable {
  head: string[];
  /** Spaltenart: Text, Datum, Betrag, Zinssatz. */
  kinds: ('text' | 'date' | 'eur' | 'rate')[];
  raw: (string | number)[][];
  /** Zeilenmarkierungen für die Anzeige. */
  marks: { rateChanged: boolean; extra: boolean; year: number; date: string }[];
}

export function planTable(result: LoanResult, view: PlanView): PlanTable {
  if (view === 'jahr') {
    return {
      head: ['Jahr', 'Raten', 'Zinsen', 'Tilgung', 'Sondertilgung', 'Gebühren', 'Zahlungen gesamt', 'Restschuld', 'Zinssatz %'],
      kinds: ['text', 'eur', 'eur', 'eur', 'eur', 'eur', 'eur', 'eur', 'rate'],
      raw: result.years.map((y) => [y.year, y.payment, y.interest, y.principal, y.extra, y.fees, y.total, y.balance, y.rate]),
      marks: result.years.map((y) => ({ rateChanged: false, extra: y.extra > 0, year: y.year, date: '' })),
    };
  }
  // Bei viertel-, halb- oder jährlicher Zahlung nur Zahlungstermine und Monate mit Sondertilgung.
  const rows = result.rows.filter((r) => r.due || r.extra > 0);
  return {
    head: ['Nr.', 'Fälligkeit', 'Anfangsschuld', 'Zinssatz %', 'Zinsen', 'Rate', 'Tilgung', 'Sondertilgung', 'Gebühren', 'Zahlung gesamt', 'Restschuld'],
    kinds: ['text', 'date', 'eur', 'rate', 'eur', 'eur', 'eur', 'eur', 'eur', 'eur', 'eur'],
    raw: rows.map((r) => [r.month, r.date, r.opening, r.rate, r.interest, r.payment, r.principal, r.extra, r.fees, r.total, r.balance]),
    marks: rows.map((r) => ({ rateChanged: r.rateChanged, extra: r.extra > 0, year: r.year, date: r.date })),
  };
}

const rate3 = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
export function formatPlan(t: PlanTable): string[][] {
  return t.raw.map((row) => row.map((c, i) => (t.kinds[i] === 'eur' ? number2(c as number) : t.kinds[i] === 'rate' ? rate3(c as number) : t.kinds[i] === 'date' ? (c ? dateDe(c as string) : '') : String(c))));
}

/** CSV: UTF-8 mit BOM, Semikolon und Dezimalkomma, ohne Tausenderpunkte – öffnet sich in Excel und LibreOffice direkt richtig. */
export function csvFromTable(head: string[], body: string[][]): string {
  const clean = (c: string) => {
    // Tausenderpunkte nur bei echten Zahlen entfernen (ein Datum wie 01.12.2026 bleibt unverändert).
    const t = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(c) ? c.replace(/\./g, '') : c;
    // Schutz vor Formel-Injektion und Trennzeichen im Text
    const safe = /^[=+@\t\r]/.test(t) ? `'${t}` : t;
    return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [head, ...body].map((r) => r.map(clean).join(';')).join('\r\n');
}

export interface Report {
  title: string;
  /** Gruppen von Bezeichnung/Wert, z. B. Eingaben, Konditionen, Ergebnisse, Sondertilgungen. */
  sections: { title: string; rows: [string, string][] }[];
  /** Zusätzliche Tabellen, z. B. Zinsrisiko oder Szenariovergleich. */
  tables: { title: string; head: string[]; body: string[][] }[];
  notes: string[];
  result: LoanResult;
  principal: number;
  view: PlanView;
}

// ---------- Excel ----------
const kindFormat = { text: 'int', date: 'date', eur: 'eur', rate: 'num3' } as const;
function planSheet(name: string, t: PlanTable): Sheet {
  const n = t.raw.length;
  const rows: Cell[][] = [t.head, ...t.raw.map((row) => row.map((c, i) => (t.kinds[i] === 'date' ? (c ? { date: c as string } : null) : c)))];
  // Summenzeile mit Formeln für Zahlungen; Anfangs- und Restschuld werden nicht summiert.
  const noSum = new Set(['Anfangsschuld', 'Restschuld']);
  const colName = (i: number) => String.fromCharCode(65 + i);
  rows.push(t.head.map((h, i) => (i === 0 ? 'Summe' : t.kinds[i] === 'eur' && !noSum.has(h) && n > 0 ? { f: `SUM(${colName(i)}2:${colName(i)}${n + 1})` } : null)));
  return { name, rows, formats: t.kinds.map((k) => kindFormat[k]), widths: t.head.map((h) => Math.max(11, h.length + 3)), boldRow: rows.length - 1 };
}

const kvSheet = (name: string, sections: Report['sections']): Sheet => ({
  name,
  rows: [['Bezeichnung', 'Wert'], ...sections.flatMap((s) => [[s.title.toUpperCase(), null] as Cell[], ...s.rows.map(([k, v]) => [k, v] as Cell[]), [null, null] as Cell[]])],
  widths: [42, 44],
});

export function buildWorkbook(r: Report, scenarios: { name: string; result: LoanResult }[] = []): Uint8Array {
  const sheets: Sheet[] = [
    kvSheet('Eingaben und Ergebnisse', r.sections),
    planSheet('Tilgungsplan Monate', planTable(r.result, 'monat')),
    planSheet('Tilgungsplan Jahre', planTable(r.result, 'jahr')),
    ...r.tables.map((t, i) => ({ name: t.title.slice(0, 28) || `Tabelle ${i + 1}`, rows: [t.head, ...t.body] as Cell[][], widths: t.head.map((h) => Math.max(14, h.length + 3)) })),
    ...scenarios.slice(0, 10).map((s, i) => planSheet(`Szenario ${i + 1} ${s.name}`.slice(0, 31), planTable(s.result, 'jahr'))),
  ];
  return buildXlsx(sheets);
}

/** Beliebige Tabelle als Excel-Datei; Zahlentexte in deutscher Schreibweise werden zu echten Zahlen. */
export function xlsxFromTable(name: string, head: string[], body: string[][]): Uint8Array {
  const toCell = (c: string): Cell => {
    const m = /^([+-]?[\d.]+(?:,\d+)?)(?:\s?(?:€|%))?$/.exec(c.trim());
    return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : c;
  };
  return buildXlsx([{ name, rows: [head, ...body.map((row) => row.map(toCell))], widths: head.map((h) => Math.max(16, h.length + 3)) }]);
}
