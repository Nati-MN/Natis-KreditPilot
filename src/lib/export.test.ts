import { describe, expect, it } from 'vitest';
import { analyze } from './analysis';
import { buildWorkbook, csvFromTable, formatPlan, planTable, xlsxFromTable, type Report } from './export';
import { buildReportPdf } from './pdf';
import { round2 } from './loan';
import { DEFAULT_STATE, type AppState } from './state';
import { excelDate } from './xlsx';

const state: AppState = {
  ...DEFAULT_STATE, viewMode: 'erweitert', mode: 'variabel', loanStart: '2026-11-01', fees: { accountMonthly: 6, insuranceMonthly: 0, otherOneTime: 0 },
  extraRules: [{ id: 'a', label: 'Bonus', interval: 'jaehrlich', unit: 'euro', amount: 2000, from: 12, to: null }],
};
const a = analyze(state);
const report: Report = {
  title: 'Kreditbericht', principal: a.fin.loan, result: a.loan, view: 'monat',
  sections: [{ title: 'Eingaben', rows: [['Kreditbetrag', '89.000,00 €'], ['Zinssatz', '3,2 %']] }, { title: 'Ergebnisse', rows: [['Monatsrate', '384,90 €']] }],
  tables: [{ title: 'Zinsrisiko', head: ['Szenario', 'Rate'], body: [['+1 Prozentpunkt', '450,00 €']] }],
  notes: ['Monatliche Zahlung, Zinsmethode 30/360.'],
};

describe('Exporte', () => {
  it('Tilgungsplan-Tabelle stimmt mit dem Ergebnisobjekt überein', () => {
    const t = planTable(a.loan, 'monat');
    expect(t.raw.length).toBe(a.loan.rows.length);
    expect(t.raw[0][1]).toBe('2026-12-01');
    expect(t.raw[0][2]).toBe(89000);
    const sumCol = (i: number) => round2(t.raw.reduce((s, r) => s + (r[i] as number), 0));
    expect(sumCol(4)).toBe(a.loan.totalInterest);
    expect(sumCol(7)).toBe(a.loan.totalExtra);
    expect(sumCol(9)).toBe(round2(a.loan.grandTotal - (a.loanInput.oneTimeCosts ?? 0)));
    expect(t.marks[120].rateChanged).toBe(true);
    expect(t.marks[11].extra).toBe(true);
    const y = planTable(a.loan, 'jahr');
    expect(round2(y.raw.reduce((s, r) => s + (r[2] as number), 0))).toBe(a.loan.totalInterest);
    expect(formatPlan(t)[0][1]).toBe('01.12.2026');
    expect(formatPlan(t)[0][2]).toBe('89.000,00');
  });
  it('CSV: BOM, Semikolon, Dezimalkomma, keine Formel-Injektion', () => {
    const t = planTable(a.loan, 'monat');
    const csv = csvFromTable(t.head, formatPlan(t));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines.length).toBe(t.raw.length + 1);
    expect(lines[1].split(';')[1]).toBe('01.12.2026');
    expect(lines[1].split(';')[2]).toBe('89000,00');
    expect(lines[1].split(';').length).toBe(11);
    expect(csvFromTable(['a'], [['=SUM(A1)'], ['x;y'], ['sagt "hallo"']]).split('\r\n').slice(1)).toEqual(["'=SUM(A1)", '"x;y"', '"sagt ""hallo"""']);
  });
  it('Excel: gültige Zip-Datei mit Blättern', () => {
    const bytes = buildWorkbook(report, [{ name: 'Wohnung A', result: a.loan }]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(5000);
    expect(excelDate('2026-12-01')).toBe(46357);
    expect(xlsxFromTable('Vergleich', ['Wert', 'A'], [['Rate', '1.234,56 €'], ['Zins', '3,2 %']]).length).toBeGreaterThan(500);
  });
  it('PDF-Bericht wird erzeugt', () => {
    const pdf = new Uint8Array(buildReportPdf(report));
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(20000);
  });
});
