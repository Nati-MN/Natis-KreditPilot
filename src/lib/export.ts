/** Exporte: CSV, PDF-Bericht und Excel. Alle Exporte lesen dieselben Ergebnisobjekte wie die Oberfläche. */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

// ---------- PDF ----------
const ACCENT: [number, number, number] = [21, 87, 192];
const ORANGE: [number, number, number] = [224, 122, 31];
const BLUE: [number, number, number] = [47, 111, 222];

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(19, 32, 47);
  doc.text('Kredit', 14, 18);
  doc.setTextColor(...ACCENT);
  doc.text('Pilot', 14 + doc.getTextWidth('Kredit '), 18);
  doc.setTextColor(19, 32, 47);
  doc.setFontSize(13);
  doc.text(title, 14, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(subtitle, 14, 33);
}
const lastY = (doc: jsPDF, fallback: number) => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
function footer(doc: jsPDF, note: string) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    const h = doc.internal.pageSize.getHeight();
    doc.text(doc.splitTextToSize(note, doc.internal.pageSize.getWidth() - 50), 14, h - 10);
    doc.text(`Seite ${p} von ${pages}`, doc.internal.pageSize.getWidth() - 14, h - 10, { align: 'right' });
  }
}
function keyValues(doc: jsPDF, title: string, rows: [string, string][], startY: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(19, 32, 47);
  doc.text(title, 14, startY);
  autoTable(doc, {
    startY: startY + 2, body: rows.map(([k, v]) => [k, pdfEuro(v)]), theme: 'plain', styles: { fontSize: 9, cellPadding: 1.1 },
    columnStyles: { 0: { textColor: 90, cellWidth: 78 }, 1: { fontStyle: 'bold' } }, margin: { left: 14, right: 14 },
  });
  return lastY(doc, startY + 10) + 7;
}

/** Zwei einfache Vektor-Diagramme: Restschuld als Linie, Zinsen und Tilgung als gestapelte Balken je Jahr. */
function charts(doc: jsPDF, result: LoanResult, principal: number, y: number): number {
  const years = result.years;
  if (years.length === 0) return y;
  const h = 44;
  const w = 84;
  const frame = (x: number, title: string, max: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(19, 32, 47);
    doc.text(title, x, y);
    doc.setDrawColor(213, 221, 231);
    doc.setLineWidth(0.2);
    doc.line(x, y + 4, x, y + 4 + h);
    doc.line(x, y + 4 + h, x + w, y + 4 + h);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(110);
    doc.text(`max. ${number2(max)} EUR`, x + w, y, { align: 'right' });
    doc.text('0', x - 2.5, y + 4 + h);
    doc.text('Jahr 1', x, y + 8 + h);
    doc.text(`Jahr ${years.length}`, x + w, y + 8 + h, { align: 'right' });
  };
  // Restschuld
  const x1 = 16;
  frame(x1, 'Restschuld im Zeitverlauf', principal);
  doc.setDrawColor(13, 138, 130);
  doc.setLineWidth(0.6);
  const pts = [principal, ...years.map((r) => r.balance)];
  for (let i = 1; i < pts.length; i++) {
    const xa = x1 + ((i - 1) / (pts.length - 1)) * w;
    const xb = x1 + (i / (pts.length - 1)) * w;
    doc.line(xa, y + 4 + h - (pts[i - 1] / principal) * h, xb, y + 4 + h - (pts[i] / principal) * h);
  }
  // Zinsen und Tilgung
  const x2 = 112;
  const max = Math.max(...years.map((r) => r.interest + r.principal + r.extra), 1);
  frame(x2, 'Zinsen (orange) und Tilgung (blau) je Jahr', max);
  const bw = w / years.length;
  years.forEach((r, i) => {
    const hp = ((r.principal + r.extra) / max) * h;
    const hi = (r.interest / max) * h;
    doc.setFillColor(...BLUE);
    doc.rect(x2 + i * bw + bw * 0.12, y + 4 + h - hp, bw * 0.76, hp, 'F');
    doc.setFillColor(...ORANGE);
    doc.rect(x2 + i * bw + bw * 0.12, y + 4 + h - hp - hi, bw * 0.76, hi, 'F');
  });
  return y + h + 17;
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

const NOTE = 'Modellrechnung nach eigenen Angaben. Kein verbindliches Angebot und keine Beratung. Banken können anders rechnen.';

export function buildReportPdf(r: Report): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  header(doc, r.title, `Berechnung vom ${new Date().toLocaleDateString('de-AT')} · alle Beträge in EUR`);
  let y = 42;
  for (const s of r.sections) {
    if (y > 245) { doc.addPage(); y = 20; }
    y = keyValues(doc, s.title, s.rows, y);
  }
  if (y > 215) { doc.addPage(); y = 20; }
  y = charts(doc, r.result, r.principal, y);
  for (const t of r.tables) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(19, 32, 47);
    doc.text(t.title, 14, y);
    autoTable(doc, { startY: y + 2, head: [t.head], body: t.body.map((row) => row.map(pdfEuro)), styles: { fontSize: 8, cellPadding: 1.3, halign: 'right' }, headStyles: { fillColor: ACCENT, halign: 'right' }, columnStyles: { 0: { halign: 'left' } }, margin: { left: 14, right: 14, bottom: 18 } });
    y = lastY(doc, y + 10) + 8;
  }
  if (r.notes.length) {
    if (y > 235) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(19, 32, 47);
    doc.text('Rechenannahmen und Hinweise', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70);
    const lines = r.notes.flatMap((n) => doc.splitTextToSize(`• ${n}`, 180) as string[]);
    doc.text(lines, 14, y + 5);
  }
  // Tilgungsplan auf eigener Seite im Querformat
  const plan = planTable(r.result, r.view);
  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(19, 32, 47);
  doc.text(`Tilgungsplan (${r.view === 'jahr' ? 'Jahre' : 'Zahlungstermine'})`, 14, 15);
  autoTable(doc, {
    startY: 19, head: [plan.head], body: formatPlan(plan),
    styles: { fontSize: 7.5, cellPadding: 1.2, halign: 'right' }, headStyles: { fillColor: ACCENT, halign: 'right' },
    alternateRowStyles: { fillColor: [241, 244, 248] }, margin: { left: 14, right: 14, bottom: 18 },
    didParseCell: (d) => {
      const m = d.section === 'body' ? plan.marks[d.row.index] : null;
      if (m?.rateChanged) d.cell.styles.fillColor = [253, 236, 214];
      else if (m?.extra) d.cell.styles.fillColor = [223, 234, 251];
    },
  });
  footer(doc, NOTE);
  return doc.output('arraybuffer');
}

/** Einfaches Tabellen-PDF (Investment-Prognose, Kreditvergleich). */
export function pdfFromTable(title: string, summary: [string, string][], head: string[], body: string[][], note: string): ArrayBuffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: head.length > 8 ? 'landscape' : 'portrait' });
  header(doc, title, `Erstellt am ${new Date().toLocaleDateString('de-AT')} · Beträge in EUR`);
  let y = 42;
  if (summary.length) y = keyValues(doc, 'Überblick', summary, y);
  autoTable(doc, {
    startY: y, head: [head], body: body.map((row) => row.map(pdfEuro)),
    styles: { fontSize: 7.5, cellPadding: 1.3, halign: 'right' }, headStyles: { fillColor: ACCENT, halign: 'right' }, columnStyles: { 0: { halign: 'left' } },
    alternateRowStyles: { fillColor: [241, 244, 248] }, margin: { left: 14, right: 14, bottom: 18 },
  });
  footer(doc, note);
  return doc.output('arraybuffer');
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
