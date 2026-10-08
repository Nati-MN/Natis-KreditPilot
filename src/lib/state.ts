import { DEFAULT_COSTS, DEFAULT_RENT, initialCosts, type CostItem, type RentAdjustment, type RentState, type TaxState } from './invest';
import { DEFAULT_AFFORD, DEFAULT_RULES, type AffordState, type LendingRules } from './afford';
import { hasExtras, NO_EXTRAS, round2 as r2, type DayCount, type ExtraPayments, type ExtraRule, type Interval, type LoanInput, type LoanMode, type LoanType, type RateChange } from './loan';
import { EXAMPLE_OFFERS, type Offer } from './offers';
import { DEFAULT_POI, type PoiState } from './payinvest';
import { DEFAULT_REFI, type RefiState } from './refinance';
import { DEFAULT_PURCHASE_ITEMS, purchaseCostsDetail, type PurchaseItem } from './purchase';

export type Section = 'kredit' | 'vergleich' | 'leistbarkeit' | 'umschuldung' | 'tilgen' | 'invest';
export type TermMode = 'laufzeit' | 'tilgung' | 'rate';

export interface LoanFees {
  /** Kontoführung pro Monat. */
  accountMonthly: number;
  /** Verpflichtende Versicherung pro Monat. */
  insuranceMonthly: number;
  /** Weitere einmalige Kreditkosten, die nicht in den Kaufnebenkosten stehen. */
  otherOneTime: number;
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
  section: Section;
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
  invest: InvestState;

  // Kreditart und Vertragsdetails
  loanType: LoanType;
  graceMonths: number;
  /** Laufzeit vorgeben, Anfangstilgung vorgeben oder Wunschrate vorgeben. */
  termMode: TermMode;
  initialRepayment: number;
  desiredPayment: number;
  interval: Interval;
  dayCount: DayCount;
  /** Kreditbeginn 'YYYY-MM-DD'. */
  loanStart: string;
  /** Erste Fälligkeit; leer = ein Monat nach Kreditbeginn. */
  firstDue: string;
  rateCapOn: boolean;
  rateCap: number;
  rateFloorOn: boolean;
  rateFloor: number;
  fees: LoanFees;
  // Sondertilgungen
  extraRules: ExtraRule[];
  extraLimitPercent: number;
  prepayFeePercent: number;
  prepayFreePerYear: number;
  /** Angenommene Inflation für die reale Belastung, % p.a. */
  inflation: number;
  /** Zusätzlicher Kapitalbedarf beim Kauf. */
  furnishing: number;
  liquidityReserve: number;
  // Weitere Rechner
  offers: Offer[];
  afford: AffordState;
  rules: LendingRules;
  refi: RefiState;
  poi: PoiState;
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
/** Erster Tag des nächsten Monats als Standard-Kreditbeginn. */
const nextMonthStart = () => {
  const d = new Date();
  const m = d.getMonth() + 1;
  return `${d.getFullYear() + (m === 12 ? 1 : 0)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
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
  invest: DEFAULT_INVEST,
  loanType: 'annuitaet',
  graceMonths: 0,
  termMode: 'laufzeit',
  initialRepayment: 2,
  desiredPayment: 500,
  interval: 1,
  dayCount: '30/360',
  loanStart: nextMonthStart(),
  firstDue: '',
  rateCapOn: false,
  rateCap: 6,
  rateFloorOn: false,
  rateFloor: 1,
  fees: { accountMonthly: 0, insuranceMonthly: 0, otherOneTime: 0 },
  extraRules: [],
  extraLimitPercent: 0,
  prepayFeePercent: 0,
  prepayFreePerYear: 0,
  inflation: 2,
  furnishing: 0,
  liquidityReserve: 0,
  offers: EXAMPLE_OFFERS,
  afford: DEFAULT_AFFORD,
  rules: DEFAULT_RULES,
  refi: DEFAULT_REFI,
  poi: DEFAULT_POI,
};

/**
 * Übernimmt aus gespeicherten oder importierten Daten nur Werte, deren Typ zum Standard passt.
 * Unbekannte Felder werden verworfen, falsche Typen durch den Standard ersetzt. Listen werden elementweise geprüft.
 */
function merge<T>(def: T, saved: unknown, depth = 0): T {
  if (saved === undefined || saved === null) return def;
  if (Array.isArray(def)) {
    if (!Array.isArray(saved)) return def;
    const sample = (def as unknown[])[0];
    const list = (saved as unknown[]).slice(0, 200);
    if (sample !== undefined && typeof sample === 'object') return list.filter((x) => x && typeof x === 'object').map((x) => merge(sample, x, depth + 1)) as unknown as T;
    return list.filter((x) => (sample === undefined ? typeof x !== 'function' : typeof x === typeof sample)) as unknown as T;
  }
  if (def !== null && typeof def === 'object') {
    if (typeof saved !== 'object' || depth > 6) return def;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(def as object)) out[key] = merge((def as Record<string, unknown>)[key], (saved as Record<string, unknown>)[key], depth + 1);
    return out as T;
  }
  if (typeof def === 'number') return (typeof saved === 'number' && Number.isFinite(saved) ? saved : def) as T;
  if (typeof def === 'string') return (typeof saved === 'string' ? saved.slice(0, 200) : def) as T;
  return (typeof saved === typeof def ? saved : def) as T;
}

const oneOfStr = (value: string, allowed: string[], def: string) => (allowed.includes(value) ? value : def);

/** Vorlagen für Listen, deren Standard leer ist (damit Einträge geprüft werden können). */
const TEMPLATES = {
  rateChange: { year: 1, rate: 0 },
  rentAdjustment: { year: 2, rent: 0 },
  extraRule: { id: '', label: '', interval: 'einmalig', unit: 'euro', amount: 0, from: 1, to: 0 },
  cost: { id: '', name: '', amount: 0, interval: 'monatlich', category: 'Sonstiges', umlagefaehig: false, payer: 'vermieter', start: '', end: '', taxMode: 'sofort' },
};

/** Ergänzt fehlende Felder (z. B. bei Projekten aus einer älteren Version) und prüft alle Werte. */
export function normalize(saved: unknown): AppState {
  if (!saved || typeof saved !== 'object') return DEFAULT_STATE;
  const raw = saved as Record<string, unknown>;
  const inv = (raw.invest && typeof raw.invest === 'object' ? raw.invest : {}) as Record<string, unknown>;
  const list = <T>(template: T, value: unknown): T[] => merge([template], value);
  const base: AppState = merge(DEFAULT_STATE, raw);
  const rawRules = Array.isArray(raw.extraRules) ? raw.extraRules.filter((x) => x && typeof x === 'object') : [];
  const rules = list(TEMPLATES.extraRule, rawRules).map((r, i) => ({
    ...r,
    interval: oneOfStr(r.interval, ['einmalig', 'monatlich', 'quartal', 'jaehrlich'], 'einmalig'),
    unit: oneOfStr(r.unit, ['euro', 'prozent'], 'euro'),
    to: (rawRules[i] as { to?: unknown })?.to == null ? null : r.to,
  })) as ExtraRule[];
  const costs = Array.isArray(inv.costs) ? (list(TEMPLATES.cost, inv.costs).map((c) => ({ ...c, start: c.start || undefined, end: c.end || undefined })) as InvestState['costs']) : DEFAULT_INVEST.costs;
  // Auswahlfelder: nur bekannte Werte zulassen.
  const oneOf = <T,>(value: T, allowed: readonly T[], def: T): T => (allowed.includes(value) ? value : def);
  const D = DEFAULT_STATE;
  base.viewMode = oneOf(base.viewMode, ['einfach', 'erweitert'], D.viewMode);
  base.section = oneOf(base.section, ['kredit', 'vergleich', 'leistbarkeit', 'umschuldung', 'tilgen', 'invest'], D.section);
  base.costsMode = oneOf(base.costsMode, ['detail', 'percent', 'euro'], D.costsMode);
  base.mode = oneOf(base.mode, ['fix', 'variabel'], D.mode);
  base.loanType = oneOf(base.loanType, ['annuitaet', 'raten', 'endfaellig'], D.loanType);
  base.termMode = oneOf(base.termMode, ['laufzeit', 'tilgung', 'rate'], D.termMode);
  base.interval = oneOf(base.interval, [1, 3, 6, 12], D.interval);
  base.dayCount = oneOf(base.dayCount, ['30/360', 'act/360', 'act/365'], D.dayCount);
  base.extra.strategy = oneOf(base.extra.strategy, ['laufzeit', 'rate', 'kombi'], D.extra.strategy);
  base.refi.newMode = oneOf(base.refi.newMode, ['fix', 'variabel'], D.refi.newMode);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base.loanStart)) base.loanStart = D.loanStart;
  if (base.firstDue && !/^\d{4}-\d{2}-\d{2}$/.test(base.firstDue)) base.firstDue = '';
  base.offers = base.offers.map((o) => ({ ...o, mode: oneOf(o.mode, ['fix', 'variabel'], 'fix'), type: oneOf(o.type, ['annuitaet', 'raten', 'endfaellig'], 'annuitaet') }));
  return {
    ...base,
    rateChanges: list(TEMPLATES.rateChange, raw.rateChanges),
    extraRules: rules,
    offers: Array.isArray(raw.offers) ? base.offers : DEFAULT_STATE.offers,
    invest: {
      ...base.invest,
      costs,
      rentAdjustments: list(TEMPLATES.rentAdjustment, inv.rentAdjustments),
      rent: base.invest.rent.components.length ? base.invest.rent : DEFAULT_INVEST.rent,
      purchaseItems: base.invest.purchaseItems.length ? base.invest.purchaseItems : DEFAULT_INVEST.purchaseItems,
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
    rateChanges: [],
    useReference: false,
    extra: { ...NO_EXTRAS },
    extraRules: [],
    extraLimitPercent: 0,
    prepayFeePercent: 0,
    loanType: 'annuitaet',
    graceMonths: 0,
    termMode: 'laufzeit',
    interval: 1,
    dayCount: '30/360',
    firstDue: '',
    rateCapOn: false,
    rateFloorOn: false,
    fees: { accountMonthly: 0, insuranceMonthly: 0, otherOneTime: 0 },
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
  if (hasExtras(s.extra, s.extraRules)) out.push('Sondertilgungen');
  if (s.loanType !== 'annuitaet' || s.graceMonths > 0 || s.termMode !== 'laufzeit' || s.interval !== 1 || s.dayCount !== '30/360' || s.rateCapOn || s.rateFloorOn) out.push('Kreditart und Vertragsdetails');
  if (s.fees.accountMonthly > 0 || s.fees.insuranceMonthly > 0 || s.fees.otherOneTime > 0) out.push('laufende Kreditgebühren');
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
  furnishing: number;
  /** Gesamter Kapitalbedarf inkl. Liquiditätsreserve. */
  capitalNeed: number;
  /** Eigenmittel inkl. Reserve, die zur Seite gelegt wird. */
  ownFundsNeeded: number;
  /** Eigenkapitalquote am Kapitalbedarf in %. */
  equityRatio: number;
  /** Beleihungsquote: Kredit / Kaufpreis in %. */
  ltv: number;
}

export function financing(s: AppState): Financing {
  const reno = Math.max(0, s.invest.renovation);
  const furnishing = Math.max(0, s.furnishing);
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
      const next = Math.max(0, r2(s.price - s.equity + (s.costsFinanced ? costs.total + reno + furnishing : 0)));
      const done = Math.abs(next - loan) < 0.005;
      loan = next;
      costs = costsFor(loan);
      if (done) break;
    }
  }
  const initial = initialCosts(s.invest.costs, s.invest.startMonth);
  const totalInvestment = r2(s.price + costs.total + reno + furnishing + initial);
  const capitalNeed = r2(totalInvestment + Math.max(0, s.liquidityReserve));
  return {
    costs: costs.total, acquisitionCosts: costs.acquisition, financingCosts: costs.financing, costLines: costs.lines,
    renovation: reno, initialCosts: initial, totalInvestment, loan, ownFunds: r2(totalInvestment - loan),
    furnishing, capitalNeed, ownFundsNeeded: r2(capitalNeed - loan),
    equityRatio: capitalNeed > 0 ? ((capitalNeed - loan) / capitalNeed) * 100 : 0,
    ltv: s.price > 0 ? (loan / s.price) * 100 : 0,
  };
}

export const purchaseCosts = (s: AppState) => financing(s).costs;
export const loanAmount = (s: AppState) => financing(s).loan;
export const autoLoanAmount = (s: AppState) => financing({ ...s, manualLoan: false }).loan;

export function toLoanInput(s: AppState, fin: Financing = financing(s)): LoanInput {
  const annuityType = s.loanType === 'annuitaet';
  let fixedPayment: number | null = null;
  // Anfangstilgung: Rate = Kredit · (Zins + Tilgung) / 12 je Monat, die Laufzeit ergibt sich daraus.
  if (annuityType && s.termMode === 'tilgung') fixedPayment = r2(((fin.loan * (s.fixRate + s.initialRepayment)) / 100 / 12) * s.interval);
  if (annuityType && s.termMode === 'rate') fixedPayment = s.desiredPayment;
  return {
    principal: fin.loan,
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
    type: s.loanType,
    graceMonths: s.graceMonths,
    interval: s.interval,
    dayCount: s.dayCount,
    startDate: s.loanStart,
    firstDue: s.firstDue || undefined,
    rateCap: s.rateCapOn ? s.rateCap : null,
    rateFloor: s.rateFloorOn ? s.rateFloor : null,
    fixedPayment,
    extraRules: s.extraRules,
    extraLimitPercent: s.extraLimitPercent,
    prepayFeePercent: s.prepayFeePercent,
    prepayFreePerYear: s.prepayFreePerYear,
    // Finanzierungskosten aus den Kaufnebenkosten (Pfandrecht, Bankgebühr, Bewertung) zählen zum Effektivzins.
    oneTimeCosts: r2(fin.financingCosts + Math.max(0, s.fees.otherOneTime)),
    monthlyFees: r2(Math.max(0, s.fees.accountMonthly) + Math.max(0, s.fees.insuranceMonthly)),
  };
}

// --- Speicherung im Browser (kann fehlen, z. B. im privaten Modus) ---
const KEY_STATE = 'kreditpilot.state.v3';
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

export const loadState = (): AppState => normalize(read<unknown>(KEY_STATE));
export const saveState = (s: AppState) => write(KEY_STATE, s);

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  state: AppState;
}
export const loadScenarios = (): SavedScenario[] => {
  const list = read<unknown>(KEY_SCENARIOS);
  return Array.isArray(list) ? list.filter((p) => p && typeof p === 'object').map((p) => toScenario(p as Record<string, unknown>)) : [];
};
const toScenario = (p: Record<string, unknown>): SavedScenario => ({
  id: typeof p.id === 'string' ? p.id.slice(0, 40) : `${Date.now()}`,
  name: typeof p.name === 'string' ? p.name.slice(0, 60) : 'Ohne Namen',
  savedAt: typeof p.savedAt === 'string' ? p.savedAt.slice(0, 40) : new Date().toISOString(),
  state: normalize(p.state),
});

/** Export aller gespeicherten Szenarien als JSON-Text (bleibt auf dem Gerät des Nutzers). */
export function exportScenarios(list: SavedScenario[], current: AppState): string {
  return JSON.stringify({ app: 'kredit-pilot', version: 2, exportedAt: new Date().toISOString(), current, scenarios: list }, null, 2);
}

/** Liest eine Exportdatei; ungültige Inhalte ergeben null, alle Werte werden geprüft. */
export function importScenarios(text: string): { current: AppState | null; scenarios: SavedScenario[] } | null {
  if (text.length > 5_000_000) return null;
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || data.app !== 'kredit-pilot') return null;
    const scenarios = Array.isArray(data.scenarios) ? data.scenarios.slice(0, 100).filter((p) => p && typeof p === 'object').map((p) => toScenario(p as Record<string, unknown>)) : [];
    return { current: data.current && typeof data.current === 'object' ? normalize(data.current) : null, scenarios };
  } catch {
    return null;
  }
}
export const saveScenarios = (list: SavedScenario[]) => write(KEY_SCENARIOS, list);

export type ThemeChoice = 'light' | 'dark' | null;
export const loadTheme = (): ThemeChoice => read<ThemeChoice>(KEY_THEME);
export const saveTheme = (t: ThemeChoice) => write(KEY_THEME, t);
