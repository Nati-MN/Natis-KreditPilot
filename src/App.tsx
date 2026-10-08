import { useEffect, useMemo, useState } from 'react';
import { BalanceChart, CostChart, PaymentChart, SplitChart } from './components/Charts';
import { Comparison } from './components/Comparison';
import { ExtraPanel } from './components/ExtraPanel';
import { CostsPanel, LoanSummary, RentPanel, RiskPanel, TaxPanel } from './components/InvestSettings';
import { AdvancedInvest, SimpleInvest } from './components/InvestViews';
import { ScheduleTable } from './components/ScheduleTable';
import { Scenarios } from './components/Scenarios';
import { FinancePanel, LoanModelPanel } from './components/Settings';
import { Badge, Button, InfoTip, NumberBox, ResultCard, Segmented } from './components/ui';
import { analyze } from './lib/analysis';
import logo from './logo.png';
import { pdfEuro } from './lib/export';
import { duration, euro, percent } from './lib/format';
import { balanceAfterYears, extraEffect, hasExtras } from './lib/loan';
import { DEFAULT_STATE, loadScenarios, loadState, loadTheme, normalize, pausedSettings, saveState, saveTheme, type AppState, type SavedScenario, type ThemeChoice } from './lib/state';

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

const signed = (v: number) => `${v > 0 ? '+' : ''}${euro(v)}`;

export default function App() {
  const [s, setS] = useState<AppState>(() => loadState());
  const [projects, setProjects] = useState<SavedScenario[]>(() => loadScenarios());
  const [tab, setTab] = useState<Tab>('diagramme');
  const [dark, toggleTheme] = useTheme();
  const patch = (p: Partial<AppState>) => setS((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    const t = setTimeout(() => saveState(s), 300);
    return () => clearTimeout(t);
  }, [s]);

  // Eine Analyse für alles: Kreditrechner und Investment arbeiten mit denselben Kreditdaten.
  const a = useMemo(() => analyze(s), [s]);
  const advanced = s.viewMode === 'erweitert';
  const invest = s.section === 'invest';
  const result = a.loan;
  const effect = useMemo(() => (hasExtras(a.loanInput.extra) ? extraEffect(a.loanInput, result) : null), [a.loanInput, result]);
  const paused = pausedSettings(s);

  const principal = a.fin.loan;
  const variable = a.variable;
  const fixMonths = variable ? s.fixYears * 12 : s.termYears * 12;
  const balanceYear = Math.min(s.balanceYear, s.termYears);
  const restschuld = balanceAfterYears(result, balanceYear, principal);
  const paidOffEarly = result.months < s.termYears * 12;
  const afterFix = variable ? result.paymentAfterFix : null;
  const reset = () => setS({ ...DEFAULT_STATE, viewMode: s.viewMode, section: s.section });

  const summary: [string, string][] = [
    ['Kreditbetrag', pdfEuro(euro(principal))],
    ['Laufzeit', `${s.termYears} Jahre (getilgt nach ${duration(result.months)})`],
    ['Kreditmodell', variable ? `${s.fixYears} Jahre Fixzins ${percent(s.fixRate)}, danach variabel (Annahme)` : `Fixzins ${percent(s.fixRate)}`],
    ['Monatsrate am Anfang', pdfEuro(euro(result.firstPayment))],
    ['Gesamte Zinskosten', pdfEuro(euro(result.totalInterest))],
    ['Gesamtrückzahlung', pdfEuro(euro(result.totalPaid))],
  ];

  const rateCard = (
    <ResultCard emphasis label={<>Monatliche Kreditrate<InfoTip term="Annuität" /></>} value={euro(result.firstPayment)}
      sub={afterFix !== null
        ? <>ab Jahr {s.fixYears + 1}: <strong className="num">{euro(afterFix)}</strong> (Prognose) · {euro(result.firstPayment * 12)} pro Jahr</>
        : <>{euro(result.firstPayment * 12)} pro Jahr{a.s.extra.monthlyAmount > 0 ? ` · plus ${euro(a.s.extra.monthlyAmount)} Sondertilgung` : ''}</>} />
  );
  const interestCard = (
    <ResultCard tone="zins" label={<>Gesamte Zinskosten<InfoTip term="Zinsen" /></>} value={euro(result.totalInterest)}
      sub={effect && effect.interestSaved > 0 ? <span className="text-good">{euro(effect.interestSaved)} gespart durch Sondertilgung</span> : 'über die gesamte Laufzeit'} />
  );
  const totalCard = <ResultCard label="Gesamtrückzahlung" value={euro(result.totalPaid)} sub={`${euro(principal)} Kredit + ${euro(result.totalInterest)} Zinsen`} />;
  const doneCard = (
    <ResultCard label="Kredit vollständig zurückgezahlt" value={`nach ${duration(result.months)}`}
      sub={paidOffEarly ? <span className="text-good">{duration(s.termYears * 12 - result.months).replace('Jahren', 'Jahre').replace('Monaten', 'Monate')} früher als geplant</span> : `${result.months} Monatsraten`} />
  );

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-36 pt-4 sm:px-6 lg:pb-20">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="" width={48} height={48} className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold leading-none tracking-tight">
              Kredit <span className="text-accent">Pilot</span>
            </h1>
            <p className="mt-1 text-sm text-muted">Immobilienkredit und Vermietung einfach verstehen</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => patch({ ...DEFAULT_STATE, viewMode: 'erweitert', section: s.section, manualLoan: true, manualLoanAmount: 119000 })}>Beispiel: 119.000 € Kredit</Button>
          <Button onClick={reset}>Zurücksetzen</Button>
          <button type="button" onClick={toggleTheme} aria-pressed={dark} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent">
            {dark ? 'Heller Modus' : 'Dunkler Modus'}
          </button>
        </div>
      </header>

      <nav className="mb-4" aria-label="Rechner">
        <Segmented label="Rechner" value={s.section} onChange={(v) => patch({ section: v })}
          options={[{ value: 'kredit', label: 'Kreditrechner' }, { value: 'invest', label: 'Immobilie vermieten' }]} />
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-16 lg:pr-1">
          <FinancePanel s={s} patch={patch} advanced={advanced} invest={invest} />
          {invest ? (
            <>
              <RentPanel s={s} patch={patch} advanced={advanced} a={a} />
              <CostsPanel s={s} patch={patch} advanced={advanced} a={a} />
              {advanced && <RiskPanel s={s} patch={patch} />}
              {advanced && <TaxPanel s={s} patch={patch} />}
              <LoanSummary a={a} onEdit={() => patch({ section: 'kredit' })} />
            </>
          ) : (
            <>
              <LoanModelPanel s={s} patch={patch} advanced={advanced} />
              {advanced && <ExtraPanel extra={s.extra} termYears={s.termYears} effect={effect} onChange={(extra) => patch({ extra })} />}
            </>
          )}
          {advanced && <Scenarios state={s} list={projects} setList={setProjects} onLoad={(loaded) => setS({ ...normalize(loaded), viewMode: s.viewMode, section: s.section })} />}
        </aside>

        <main className="flex min-w-0 flex-col gap-4">
          {paused.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-accentsoft px-4 py-3 text-sm">
              <span>In der vereinfachten Ansicht pausiert: {paused.join(', ')}.</span>
              <Button onClick={() => patch({ viewMode: 'erweitert' })}>Erweiterte Ansicht öffnen</Button>
            </div>
          )}

          {invest ? (
            advanced ? <AdvancedInvest a={a} raw={s} patch={patch} projects={projects} /> : <SimpleInvest a={a} raw={s} />
          ) : principal <= 0 ? (
            <div className="rounded-card border border-line bg-surface p-6 text-center">
              <h2 className="font-display text-lg font-bold">Kein Kredit nötig</h2>
              <p className="mt-1 text-sm text-muted">Dein Eigenkapital deckt den gesamten Betrag. Senke das Eigenkapital oder erhöhe den Kaufpreis, um einen Kredit zu berechnen.</p>
            </div>
          ) : advanced ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rateCard}
                {interestCard}
                {totalCard}
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
                {doneCard}
              </div>
              <Segmented label="Bereich" value={tab} onChange={setTab}
                options={[{ value: 'diagramme', label: 'Diagramme' }, { value: 'plan', label: 'Tilgungsplan' }, { value: 'vergleich', label: 'Kreditvergleich' }]} />
              {tab === 'diagramme' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <BalanceChart result={result} principal={principal} />
                  <SplitChart result={result} />
                  <PaymentChart result={result} fixMonths={fixMonths} variable={variable} />
                  <CostChart principal={principal} interest={result.totalInterest} />
                </div>
              )}
              {tab === 'plan' && <ScheduleTable result={result} summary={summary} />}
              {tab === 'vergleich' && <Comparison s={a.s} patch={patch} />}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rateCard}
                {interestCard}
                {totalCard}
                {doneCard}
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <BalanceChart result={result} principal={principal} />
                <SplitChart result={result} />
                {variable && <PaymentChart result={result} fixMonths={fixMonths} variable={variable} />}
                <CostChart principal={principal} interest={result.totalInterest} />
              </div>
            </>
          )}

          <footer className="rounded-card border border-line p-4 text-[13px] leading-relaxed text-muted">
            <strong className="text-fg">Annahmen dieser Rechnung:</strong> Annuitätendarlehen mit monatlicher Zahlung, Monatszins = Nominalzins pro Jahr ÷ 12, Beträge auf Cent gerundet.
            Banken können je nach Vertrag anders rechnen. Variable Zinsen, Mietsteigerung, Leerstand und Wertentwicklung sind deine eigenen Annahmen und keine Vorhersage.
            Gebühren- und Steuersätze: Österreich, Stand Oktober 2026. Die Steuerberechnung ist eine vereinfachte Schätzung. Kredit Pilot ersetzt kein verbindliches Angebot und keine Rechts-, Steuer- oder Anlageberatung.
          </footer>
          <p className="text-center text-[12px] text-muted">This is a Website created by: "Nati Man"</p>
          <p className="text-center text-[11px] leading-snug text-muted">
            <strong>Impressum:</strong> Private, nicht kommerzielle Webseite ohne Unternehmen. Keine Werbung, keine Einnahmen. Alle Berechnungen ohne Gewähr.
          </p>
        </main>
      </div>

      {/* Mobile Leiste mit der wichtigsten Zahl */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-2 lg:hidden" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-muted">Monatsrate</div>
            <div className="num font-display text-xl font-bold leading-tight">{euro(result.firstPayment)}</div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[12px] text-muted">{invest ? 'Cashflow pro Monat' : afterFix !== null ? `ab Jahr ${s.fixYears + 1} (Prognose)` : 'Zinsen gesamt'}</div>
            <div className={`num text-base font-semibold leading-tight ${invest ? (a.month.cashflow >= 0 ? 'text-good' : 'text-bad') : ''}`}>
              {invest ? signed(a.month.cashflow) : euro(afterFix ?? result.totalInterest)}
            </div>
          </div>
        </div>
      </div>

      {/* Umschalter links unten: vereinfachte oder erweiterte Ansicht */}
      <div className="fixed left-3 z-30 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-4 lg:left-4">
        <div role="radiogroup" aria-label="Ansicht" className="inline-flex gap-1 rounded-full border border-line bg-surface p-1 shadow-lg">
          {([['einfach', 'Vereinfachte Ansicht'], ['erweitert', 'Erweiterte Ansicht']] as const).map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={s.viewMode === value} onClick={() => patch({ viewMode: value })}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${s.viewMode === value ? 'bg-accent text-accentfg' : 'text-muted hover:text-fg'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
