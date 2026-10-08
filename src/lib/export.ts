import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { number2 } from './format';
import type { LoanResult } from './loan';

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

export type PlanView = 'monat' | 'jahr';

function tableData(result: LoanResult, view: PlanView): { head: string[]; body: string[][] } {
  if (view === 'jahr') {
    return {
      head: ['Jahr', 'Zahlungen', 'Zinsen', 'Tilgung', 'Sondertilgung', 'Restschuld', 'Zinssatz %'],
      body: result.years.map((y) => [
        String(y.year), number2(y.payment), number2(y.interest), number2(y.principal), number2(y.extra), number2(y.balance), number2(y.rate),
      ]),
    };
  }
  return {
    head: ['Monat', 'Jahr', 'Monatsrate', 'Zinsen', 'Tilgung', 'Sondertilgung', 'Restschuld', 'Zinssatz %'],
    body: result.rows.map((r) => [
      String(r.month), String(r.year), number2(r.payment), number2(r.interest), number2(r.principal), number2(r.extra), number2(r.balance), number2(r.rate),
    ]),
  };
}

export function buildCsv(result: LoanResult, view: PlanView): Blob {
  const { head, body } = tableData(result, view);
  // Semikolon + Dezimalkomma: öffnet sich in deutschsprachigem Excel direkt richtig.
  const lines = [head, ...body.map((row) => row.map((c) => c.replace(/\./g, '')))].map((r) => r.join(';'));
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

export function buildPdf(result: LoanResult, view: PlanView, summary: [string, string][]): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('KreditPilot – Tilgungsplan', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Erstellt am ${new Date().toLocaleDateString('de-AT')} · Beträge in EUR · ${view === 'jahr' ? 'Jahresansicht' : 'Monatsansicht'}`, 14, 24);
  autoTable(doc, {
    startY: 29,
    body: summary,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 0: { textColor: 90, cellWidth: 60 }, 1: { fontStyle: 'bold' } },
  });
  const { head, body } = tableData(result, view);
  const startY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60) + 5;
  autoTable(doc, {
    startY,
    head: [head],
    body,
    styles: { fontSize: 8, cellPadding: 1.4, halign: 'right' },
    headStyles: { fillColor: [21, 87, 192], halign: 'right' },
    alternateRowStyles: { fillColor: [241, 244, 248] },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        'Modellrechnung: monatliche Zahlung, Nominalzins p.a. / 12. Variable Zinsen sind Annahmen, keine Prognose. Banken können anders rechnen.',
        14,
        doc.internal.pageSize.getHeight() - 8,
      );
    },
  });
  return doc.output('blob');
}
