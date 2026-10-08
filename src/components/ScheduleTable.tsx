import { useState } from 'react';
import { buildCsv, buildPdf, saveFile, type PlanView } from '../lib/export';
import { euro, percent } from '../lib/format';
import type { LoanResult } from '../lib/loan';
import { Button, Card, Segmented } from './ui';

export function ScheduleTable({ result, summary }: { result: LoanResult; summary: [string, string][] }) {
  const [view, setView] = useState<PlanView>('jahr');
  const [message, setMessage] = useState<string | null>(null);
  const showExtra = result.totalExtra > 0;
  const doExport = async (kind: 'csv' | 'pdf') => {
    setMessage(null);
    try {
      const blob = kind === 'csv' ? buildCsv(result, view) : buildPdf(result, view, summary);
      setMessage(await saveFile(`kreditpilot-tilgungsplan-${view}.${kind}`, blob));
    } catch {
      setMessage('Der Export konnte nicht erstellt werden.');
    }
  };
  const th = 'sticky top-0 z-10 bg-surface2 px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted first:text-left';
  const td = 'num whitespace-nowrap px-3 py-1.5 text-right first:text-left';
  return (
    <Card
      title="Tilgungsplan"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Ansicht" size="sm" value={view} onChange={setView} options={[{ value: 'jahr', label: 'Jahre' }, { value: 'monat', label: 'Monate' }]} />
          <Button onClick={() => doExport('csv')}>CSV exportieren</Button>
          <Button onClick={() => doExport('pdf')}>PDF exportieren</Button>
        </div>
      }
    >
      {message && <p role="status" className="mb-2 text-[13px] text-muted">{message}</p>}
      <div className="max-h-[560px] overflow-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {view === 'monat' && <th className={th}>Monat</th>}
              <th className={th}>Jahr</th>
              <th className={th}>{view === 'monat' ? 'Monatsrate' : 'Zahlungen'}</th>
              <th className={th}>Zinsen</th>
              <th className={th}>Tilgung</th>
              {showExtra && <th className={th}>Sondertilgung</th>}
              <th className={th}>Restschuld</th>
              <th className={th}>Zinssatz</th>
            </tr>
          </thead>
          <tbody>
            {view === 'monat'
              ? result.rows.map((r) => (
                  <tr key={r.month} className={`border-t border-line ${r.month % 12 === 0 ? 'border-b-2' : ''}`}>
                    <td className={td}>{r.month}</td>
                    <td className={td}>{r.year}</td>
                    <td className={td}>{euro(r.payment)}</td>
                    <td className={`${td} text-zins`}>{euro(r.interest)}</td>
                    <td className={`${td} text-tilgung`}>{euro(r.principal)}</td>
                    {showExtra && <td className={td}>{r.extra > 0 ? euro(r.extra) : '–'}</td>}
                    <td className={`${td} font-medium`}>{euro(r.balance)}</td>
                    <td className={td}>{percent(r.rate, 3)}</td>
                  </tr>
                ))
              : result.years.map((y) => (
                  <tr key={y.year} className="border-t border-line">
                    <td className={td}>{y.year}</td>
                    <td className={td}>{euro(y.payment)}</td>
                    <td className={`${td} text-zins`}>{euro(y.interest)}</td>
                    <td className={`${td} text-tilgung`}>{euro(y.principal)}</td>
                    {showExtra && <td className={td}>{y.extra > 0 ? euro(y.extra) : '–'}</td>}
                    <td className={`${td} font-medium`}>{euro(y.balance)}</td>
                    <td className={td}>{percent(y.rate, 3)}</td>
                  </tr>
                ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-surface2 font-semibold">
              <td className={td} colSpan={view === 'monat' ? 2 : 1}>Summe</td>
              <td className={td}>{euro(result.totalPaid - result.totalExtra)}</td>
              <td className={td}>{euro(result.totalInterest)}</td>
              <td className={td}>{euro(result.totalPaid - result.totalInterest - result.totalExtra)}</td>
              {showExtra && <td className={td}>{euro(result.totalExtra)}</td>}
              <td className={td}>{euro(0)}</td>
              <td className={td} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-[13px] text-muted">{view === 'jahr' ? 'Zinssatz und Restschuld jeweils am Jahresende.' : 'Restschuld jeweils nach der Zahlung.'}</p>
    </Card>
  );
}
