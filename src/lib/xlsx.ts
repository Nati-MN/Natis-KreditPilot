/**
 * Kleiner Excel-Schreiber (.xlsx) ohne zusätzliche Bibliothek außer dem Zip-Packer.
 * Unterstützt Text, Zahlen mit Format, Datum und Formeln – genug für Tilgungspläne und Vergleiche.
 */
import { strToU8, zipSync } from 'fflate';

export type CellFormat = 'eur' | 'num3' | 'int' | 'date' | 'text';
export type Cell = string | number | null | { f: string } | { date: string };

export interface Sheet {
  name: string;
  /** Erste Zeile ist die Kopfzeile. */
  rows: Cell[][];
  /** Format je Spalte für Zahlen. */
  formats?: (CellFormat | undefined)[];
  widths?: number[];
  /** Index einer fett gesetzten Summenzeile (0-basiert), optional. */
  boldRow?: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const col = (i: number): string => (i >= 26 ? col(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
/** Excel-Datumswert: Tage seit 30.12.1899. */
export function excelDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(1899, 11, 30)) / 86400000) : null;
}

// Formatvorlagen: 0 Standard, 1 Kopf fett, 2 Euro, 3 drei Nachkommastellen, 4 Ganzzahl, 5 Datum, 6 Euro fett, 7 Text fett
const STYLE: Record<CellFormat, number> = { eur: 2, num3: 3, int: 4, date: 5, text: 0 };
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.000"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFEAFB"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

function sheetXml(sheet: Sheet): string {
  const cols = sheet.widths?.length ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const rows = sheet.rows.map((row, r) => {
    const bold = sheet.boldRow === r;
    const cells = row.map((cell, c) => {
      if (cell === null || cell === '') return '';
      const ref = `${col(c)}${r + 1}`;
      const fmt = sheet.formats?.[c];
      if (r === 0) return `<c r="${ref}" t="inlineStr" s="1"><is><t>${esc(String(cell))}</t></is></c>`;
      if (typeof cell === 'string') return `<c r="${ref}" t="inlineStr"${bold ? ' s="7"' : ''}><is><t xml:space="preserve">${esc(cell)}</t></is></c>`;
      if (typeof cell === 'number') {
        if (!Number.isFinite(cell)) return '';
        const s = bold && (fmt === 'eur' || !fmt) ? 6 : fmt ? STYLE[fmt] : 2;
        return `<c r="${ref}" s="${s}"><v>${cell}</v></c>`;
      }
      if ('date' in cell) {
        const d = excelDate(cell.date);
        return d === null ? '' : `<c r="${ref}" s="5"><v>${d}</v></c>`;
      }
      return `<c r="${ref}" s="${bold ? 6 : fmt ? STYLE[fmt] : 2}"><f>${esc(cell.f)}</f></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const names = sheets.map((s, i) => (s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Blatt ${i + 1}`));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES_XML),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s)); });
  return zipSync(files, { level: 6 });
}
