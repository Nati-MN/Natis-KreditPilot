import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ExtraPanel } from './components/ExtraPanel';
import { CostsPanel, LoanSummary, RentPanel, RiskPanel, TaxPanel } from './components/InvestSettings';
import { Landing, type StartChoice } from './components/Landing';
import { Link } from './components/Link';
import { Portfolio } from './components/Portfolio';
import { Ratgeber } from './components/Ratgeber';
import { Sources } from './components/Sources';
import { ConsentBanner, isLegal, Legal, LegalLinks } from './components/Legal';
import { Scenarios } from './components/Scenarios';
import { FeesPanel, FinancePanel, LoanDetailsPanel, LoanModelPanel } from './components/Settings';
import { Badge, Button, InfoTip, NumberBox, radioKeys, ResultCard, Segmented, TwoCol } from './components/ui';
import { analyze, type Analysis } from './lib/analysis';
import { getConsent, loadAnalytics } from './lib/consent';
import type { Report } from './lib/export';
import { dateDe, euro, monthYear, percent, signedEuro, years } from './lib/format';
import { balanceAfterYears, extraEffect, hasExtras, type ExtraEffect } from './lib/loan';
import { rateScenarios } from './lib/offers';
import { ADVANCED_ONLY, DEFAULT_STATE, loadScenarios, loadState, loadTheme, normalize, pausedSettings, saveState, saveTheme, SECTIONS, type AppState, type SavedScenario, type Section, type ThemeChoice } from './lib/state';
import type { Article } from './lib/articles';
import { onNavigate } from './lib/nav';
import { applyMeta, HASH_ROUTER, readRoute, urlFor } from './lib/routes';
import logo from './logo.png';

// Diagramme, Tabellen und die großen Rechner werden erst geladen, wenn sie gebraucht werden.
// So bleibt der erste Aufruf der Startseite klein.
const charts = () => import('./components/Charts');
const loanTools = () => import('./components/LoanTools');
const tools = () => import('./components/Tools');
const investViews = () => import('./components/InvestViews');
const comparison = () => import('./components/Comparison');
const scheduleTable = () => import('./components/ScheduleTable');
const BalanceChart = lazy(() => charts().then((m) => ({ default: m.BalanceChart })));
const CostChart = lazy(() => charts().then((m) => ({ default: m.CostChart })));
const PaymentChart = lazy(() => charts().then((m) => ({ default: m.PaymentChart })));
const SplitChart = lazy(() => charts().then((m) => ({ default: m.SplitChart })));
const ExtraSimulator = lazy(() => loanTools().then((m) => ({ default: m.ExtraSimulator })));
const MilestonesPanel = lazy(() => loanTools().then((m) => ({ default: m.MilestonesPanel })));
const RateSimulator = lazy(() => loanTools().then((m) => ({ default: m.RateSimulator })));
const AffordSection = lazy(() => tools().then((m) => ({ default: m.AffordSection })));
const PoiSection = lazy(() => tools().then((m) => ({ default: m.PoiSection })));
const RefiSection = lazy(() => tools().then((m) => ({ default: m.RefiSection })));
const AdvancedInvest = lazy(() => investViews().then((m) => ({ default: m.AdvancedInvest })));
const SimpleInvest = lazy(() => investViews().then((m) => ({ default: m.SimpleInvest })));
const Comparison = lazy(() => comparison().then((m) => ({ default: m.Comparison })));
const ScheduleTable = lazy(() => scheduleTable().then((m) => ({ default: m.ScheduleTable })));
/** Lädt die Rechner im Hintergrund vor, damit der erste Klick nicht warten muss. */
const preloadCalculators = () => {
  for (const load of [charts, loanTools, tools, investViews, comparison, scheduleTable]) load().catch(() => undefined);
};
const Loading = () => <div role="status" className="rounded-card border border-line bg-surface p-6 text-center text-sm text-muted">Wird geladen …</div>;

type Tab = 'diagramme' | 'plan' | 'sondertilgung' | 'zinsen' | 'meilensteine';

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

const INTERVAL_LABEL: Record<number, string> = { 1: 'Monatliche', 3: 'Vierteljährliche', 6: 'Halbjährliche', 12: 'Jährliche' };
const TYPE_LABEL = { annuitaet: 'Annuitätenkredit', raten: 'Ratentilgung', endfaellig: 'Endfälliger Kredit' } as const;

/** Inhalt des PDF- und Excel-Berichts: dieselben Zahlen wie in der Oberfläche. */
function buildReport(a: Analysis, effect: ExtraEffect | null): Omit<Report, 'view'> {
  const s = a.s;
  const r = a.loan;
  const fixYears = Math.min(s.fixYears, s.termYears);
  const tables: Report['tables'] = [];
  if (a.variable) {
    const base = s.useReference ? Math.max(0, s.referenceRate + s.margin) : s.variableRate;
    const sc = rateScenarios(a.loanInput, fixYears, base, [{ label: 'Bleibt unverändert', delta: 0 }, { label: '+1 Prozentpunkt', delta: 1 }, { label: '+2 Prozentpunkte', delta: 2 }, { label: '−1 Prozentpunkt', delta: -1 }]);
    tables.push({ title: 'Zinsrisiko nach der Fixzinsphase', head: ['Szenario', `Zins ab Jahr ${fixYears + 1}`, 'Neue Rate', 'Gesamtzinsen', 'Unterschied'],
      body: sc.map((x) => [x.label, percent(x.rate, 3), euro(x.paymentAfterFix), euro(x.result.totalInterest), x.delta === 0 ? '–' : signedEuro(x.interestDiff)]) });
  }
  return {
    title: 'Kreditbericht',
    principal: a.fin.loan,
    result: r,
    tables,
    sections: [
      { title: 'Eingaben', rows: s.loanOnly ? [['Kreditbetrag', euro(a.fin.loan)], ['Verwendung', 'Kredit ohne Immobilienkauf']] : [
        ['Kaufpreis', euro(s.price)], ['Eigenkapital', euro(s.equity)], ['Kaufnebenkosten', euro(a.fin.costs)], ['Renovierung und Einrichtung', euro(a.fin.renovation + a.fin.furnishing)],
        ['Gesamtinvestition', euro(a.fin.totalInvestment)], ['Kreditbetrag', euro(a.fin.loan)], ['Beleihungsquote', percent(a.fin.ltv, 1)],
      ] },
      { title: 'Kreditkonditionen', rows: [
        ['Kreditart', TYPE_LABEL[s.loanType]], ['Kreditbeginn', dateDe(s.loanStart)], ['Erste Fälligkeit', dateDe(r.rows[0]?.date ?? '')],
        ['Nominalzins', a.variable ? `${percent(s.fixRate, 3)} fix für ${fixYears} Jahre, danach variabel (Annahme)` : `${percent(s.fixRate, 3)} fix`],
        ['Vertragslaufzeit', `${s.termYears} Jahre`], ['Zahlungsintervall', `${INTERVAL_LABEL[s.interval]} Zahlung`], ['Zinsmethode', s.dayCount],
        ...(s.graceMonths > 0 ? [['Tilgungsfreie Zeit', `${s.graceMonths} Monate`] as [string, string]] : []),
        ['Einmalige Kreditkosten', euro(a.loanInput.oneTimeCosts ?? 0)], ['Laufende Gebühren pro Monat', euro(a.fees)],
      ] },
      { title: 'Ergebnisse', rows: [
        [`${INTERVAL_LABEL[s.interval]} Rate`, euro(r.firstPayment)], ...(r.paymentAfterFix !== null ? [[`Rate ab Jahr ${fixYears + 1}`, euro(r.paymentAfterFix)] as [string, string]] : []),
        ['Effektiver Jahreszins', r.apr === null ? 'nicht berechenbar' : percent(r.apr, 2)], ['Gesamtzinsen', euro(r.totalInterest)], ['Gebühren gesamt', euro(r.totalFees)],
        ['Gesamtkosten (Zinsen + Gebühren)', euro(r.totalCost)], ['Tatsächliche Rückzahlungssumme', euro(r.grandTotal)], ['Laufzeit', years(r.months)],
        ['Vollständig zurückgezahlt am', r.neverRepaid ? 'wird mit dieser Rate nicht getilgt' : dateDe(r.endDate)],
      ] },
      ...(effect ? [{ title: 'Sondertilgungen', rows: [
        ['Summe der Sondertilgungen', euro(r.totalExtra)], ['Laufzeit ohne / mit', `${years(effect.baseMonths)} / ${years(r.months)}`],
        ['Zinsen ohne / mit', `${euro(effect.baseInterest)} / ${euro(r.totalInterest)}`], ['Zinsersparnis', euro(effect.interestSaved)],
        ['Entschädigung', euro(effect.prepayFees)], ['Nettoersparnis', euro(effect.netSaving)],
      ] as [string, string][] }] : []),
    ],
    notes: [
      `Zinsen je Monat = Restschuld × Nominalzins × Tagesanteil (${s.dayCount}). Alle Buchungen sind auf Cent gerundet, die letzte Rate gleicht Rundungsdifferenzen aus.`,
      'Effektivzins nach der EU-Formel aus allen Zahlungen inklusive Kreditkosten, ohne Sondertilgungen.',
      ...(a.variable ? ['Zinssätze nach der Fixzinsphase sind eigene Annahmen und keine Vorhersage. Es werden keine aktuellen Referenzzinssätze verwendet.'] : []),
      'Gebührensätze und Orientierungswerte: Österreich, Stand Oktober 2026. Banken können je nach Vertrag anders rechnen.',
    ],
  };
}

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

  // Besucherzählung nur, wenn früher zugestimmt wurde.
  useEffect(() => {
    if (getConsent() === 'ja') loadAnalytics();
  }, []);

  // Jeder Bereich hat eine eigene Adresse (/kreditrechner, /ratgeber/...). Die Zurück-Taste des Browsers
  // führt so zum vorher geöffneten Bereich statt von der Webseite weg.
  const [slug, setSlug] = useState<string | null>(() => readRoute().slug);
  useEffect(() => {
    const open = (r: { section: Section; slug: string | null }) => {
      setSlug(r.slug);
      setS((prev) => (prev.section === r.section ? prev : { ...prev, section: r.section, viewMode: ADVANCED_ONLY.includes(r.section) ? 'erweitert' : prev.viewMode }));
    };
    // Alte Adressen mit # und unbekannte Pfade auf die richtige Adresse umschreiben.
    const first = readRoute();
    if (!HASH_ROUTER && (location.pathname !== urlFor(first.section, first.slug) || location.hash)) {
      try {
        history.replaceState(null, '', urlFor(first.section, first.slug) + location.search);
      } catch {
        /* ohne Verlauf weiter */
      }
    }
    const onPop = () => open(readRoute());
    onNavigate(open);
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    // Rechner im Hintergrund vorladen, sobald der Browser Zeit hat.
    const idle = window.requestIdleCallback ? window.requestIdleCallback(preloadCalculators, { timeout: 4000 }) : window.setTimeout(preloadCalculators, 1500);
    return () => {
      onNavigate(null);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);
  const activeSlug = s.section === 'ratgeber' ? slug : null;
  useEffect(() => {
    const current = readRoute();
    if (current.section !== s.section || current.slug !== activeSlug) {
      try {
        history.pushState(null, '', urlFor(s.section, activeSlug));
      } catch {
        /* in eingebetteten Ansichten nicht erlaubt: dann ohne Verlauf */
      }
      window.scrollTo(0, 0);
    }
    applyMeta(s.section, activeSlug);
  }, [s.section, activeSlug]);

  // Eine Analyse für alles: alle Rechner arbeiten mit denselben Kreditdaten.
  const a = useMemo(() => analyze(s), [s]);
  const advanced = s.viewMode === 'erweitert';
  // In der vereinfachten Ansicht gibt es nur drei Bereiche.
  const section: Section = advanced || ['start', 'kredit', 'leistbarkeit', 'invest', 'immobilien', 'ratgeber', 'quellen'].includes(s.section) || isLegal(s.section) ? s.section : 'kredit';
  const invest = section === 'invest';
  const result = a.loan;
  const effect = useMemo(() => (hasExtras(a.loanInput.extra, a.loanInput.extraRules) ? extraEffect(a.loanInput, result) : null), [a.loanInput, result]);
  const report = useMemo(() => buildReport(a, effect), [a, effect]);
  const paused = pausedSettings(s);

  const principal = a.fin.loan;
  const variable = a.variable;
  const fixMonths = variable ? s.fixYears * 12 : s.termYears * 12;
  const balanceYear = Math.min(s.balanceYear, s.termYears);
  const restschuld = balanceAfterYears(result, balanceYear, principal);
  const contractMonths = s.termYears * 12;
  const afterFix = variable ? result.paymentAfterFix : null;
  const setView = (v: AppState['viewMode']) => patch(v === 'einfach' && ADVANCED_ONLY.includes(s.section) ? { viewMode: v, section: 'kredit' } : { viewMode: v });
  /** Einstieg von der Startseite oder aus einem Ratgebertext. */
  const choose = (c: StartChoice) => patch(c === 'kredit' ? { section: 'kredit', loanOnly: true, manualLoan: true, manualLoanAmount: s.loanOnly ? s.manualLoanAmount : 20000, termYears: s.loanOnly ? s.termYears : 7 }
    : c === 'kauf' ? { section: 'kredit', loanOnly: false, manualLoan: false, termYears: s.loanOnly ? 30 : s.termYears } : { section: 'invest' });
  const openCta = (article: Article) => {
    const c = article.cta;
    if (c.tab) setTab(c.tab);
    if (c.choice) choose(c.choice);
    else patch({ section: c.section, ...(c.advanced ? { viewMode: 'erweitert' as const } : {}) });
  };
  const reset = () => setS({ ...DEFAULT_STATE, viewMode: s.viewMode, section: s.section });
  const plain = section === 'start' || section === 'ratgeber' || section === 'quellen' || isLegal(section); // Seiten ohne Rechner-Bedienelemente
  const k = a.s.interval;
  const rateLabel = `${INTERVAL_LABEL[k]} Kreditrate`;

  const rateCard = (
    <ResultCard emphasis label={<>{rateLabel}<InfoTip term={a.s.loanType === 'raten' ? 'Ratentilgung' : a.s.loanType === 'endfaellig' ? 'Endfällig' : 'Annuität'} /></>} value={euro(result.firstPayment)}
      sub={result.paymentAfterGrace !== null
        ? <>nur Zinsen für {a.s.graceMonths} Monate, danach <strong className="num">{euro(result.paymentAfterGrace)}</strong></>
        : afterFix !== null
          ? <>ab Jahr {s.fixYears + 1}: <strong className="num">{euro(afterFix)}</strong> (Prognose)</>
          : a.s.loanType === 'raten' ? 'erste Rate, danach fallend'
          : a.s.loanType === 'endfaellig' ? `nur Zinsen, am Ende ${euro(principal)} auf einmal`
          : <>{euro((result.firstPayment * 12) / k)} pro Jahr{a.fees > 0 ? ` · plus ${euro(a.fees)} Gebühren pro Monat` : ''}</>} />
  );
  const interestCard = (
    <ResultCard tone="zins" label={<>Gesamte Zinskosten<InfoTip term="Zinsen" /></>} value={euro(result.totalInterest)}
      sub={effect && effect.interestSaved > 0 ? <span className="text-good">{euro(effect.interestSaved)} gespart durch Sondertilgung</span>
        : <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-tilgung" role="img" aria-label={`${percent(result.interestShare * 100, 1)} der Rückzahlung sind Zinsen`}><span className="bg-zins" style={{ width: `${result.interestShare * 100}%` }} /></span>} />
  );
  const totalCard = (
    <ResultCard label="Gesamtrückzahlung" value={euro(result.grandTotal)}
      sub={result.totalFees > 0 ? `${euro(principal)} Kredit + ${euro(result.totalInterest)} Zinsen + ${euro(result.totalFees)} Gebühren` : `${euro(principal)} Kredit + ${euro(result.totalInterest)} Zinsen`} />
  );
  const doneCard = (
    <ResultCard label="Schuldenfrei" value={result.neverRepaid ? 'nie' : advanced && result.endDate ? monthYear(result.endDate) : `nach ${years(result.months)}`}
      sub={result.neverRepaid ? <span className="text-bad">Die Rate deckt die Zinsen nicht.</span>
        : result.months < contractMonths ? <span className="text-good">nach {years(result.months)}, {years(contractMonths - result.months)} früher als die Vertragslaufzeit</span>
        : result.months > contractMonths ? <span className="text-bad">nach {years(result.months)}, länger als die Vertragslaufzeit</span>
        : `nach ${years(result.months)}`} />
  );

  const nav: { value: Section; label: string }[] = advanced
    ? [{ value: 'start', label: 'Start' }, { value: 'kredit', label: 'Kreditrechner' }, { value: 'vergleich', label: 'Vergleich' }, { value: 'leistbarkeit', label: 'Leistbarkeit' }, { value: 'umschuldung', label: 'Umschuldung' }, { value: 'tilgen', label: 'Tilgen oder investieren' }, { value: 'invest', label: 'Immobilie vermieten' }, { value: 'immobilien', label: 'Meine Immobilien' }]
    : [{ value: 'start', label: 'Start' }, { value: 'kredit', label: 'Kreditrechner' }, { value: 'leistbarkeit', label: 'Kann ich mir das leisten?' }, { value: 'invest', label: 'Immobilie vermieten' }, { value: 'immobilien', label: 'Meine Immobilien' }];

  const pausedBanner = paused.length > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-accentsoft px-4 py-3 text-sm">
      <span>In der vereinfachten Ansicht pausiert: {paused.join(', ')}.</span>
      <Button onClick={() => patch({ viewMode: 'erweitert' })}>Erweiterte Ansicht öffnen</Button>
    </div>
  );
  const footer = (
    <footer className="rounded-card border border-line p-4 text-[13px] leading-relaxed text-muted">
      <strong className="text-fg">Annahmen dieser Rechnung:</strong> Zinsen je Monat = Restschuld × Nominalzins × Tagesanteil, Beträge auf Cent gerundet, die letzte Rate gleicht Rundungen aus.
      Banken können je nach Vertrag anders rechnen. Variable Zinsen, Mietsteigerung, Leerstand, Renditen und Wertentwicklung sind deine eigenen Annahmen und keine Vorhersage.
      Gebühren-, Steuersätze und Orientierungswerte der Aufsicht: Österreich, Stand Oktober 2026. Steuerberechnungen sind vereinfachte Schätzungen. Kredit Pilot ersetzt kein verbindliches Angebot und keine Rechts-, Steuer- oder Anlageberatung.{' '}
      <Link to="quellen" className="font-medium text-accent underline underline-offset-2">Quellen und Annahmen ansehen</Link>
    </footer>
  );
  const credit = (
    <>
      <LegalLinks />
      <p className="text-center text-[11px] leading-snug text-muted">
        <strong>Impressum:</strong> Private, nicht kommerzielle Webseite ohne Unternehmen. Keine Werbung, keine Einnahmen. Alle Berechnungen ohne Gewähr.
      </p>
    </>
  );

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-36 pt-4 sm:px-6 lg:pb-20">
      <a href="#inhalt" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('inhalt')?.focus(); }}>Zum Inhalt springen</a>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0">
          <Link to="start" className="flex min-w-0 items-center gap-3 rounded-xl text-left">
            <img src={logo} alt="Logo von Kredit Pilot" width={48} height={48} className="h-12 w-12 shrink-0" />
            <span className="min-w-0">
              <span className="block font-display text-2xl font-bold leading-none tracking-tight">Kredit <span className="text-accent">Pilot</span></span>
              <span className="mt-1 block text-sm font-normal text-muted">Kredit, Finanzierung und Vermietung einfach verstehen</span>
            </span>
          </Link>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {!plain && <Button onClick={() => patch({ ...DEFAULT_STATE, viewMode: 'erweitert', section: 'kredit', manualLoan: true, manualLoanAmount: 119000 })}>Beispiel: 119.000 € Kredit</Button>}
          {!plain && <Button onClick={reset}>Zurücksetzen</Button>}
          <button type="button" onClick={toggleTheme} aria-pressed={dark} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent">
            {dark ? 'Heller Modus' : 'Dunkler Modus'}
          </button>
        </div>
      </header>

      <nav className="mb-4" aria-label="Rechner" hidden={plain}>
        <Segmented label="Rechner" value={section} onChange={(v) => patch({ section: v })} options={nav} />
      </nav>

      <main id="inhalt" tabIndex={-1} className="outline-none">
      {isLegal(section) && <div className="flex flex-col gap-4"><Legal page={section} onBack={() => patch({ section: 'start' })} onCleared={() => setS((prev) => ({ ...DEFAULT_STATE, viewMode: prev.viewMode, section: prev.section }))} />{credit}</div>}
      {section === 'ratgeber' && <div className="flex flex-col gap-4"><Ratgeber slug={activeSlug} onCta={openCta} />{credit}</div>}
      {section === 'quellen' && <div className="flex flex-col gap-4"><Sources onBack={() => patch({ section: 'start' })} />{credit}</div>}
      {section === 'immobilien' && (
        <div className="flex flex-col gap-4">
          <Portfolio current={s} list={projects} setList={setProjects}
            onOpen={(loaded) => setS({ ...normalize(loaded), viewMode: s.viewMode, section: 'invest' })}
            onNew={() => setS({ ...DEFAULT_STATE, viewMode: s.viewMode, section: 'invest' })} />
          {credit}
        </div>
      )}
      {section === 'start' && <div className="flex flex-col gap-4"><Landing onChoose={choose}
        onOpen={(sec, adv) => patch(adv ? { section: sec, viewMode: 'erweitert' } : { section: sec })} />{credit}</div>}
      {section === 'vergleich' && <div className="flex flex-col gap-4"><Suspense fallback={<Loading />}><Comparison s={s} patch={patch} a={a} projects={projects} /></Suspense>{footer}{credit}</div>}
      {section === 'leistbarkeit' && <div className="flex flex-col gap-4">{pausedBanner}<Suspense fallback={<Loading />}><AffordSection s={s} patch={patch} a={a} advanced={advanced} /></Suspense>{footer}{credit}</div>}
      {section === 'umschuldung' && <div className="flex flex-col gap-4"><Suspense fallback={<Loading />}><RefiSection s={s} patch={patch} a={a} /></Suspense>{footer}{credit}</div>}
      {section === 'tilgen' && <div className="flex flex-col gap-4"><Suspense fallback={<Loading />}><PoiSection s={s} patch={patch} a={a} /></Suspense>{footer}{credit}</div>}

      {(section === 'kredit' || invest) && (
        <TwoCol aside={
          <>
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
                {advanced && <LoanDetailsPanel s={s} patch={patch} a={a} />}
                {advanced && <FeesPanel s={s} patch={patch} a={a} />}
                {advanced && <ExtraPanel s={s} patch={patch} effect={effect} a={a} />}
              </>
            )}
            {advanced && <Scenarios state={s} list={projects} setList={setProjects} onLoad={(loaded) => setS({ ...normalize(loaded), viewMode: s.viewMode, section: s.section })} />}
          </>
        }>
          {pausedBanner}
          <Suspense fallback={<Loading />}>
          {invest ? (
            advanced ? <AdvancedInvest a={a} raw={s} patch={patch} projects={projects} /> : <SimpleInvest a={a} raw={s} />
          ) : principal <= 0 ? (
            <div className="rounded-card border border-line bg-surface p-6 text-center">
              <h2 className="font-display text-lg font-bold">Kein Kredit nötig</h2>
              <p className="mt-1 text-sm text-muted">Dein Eigenkapital deckt den gesamten Betrag. Senke das Eigenkapital oder erhöhe den Kaufpreis, um einen Kredit zu berechnen.</p>
            </div>
          ) : advanced ? (
            <>
              {result.neverRepaid && (
                <div role="alert" className="rounded-card border border-bad px-4 py-3 text-sm text-bad">Mit dieser Rate wird der Kredit nie zurückgezahlt, weil sie die Zinsen nicht deckt. Erhöhe die Rate unter „Kreditart und Details“.</div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rateCard}
                <ResultCard label={<>Effektiver Jahreszins<InfoTip term="Effektivzins" /></>} value={result.apr === null ? '–' : percent(result.apr, 2)}
                  sub={<>Nominalzins {percent(s.fixRate, 2)}<InfoTip term="Nominalzins" /> · Kreditkosten {euro(result.totalFees)}</>} />
                {interestCard}
                {totalCard}
                <ResultCard tone="rest" label={<>Restschuld nach<InfoTip term="Restschuld" /></>} value={euro(restschuld)}
                  sub={
                    <span className="flex flex-wrap items-center gap-2">
                      <NumberBox id="restschuld-jahr" ariaLabel="Restschuld nach wie vielen Jahren" width="w-24" value={balanceYear} min={0} max={s.termYears} unit="Jahren" onChange={(v) => patch({ balanceYear: Math.round(v) })} />
                      {variable && balanceYear > s.fixYears && <Badge>Prognose</Badge>}
                    </span>
                  } />
                {doneCard}
              </div>
              <Segmented label="Bereich" value={tab} onChange={setTab} options={[
                { value: 'diagramme', label: 'Diagramme' }, { value: 'plan', label: 'Tilgungsplan' }, { value: 'sondertilgung', label: 'Sondertilgung' }, { value: 'zinsen', label: 'Zins-Simulator' }, { value: 'meilensteine', label: 'Meilensteine' },
              ]} />
              {tab === 'diagramme' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <BalanceChart result={result} principal={principal} />
                  <SplitChart result={result} />
                  <PaymentChart result={result} fixMonths={fixMonths} variable={variable} />
                  <CostChart principal={principal} interest={result.totalInterest} fees={result.totalFees} />
                </div>
              )}
              {tab === 'plan' && <ScheduleTable result={result} report={report} scenarios={projects.slice(0, 10).map((p) => ({ name: p.name, result: analyze({ ...p.state, viewMode: 'erweitert' }).loan }))} />}
              {tab === 'sondertilgung' && <ExtraSimulator a={a} effect={effect} />}
              {tab === 'zinsen' && <RateSimulator a={a} />}
              {tab === 'meilensteine' && <MilestonesPanel a={a} raw={s} patch={patch} />}
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
                <CostChart principal={principal} interest={result.totalInterest} fees={result.totalFees} />
              </div>
            </>
          )}
          </Suspense>
          {footer}
          {credit}
        </TwoCol>
      )}

      </main>

      {/* Mobile Leiste mit der wichtigsten Zahl (nicht auf Start- und Rechtsseiten) */}
      <div hidden={plain || section === 'immobilien'} aria-hidden="true" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pt-2 lg:hidden" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-muted">{k === 1 ? 'Monatsrate' : 'Rate'}</div>
            <div className="num font-display text-xl font-bold leading-tight">{euro(result.firstPayment)}</div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[12px] text-muted">{invest ? 'Cashflow pro Monat' : afterFix !== null ? `ab Jahr ${s.fixYears + 1} (Prognose)` : 'Zinsen gesamt'}</div>
            <div className={`num text-base font-semibold leading-tight ${invest ? (a.month.cashflow >= 0 ? 'text-good' : 'text-bad') : ''}`}>
              {invest ? signedEuro(a.month.cashflow) : euro(afterFix ?? result.totalInterest)}
            </div>
          </div>
        </div>
      </div>

      {/* Umschalter links unten: vereinfachte oder erweiterte Ansicht */}
      <div hidden={plain} className="fixed left-3 z-30 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-4 lg:left-4">
        <div role="radiogroup" aria-label="Ansicht" onKeyDown={(e) => radioKeys(e, ['einfach', 'erweitert'] as const as AppState['viewMode'][], s.viewMode, setView)} className="inline-flex gap-1 rounded-full border border-line bg-surface p-1 shadow-lg">
          {([['einfach', 'Vereinfachte Ansicht'], ['erweitert', 'Erweiterte Ansicht']] as const).map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={s.viewMode === value} tabIndex={s.viewMode === value ? 0 : -1} onClick={() => setView(value)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${s.viewMode === value ? 'bg-accent text-accentfg' : 'text-muted hover:text-fg'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ConsentBanner />
    </div>
  );
}
