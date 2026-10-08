import { NO_EXTRAS, type LoanInput, type LoanMode, type RateChange, type ExtraPayments } from './loan';

export interface CompareConfig {
  mode: LoanMode;
  fixRate: number;
  fixYears: number;
  variableRate: number;
}

export interface AppState {
  price: number;
  equity: number;
  costsEnabled: boolean;
  costsMode: 'percent' | 'euro';
  costsPercent: number;
  costsEuro: number;
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
}

export const DEFAULT_STATE: AppState = {
  price: 119000,
  equity: 30000,
  costsEnabled: false,
  costsMode: 'percent',
  costsPercent: 10,
  costsEuro: 12000,
  costsFinanced: true,
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
};

export function purchaseCosts(s: AppState): number {
  if (!s.costsEnabled) return 0;
  return s.costsMode === 'percent' ? Math.round(s.price * s.costsPercent) / 100 : s.costsEuro;
}

export function autoLoanAmount(s: AppState): number {
  const financed = s.costsEnabled && s.costsFinanced ? purchaseCosts(s) : 0;
  return Math.max(0, Math.round((s.price + financed - s.equity) * 100) / 100);
}

export const loanAmount = (s: AppState) => (s.manualLoan ? Math.max(0, s.manualLoanAmount) : autoLoanAmount(s));

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
const KEY_STATE = 'kreditpilot.state.v1';
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

export function loadState(): AppState {
  const saved = read<Partial<AppState>>(KEY_STATE);
  if (!saved || typeof saved !== 'object') return DEFAULT_STATE;
  return {
    ...DEFAULT_STATE,
    ...saved,
    extra: { ...DEFAULT_STATE.extra, ...(saved.extra ?? {}) },
    compareA: { ...DEFAULT_STATE.compareA, ...(saved.compareA ?? {}) },
    compareB: { ...DEFAULT_STATE.compareB, ...(saved.compareB ?? {}) },
    rateChanges: Array.isArray(saved.rateChanges) ? saved.rateChanges : [],
  };
}
export const saveState = (s: AppState) => write(KEY_STATE, s);

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  state: AppState;
}
export const loadScenarios = (): SavedScenario[] => read<SavedScenario[]>(KEY_SCENARIOS) ?? [];
export const saveScenarios = (list: SavedScenario[]) => write(KEY_SCENARIOS, list);

export type ThemeChoice = 'light' | 'dark' | null;
export const loadTheme = (): ThemeChoice => read<ThemeChoice>(KEY_THEME);
export const saveTheme = (t: ThemeChoice) => write(KEY_THEME, t);
