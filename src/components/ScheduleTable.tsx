import { useMemo, useState } from 'react';
import { buildWorkbook, csvFromTable, formatPlan, MIME, planTable, saveFile, toBlob, type PlanView, type Report } from '../lib/export';
import { euro } from '../lib/format';
import type { LoanResult } from '../lib/loan';
import { Button, Card, DateBox, Segmented, Select } from './ui';

/** Vollständiger Tilgungsplan mit Filter, Suche, Markierungen und Export. */
export function ScheduleTable({ result, report, scenarios = [] }: { result: LoanResult; report: Omit<Report, 'view'>; scenarios?: { name: string; result: LoanResult }[] }) {
  const [view, setView] = useState<PlanView>('jahr');
  const [year, setYear] = useState(0);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const table = useMemo(() => planTable(result, view), [result, view]);
  const text = useMemo(() => formatPlan(table), [table]);
  const yearCount = result.years.length;
  const activeYear = year > yearCount ? 0 : year;
  const visible = table.raw.map((_, i) => i).filter((i) => (view === 'jahr' || activeYear === 0 || table.marks[i].year === activeYear) && (view === 'jahr' || !search || table.marks[i].date.startsWith(search)));
  const showExtra = result.totalExtra > 0;
  const showFees = result.totalFees > 0;
  const hidden = new Set<string>([...(showExtra ? [] : ['Sondertilgung']), ...(showFees ? [] : ['Gebühren'])]);
  const cols = table.head.map((h, i) => ({ h, i })).filter((c) => !hidden.has(c.h));
  const hasDates = result.rows[0]?.date !== '';

  const doExport = async (kind: 'csv' | 'pdf' | 'xlsx') => {
    setMessage(null);
    try {
      const full: Report = { ...report, view };
      const blob = kind === 'csv' ? toBlob(csvFromTable(table.head, text), MIME.csv)
        : kind === 'pdf' ? toBlob((await import('../lib/pdf')).buildReportPdf(full), MIME.pdf)
        : toBlob(buildWorkbook(full, scenarios), MIME.xlsx);
      setMessage(await saveFile(`kredit-pilot-${kind === 'csv' ? `tilgungsplan-${view}` : 'bericht'}.${kind}`, blob));
    } catch {
      setMessage('Der Export konnte nicht erstellt werden.');
    }
  };

  const th = 'sticky top-0 z-10 whitespace-nowrap bg-surface2 px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted';
  const td = 'num whitespace-nowrap px-3 py-1.5 text-right';
  const color = (h: string) => (h === 'Zinsen' ? 'text-zinstext' : h === 'Tilgung' ? 'text-tilgung' : h === 'Restschuld' ? 'font-medium' : '');
  const unit = (i: number) => (table.kinds[i] === 'eur' ? ' €' : table.kinds[i] === 'rate' ? ' %' : '');
  const firstNum = view === 'jahr' ? 1 : 2;

  return (
    <Card
      title="Tilgungsplan"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Ansicht" size="sm" value={view} onChange={setView} options={[{ value: 'jahr', label: 'Jahre' }, { value: 'monat', label: 'Monate' }]} />
          <Button onClick={() => doExport('pdf')}>PDF-Bericht</Button>
          <Button onClick={() => doExport('xlsx')}>Excel</Button>
          <Button onClick={() => doExport('csv')}>CSV</Button>
        </div>
      }
    >
      {view === 'monat' && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2" htmlFor="plan-jahr">Jahr
            <Select id="plan-jahr" value={activeYear} onChange={(v) => { setYear(v); setSearch(''); }}
              options={[{ value: 0, label: 'Alle Jahre' }, ...Array.from({ length: yearCount }, (_, i) => ({ value: i + 1, label: `Jahr ${i + 1}${hasDates ? ` (${result.rows[i * 12]?.date.slice(0, 4) ?? ''})` : ''}` }))]} />
          </label>
          {hasDates && (
            <label className="flex items-center gap-2" htmlFor="plan-suche">Monat suchen
              <DateBox month id="plan-suche" value={search} min={result.rows[0].date.slice(0, 7)} max={result.endDate.slice(0, 7)} onChange={(v) => { setSearch(v); setYear(0); }} />
              {search && <button type="button" aria-label="Suche löschen" onClick={() => setSearch('')} className="rounded-lg px-2 py-1 text-muted hover:text-bad">✕</button>}
            </label>
          )}
        </div>
      )}
      {message && <p role="status" className="mb-2 text-[13px] text-muted">{message}</p>}
      <div className="max-h-[600px] overflow-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>{cols.map((c) => <th scope="col" key={c.h} className={`${th} ${c.i < firstNum ? 'text-left' : ''}`}>{c.h}</th>)}</tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={cols.length} className="px-3 py-4 text-center text-muted">In diesem Monat gibt es keine Zahlung.</td></tr>}
            {visible.map((i) => {
              const m = table.marks[i];
              return (
                <tr key={i} className={`border-t border-line ${m.rateChanged ? 'bg-accentsoft' : ''}`}>
                  {cols.map((c) => (
                    <td key={c.h} className={`${td} ${c.i < firstNum ? 'text-left' : ''} ${color(c.h)} ${c.h === 'Sondertilgung' && m.extra ? 'font-semibold text-good' : ''} ${c.h === 'Zinssatz %' && m.rateChanged ? 'font-semibold text-accent' : ''}`}>
                      {c.h === 'Sondertilgung' && !m.extra ? '–' : `${text[i][c.i]}${unit(c.i)}`}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {(view === 'jahr' || (activeYear === 0 && !search)) && (
            <tfoot>
              <tr className="border-t-2 border-line bg-surface2 font-semibold">
                {cols.map((c, n) => {
                  const total: Record<string, number> = {
                    Raten: result.totalPaid - result.totalExtra, Rate: result.totalPaid - result.totalExtra, Zinsen: result.totalInterest,
                    Tilgung: result.totalPaid - result.totalInterest - result.totalExtra, Sondertilgung: result.totalExtra,
                    Gebühren: result.rows.reduce((s, r) => s + r.fees, 0), 'Zahlungen gesamt': result.rows.reduce((s, r) => s + r.total, 0), 'Zahlung gesamt': result.rows.reduce((s, r) => s + r.total, 0),
                  };
                  return <td key={c.h} className={`${td} ${n === 0 ? 'text-left' : ''}`}>{n === 0 ? 'Summe' : c.h in total ? euro(total[c.h]) : ''}</td>;
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Blau hinterlegte Zeilen: Der Zinssatz ändert sich. Grün: Sondertilgung. {view === 'jahr' ? 'Zinssatz und Restschuld jeweils am Jahresende.' : 'Restschuld jeweils nach der Zahlung.'}
        {result.totalFees > 0 ? ' Einmalige Kreditkosten zu Beginn stehen nicht im Plan, aber in den Gesamtkosten.' : ''}
      </p>
    </Card>
  );
}
