/** PDF-Bericht. Eigene Datei, damit die PDF-Bibliothek erst beim ersten PDF-Export geladen wird. */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPlan, pdfEuro, planTable, type Report } from './export';
import { number2 } from './format';
import type { LoanResult } from './loan';

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
