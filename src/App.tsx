import { useEffect, useMemo, useState } from 'react';
import { BalanceChart, CostChart, PaymentChart, SplitChart } from './components/Charts';
import { Comparison } from './components/Comparison';
import { ExtraPanel } from './components/ExtraPanel';
import { ScheduleTable } from './components/ScheduleTable';
import { Scenarios } from './components/Scenarios';
import { FinancePanel, LoanModelPanel } from './components/Settings';
import { Badge, Button, InfoTip, NumberBox, ResultCard, Segmented } from './components/ui';
import { duration, euro, percent } from './lib/format';
import { balanceAfterYears, calculateLoan, extraEffect, hasExtras } from './lib/loan';
import { DEFAULT_STATE, loadState, loadTheme, loanAmount, saveState, saveTheme, toLoanInput, type AppState, type ThemeChoice } from './lib/state';

type Tab = 'diagramme' | 'plan' | 'vergleich';

function useTheme(): [boolean, () => void] {
  const [choice, setChoice] = useState<ThemeChoice>(() => loadTheme());
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // Ohne eigene Wahl bleibt das Attribut unberührt und die Seite folgt dem System.
  useEffect(() => {
    if (choice) document.documentElement.setAttribute('data-theme', choice);
  }, [choice]);
  const attr = document.documentElement.getAttribute('data-theme');
  const dark = choice ? choice === 'dark' : attr ? attr === 'dark' : systemDark;
  return [dark, () => {
    const next: ThemeChoice = dark ? 'light' : 'dark';
    setChoice(next);
    saveTheme(next);
  }];
}

export default function App() {
  const [s, setS] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<Tab>('diagramme');
  const [dark, toggleTheme] = useTheme();
  const patch = (p: Partial<AppState>) => setS((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    const t = setTimeout(() => saveState(s), 300);
    return () => clearTimeout(t);
  }, [s]);

  const input = useMemo(() => toLoanInput(s), [s]);
  const result = useMemo(() => calculateLoan(input), [input]);
  const effect = useMemo(() => (hasExtras(input.extra) ? extraEffect(input, result) : null), [input, result]);

  const principal = loanAmount(s);
  const variable = s.mode === 'variabel' && s.fixYears < s.termYears;
  const fixMonths = variable ? s.fixYears * 12 : s.termYears * 12;
  const balanceYear = Math.min(s.balanceYear, s.termYears);
  const restschuld = balanceAfterYears(result, balanceYear, principal);
  const paidOffEarly = result.months < s.termYears * 12;
  const afterFix = variable ? result.paymentAfterFix : null;

  const summary: [string, string][] = [
    ['Kreditbetrag', `${euro(principal)}`.replace('€', 'EUR')],
    ['Laufzeit', `${s.termYears} Jahre (getilgt nach ${duration(result.months)})`],
    ['Kreditmodell', variable ? `${s.fixYears} Jahre Fixzins ${percent(s.fixRate)}, danach variabel (Annahme)` : `Fixzins ${percent(s.fixRate)}`],
    ['Monatsrate am Anfang', euro(result.firstPayment).replace('€', 'EUR')],
    ['Gesamte Zinskosten', euro(result.totalInterest).replace('€', 'EUR')],
    ['Gesamtrückzahlung', euro(result.totalPaid).replace('€', 'EUR')],
  ];

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-28 pt-4 sm:px-6 lg:pb-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-none tracking-tight">
            Kredit<span className="text-accent">Pilot</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Immobilienkredit einfach verstehen</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => patch({ ...DEFAULT_STATE, manualLoan: true, manualLoanAmount: 119000 })}>Beispiel: 119.000 € Kredit</Button>
          <Button onClick={() => setS(DEFAULT_STATE)}>Zurücksetzen</Button>
          <button type="button" onClick={toggleTheme} aria-pressed={dark} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent">
            {dark ? 'Heller Modus' : 'Dunkler Modus'}
          </button>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          <FinancePanel s={s} patch={patch} />
          <LoanModelPanel s={s} patch={patch} />
          <ExtraPanel extra={s.extra} termYears={s.termYears} effect={effect} onChange={(extra) => patch({ extra })} />
          <Scenarios state={s} onLoad={(loaded) => setS({ ...DEFAULT_STATE, ...loaded })} />
        </aside>

        <main className="flex min-w-0 flex-col gap-4">
          {principal <= 0 ? (
            <div className="rounded-card border border-line bg-surface p-6 text-center">
              <h2 className="font-display text-lg font-bold">Kein Kredit nötig</h2>
              <p className="mt-1 text-sm text-muted">Dein Eigenkapital deckt den gesamten Betrag. Senke das Eigenkapital oder erhöhe den Kaufpreis, um einen Kredit zu berechnen.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ResultCard emphasis label={<>Monatliche Kreditrate<InfoTip term="Annuität" /></>} value={euro(result.firstPayment)}
                  sub={afterFix !== null
                    ? <>ab Jahr {s.fixYears + 1}: <strong className="num">{euro(afterFix)}</strong> (Prognose) · {euro(result.firstPayment * 12)} pro Jahr</>
                    : <>{euro(result.firstPayment * 12)} pro Jahr{s.extra.monthlyAmount > 0 ? ` · plus ${euro(s.extra.monthlyAmount)} Sondertilgung` : ''}</>} />
                <ResultCard tone="zins" label={<>Gesamte Zinskosten<InfoTip term="Zinsen" /></>} value={euro(result.totalInterest)}
                  sub={effect && effect.interestSaved > 0 ? <span className="text-good">{euro(effect.interestSaved)} gespart durch Sondertilgung</span> : 'über die gesamte Laufzeit'} />
                <ResultCard label="Gesamtrückzahlung" value={euro(result.totalPaid)} sub={`${euro(principal)} Kredit + ${euro(result.totalInterest)} Zinsen`} />
                <ResultCard tone="rest" label={<>Restschuld nach<InfoTip term="Restschuld" /></>} value={euro(restschuld)}
                  sub={
                    <span className="flex flex-wrap items-center gap-2">
                      <NumberBox id="restschuld-jahr" ariaLabel="Restschuld nach wie vielen Jahren" width="w-24" value={balanceYear} min={0} max={s.termYears} unit="Jahren" onChange={(v) => patch({ balanceYear: Math.round(v) })} />
                      {variable && balanceYear > s.fixYears && <Badge>Prognose</Badge>}
                    </span>
                  } />
                <ResultCard label="Zinsanteil an der Rückzahlung" value={percent(result.interestShare * 100, 1)}
                  sub={
                    <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-tilgung" role="img" aria-label={`${percent(result.interestShare * 100, 1)} Zinsen, Rest Tilgung`}>
                      <span className="bg-zins" style={{ width: `${result.interestShare * 100}%` }} />
                    </span>
                  } />
                <ResultCard label="Kredit vollständig zurückgezahlt" value={`nach ${duration(result.months)}`}
                  sub={paidOffEarly ? <span className="text-good">{duration(s.termYears * 12 - result.months).replace('Jahren', 'Jahre').replace('Monaten', 'Monate')} früher als geplant</span> : `${result.months} Monatsraten`} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Segmented label="Bereich" value={tab} onChange={setTab}
                  options={[{ value: 'diagramme', label: 'Diagramme' }, { value: 'plan', label: 'Tilgungsplan' }, { value: 'vergleich', label: 'Kreditvergleich' }]} />
              </div>

              {tab === 'diagramme' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <BalanceChart result={result} principal={principal} />
                  <SplitChart result={result} />
                  <PaymentChart result={result} fixMonths={fixMonths} variable={variable} />
                  <CostChart principal={principal} interest={result.totalInterest} />
                </div>
              )}
              {tab === 'plan' && <ScheduleTable result={result} summary={summary} />}
              {tab === 'vergleich' && <Comparison s={s} patch={patch} />}
            </>
          )}

          <footer className="rounded-card border border-line p-4 text-[13px] leading-relaxed text-muted">
            <strong className="text-fg">Annahmen dieser Rechnung:</strong> Annuitätendarlehen mit monatlicher Zahlung, Monatszins = Nominalzins pro Jahr ÷ 12, Beträge auf Cent gerundet, letzte Rate als Ausgleichsrate.
            Banken können je nach Vertrag anders rechnen (z. B. taggenaue Zinsen, Quartalsabschluss, Kontoführungs- und Bearbeitungsgebühren).
            Variable Zinssätze sind deine eigenen Annahmen und keine Vorhersage. KreditPilot ersetzt kein verbindliches Angebot und keine Beratung.
          </footer>
        </main>
      </div>

      {principal > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-2 lg:hidden" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12px] text-muted">Monatsrate</div>
              <div className="num font-display text-xl font-bold leading-tight">{euro(result.firstPayment)}</div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[12px] text-muted">{afterFix !== null ? `ab Jahr ${s.fixYears + 1} (Prognose)` : 'Zinsen gesamt'}</div>
              <div className="num text-base font-semibold leading-tight">{euro(afterFix ?? result.totalInterest)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
