import { DEFAULT_COSTS, DEFAULT_RENT, initialCosts, type CostItem, type RentAdjustment, type RentState, type TaxState } from './invest';
import { hasExtras, NO_EXTRAS, type ExtraPayments, type LoanInput, type LoanMode, type RateChange } from './loan';
import { DEFAULT_PURCHASE_ITEMS, purchaseCostsDetail, type PurchaseItem } from './purchase';

export interface CompareConfig {
  mode: LoanMode;
  fixRate: number;
  fixYears: number;
  variableRate: number;
}

export type ScenarioName = 'optimistisch' | 'realistisch' | 'pessimistisch' | 'individuell';

export interface InvestState {
  livingArea: number;
  propertyType: string;
  location: string;
  buildYear: number;
  condition: string;
  renovation: number;
  renovationTax: 'verteilt15' | 'afa';
  purchaseItems: PurchaseItem[];
  rent: RentState;
  costs: CostItem[];
  /** Kaufmonat 'YYYY-MM'; Bezugspunkt für Start- und Enddaten von Kosten. */
  startMonth: string;
  scenario: ScenarioName;
  rentGrowth: number;
  costGrowth: number;
  vacancyMonths: number;
  rentLoss: number;
  freeMonths: number;
  tenantChangeYears: number;
  tenantChangeCost: number;
  reletBrokerMonths: number;
  rentAdjustments: RentAdjustment[];
  valueGrowth: number;
  horizonYears: number;
  tax: TaxState;
  targetCashflow: number;
  targetYield: number;
  reserve: number;
}

export interface AppState {
  viewMode: 'einfach' | 'erweitert';
  section: 'kredit' | 'invest';
  price: number;
  equity: number;
  costsEnabled: boolean;
  costsMode: 'detail' | 'percent' | 'euro';
  costsPercent: number;
  costsEuro: number;
  /** Nebenkosten und Renovierung über den Kredit finanzieren. */
  costsFinanced: boolean;
  manualLoan: boolean;
  manualLoanAmount: number;
  termYears: number;
  mode: LoanMode;
  fixRate: number;
  fixYears: number;
  variableRate: number;
  rateChanges: RateChange[];
  useReference: boolean;
  referenceName: string;
  referenceRate: number;
  margin: number;
  adjustMonths: number;
  extra: ExtraPayments;
  balanceYear: number;
  compareA: CompareConfig;
  compareB: CompareConfig;
  invest: InvestState;
}

export const SCENARIOS: Record<Exclude<ScenarioName, 'individuell'>, Pick<InvestState, 'rentGrowth' | 'costGrowth' | 'vacancyMonths' | 'rentLoss' | 'tenantChangeYears' | 'valueGrowth'>> = {
  optimistisch: { rentGrowth: 3, costGrowth: 2, vacancyMonths: 0.2, rentLoss: 0, tenantChangeYears: 8, valueGrowth: 3 },
  realistisch: { rentGrowth: 2, costGrowth: 2.5, vacancyMonths: 0.5, rentLoss: 1, tenantChangeYears: 5, valueGrowth: 1.5 },
  pessimistisch: { rentGrowth: 1, costGrowth: 3.5, vacancyMonths: 1.5, rentLoss: 3, tenantChangeYears: 3, valueGrowth: -1 },
};

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const DEFAULT_INVEST: InvestState = {
  livingArea: 55,
  propertyType: 'Eigentumswohnung',
  location: '',
  buildYear: 1995,
  condition: 'Gut',
  renovation: 0,
  renovationTax: 'verteilt15',
  purchaseItems: DEFAULT_PURCHASE_ITEMS,
  rent: DEFAULT_RENT,
  costs: DEFAULT_COSTS,
  startMonth: thisMonth(),
  scenario: 'realistisch',
  ...SCENARIOS.realistisch,
  freeMonths: 0,
  tenantChangeCost: 800,
  reletBrokerMonths: 2,
  rentAdjustments: [],
  horizonYears: 30,
  tax: { enabled: false, marginalRate: 40, landShare: 40, afaRate: 1.5, accelerated: true, offsetLosses: true },
  targetCashflow: 200,
  targetYield: 4,
  reserve: 5000,
};

export const DEFAULT_STATE: AppState = {
  viewMode: 'einfach',
  section: 'kredit',
  price: 119000,
  equity: 30000,
  costsEnabled: true,
  costsMode: 'detail',
  costsPercent: 10,
  costsEuro: 12000,
  costsFinanced: false,
  manualLoan: false,
  manualLoanAmount: 119000,
  termYears: 30,
  mode: 'fix',
  fixRate: 3.2,
  fixYears: 10,
  variableRate: 4,
  rateChanges: [],
  useReference: false,
  referenceName: '3-Monats-EURIBOR',
  referenceRate: 2.5,
  margin: 1.5,
  adjustMonths: 3,
  extra: { ...NO_EXTRAS },
  balanceYear: 10,
  compareA: { mode: 'fix', fixRate: 3.2, fixYears: 10, variableRate: 4 },
  compareB: { mode: 'variabel', fixRate: 3.2, fixYears: 10, variableRate: 4 },
  invest: DEFAULT_INVEST,
};

/** Ergänzt fehlende Felder (z. B. bei Projekten aus einer älteren Version). */
export function normalize(saved: Partial<AppState> | null | undefined): AppState {
  if (!saved || typeof saved !== 'object') return DEFAULT_STATE;
  const inv: Partial<InvestState> = saved.invest ?? {};
  return {
    ...DEFAULT_STATE,
    ...saved,
    extra: { ...DEFAULT_STATE.extra, ...(saved.extra ?? {}) },
    compareA: { ...DEFAULT_STATE.compareA, ...(saved.compareA ?? {}) },
    compareB: { ...DEFAULT_STATE.compareB, ...(saved.compareB ?? {}) },
    rateChanges: Array.isArray(saved.rateChanges) ? saved.rateChanges : [],
    invest: {
      ...DEFAULT_INVEST,
      ...inv,
      tax: { ...DEFAULT_INVEST.tax, ...(inv.tax ?? {}) },
      rent: inv.rent?.components?.length ? inv.rent : DEFAULT_INVEST.rent,
      purchaseItems: Array.isArray(inv.purchaseItems) && inv.purchaseItems.length ? inv.purchaseItems : DEFAULT_INVEST.purchaseItems,
      costs: Array.isArray(inv.costs) ? inv.costs : DEFAULT_INVEST.costs,
      rentAdjustments: Array.isArray(inv.rentAdjustments) ? inv.rentAdjustments : [],
    },
  };
}

/**
 * Vereinfachte Ansicht: Einstellungen, die dort nicht sichtbar sind, werden pausiert (nicht gelöscht),
 * damit kein unsichtbarer Wert das Ergebnis beeinflusst.
 */
export function effectiveState(s: AppState): AppState {
  if (s.viewMode === 'erweitert') return s;
  return {
    ...s,
    manualLoan: false,
    costsMode: s.costsMode,
    rateChanges: [],
    useReference: false,
    extra: { ...NO_EXTRAS },
    invest: {
      ...s.invest,
      costs: s.invest.costs.filter((c) => c.interval !== 'einmalig' && !c.start && !c.end),
      freeMonths: 0,
      tenantChangeYears: 0,
      rentAdjustments: [],
      tax: { ...s.invest.tax, enabled: false },
    },
  };
}

/** Was in der vereinfachten Ansicht gerade pausiert ist. */
export function pausedSettings(s: AppState): string[] {
  if (s.viewMode === 'erweitert') return [];
  const out: string[] = [];
  if (hasExtras(s.extra)) out.push('Sondertilgungen');
  if (s.mode === 'variabel' && (s.rateChanges.length > 0 || s.useReference)) out.push('Zinsszenarien');
  if (s.manualLoan) out.push('manueller Kreditbetrag');
  const i = s.invest;
  if (i.costs.some((c) => c.interval === 'einmalig' || c.start || c.end)) out.push('einmalige und befristete Kosten');
  if (i.freeMonths > 0 || i.rentAdjustments.length > 0) out.push('mietfreie Monate und Mietanpassungen');
  if (i.tax.enabled) out.push('Steuerschätzung');
  return out;
}

export interface Financing {
  costs: number;
  acquisitionCosts: number;
  financingCosts: number;
  costLines: { id: string; name: string; amount: number }[];
  renovation: number;
  initialCosts: number;
  totalInvestment: number;
  loan: number;
  /** Tatsächlich eingesetzte Eigenmittel = Gesamtinvestition − Kredit. */
  ownFunds: number;
}

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function financing(s: AppState): Financing {
  const reno = Math.max(0, s.invest.renovation);
  const costsFor = (loan: number) => {
    if (!s.costsEnabled) return { total: 0, acquisition: 0, financing: 0, lines: [] };
    if (s.costsMode === 'detail') return purchaseCostsDetail(s.invest.purchaseItems, s.price, loan);
    const total = s.costsMode === 'percent' ? r2((s.price * s.costsPercent) / 100) : s.costsEuro;
    return { total, acquisition: total, financing: 0, lines: [{ id: 'pauschal', name: 'Kaufnebenkosten pauschal', amount: total }] };
  };
  let loan = s.manualLoan ? Math.max(0, s.manualLoanAmount) : Math.max(0, s.price - s.equity);
  let costs = costsFor(loan);
  if (!s.manualLoan) {
    // Kreditabhängige Gebühren (Pfandrecht, Bankgebühr) erhöhen bei Mitfinanzierung den Kredit: Fixpunkt suchen.
    for (let k = 0; k < 40; k++) {
      const next = Math.max(0, r2(s.price - s.equity + (s.costsFinanced ? costs.total + reno : 0)));
      const done = Math.abs(next - loan) < 0.005;
      loan = next;
      costs = costsFor(loan);
      if (done) break;
    }
  }
  const initial = initialCosts(s.invest.costs, s.invest.startMonth);
  const totalInvestment = r2(s.price + costs.total + reno + initial);
  return {
    costs: costs.total, acquisitionCosts: costs.acquisition, financingCosts: costs.financing, costLines: costs.lines,
    renovation: reno, initialCosts: initial, totalInvestment, loan, ownFunds: r2(totalInvestment - loan),
  };
}

export const purchaseCosts = (s: AppState) => financing(s).costs;
export const loanAmount = (s: AppState) => financing(s).loan;
export const autoLoanAmount = (s: AppState) => financing({ ...s, manualLoan: false }).loan;

export function toLoanInput(s: AppState): LoanInput {
  return {
    principal: loanAmount(s),
    termYears: s.termYears,
    mode: s.mode,
    fixRate: s.fixRate,
    fixYears: Math.min(s.fixYears, s.termYears),
    variableRate: s.variableRate,
    rateChanges: s.rateChanges,
    useReference: s.useReference,
    referenceRate: s.referenceRate,
    margin: s.margin,
    adjustMonths: s.adjustMonths,
    extra: { ...s.extra, oneTimeYear: Math.min(s.extra.oneTimeYear, s.termYears) },
  };
}

export function compareInput(s: AppState, c: CompareConfig): LoanInput {
  return {
    ...toLoanInput(s),
    mode: c.mode,
    fixRate: c.fixRate,
    fixYears: Math.min(c.fixYears, s.termYears),
    variableRate: c.variableRate,
    rateChanges: [],
    useReference: false,
  };
}

// --- Speicherung im Browser (kann fehlen, z. B. im privaten Modus) ---
const KEY_STATE = 'kreditpilot.state.v2';
const KEY_SCENARIOS = 'kreditpilot.scenarios.v1';
const KEY_THEME = 'kreditpilot.theme';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadState = (): AppState => normalize(read<Partial<AppState>>(KEY_STATE));
export const saveState = (s: AppState) => write(KEY_STATE, s);

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  state: AppState;
}
export const loadScenarios = (): SavedScenario[] => (read<SavedScenario[]>(KEY_SCENARIOS) ?? []).map((p) => ({ ...p, state: normalize(p.state) }));
export const saveScenarios = (list: SavedScenario[]) => write(KEY_SCENARIOS, list);

export type ThemeChoice = 'light' | 'dark' | null;
export const loadTheme = (): ThemeChoice => read<ThemeChoice>(KEY_THEME);
export const saveTheme = (t: ThemeChoice) => write(KEY_THEME, t);
