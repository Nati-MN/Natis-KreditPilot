/**
 * Immobilien-Investment – Berechnungslogik (ohne UI).
 * Grundsätze:
 *  - Durchlaufende Posten (Betriebskosten, Heizung, Umsatzsteuer) sind keine Einnahmen des Vermieters.
 *  - Laufende Kosten werden gleichmäßig auf Monate verteilt, damit Monat × 12 = Jahr gilt.
 *  - Einmalige Kosten wirken nur in ihrem Monat bzw. als Anfangskosten.
 *  - Die Kreditrate wird einmal als Auszahlung abgezogen. Steuerlich zählen nur die Zinsen, nie die Tilgung.
 */
import type { LoanResult } from './loan';

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

// ---------- Miete ----------
export type RentKey = 'hmz' | 'bk' | 'heizung' | 'warmwasser' | 'stellplatz' | 'moebel' | 'sonstige';

export interface RentComponent {
  key: RentKey;
  label: string;
  amount: number;
  /** Umsatzsteuersatz in %, gilt nur ohne Kleinunternehmerregelung. */
  vat: number;
  /** Teil des vereinbarten Bruttomietzinses (sonst zusätzlich verrechnet). */
  inBrutto: boolean;
  /** Durchlaufender Posten: deckt Kosten, ist kein Ertrag des Vermieters. */
  passThrough: boolean;
}

export interface RentState {
  components: RentComponent[];
  /** Kleinunternehmerregelung: keine Umsatzsteuer (Umsatz bis 55.000 € pro Jahr). */
  kleinunternehmer: boolean;
}

export const KLEINUNTERNEHMER_GRENZE = 55000;

export const DEFAULT_RENT: RentState = {
  kleinunternehmer: true,
  components: [
    { key: 'hmz', label: 'Hauptmietzins (Nettomiete)', amount: 600, vat: 10, inBrutto: true, passThrough: false },
    { key: 'bk', label: 'Betriebskosten', amount: 150, vat: 10, inBrutto: true, passThrough: true },
    { key: 'heizung', label: 'Heizkosten', amount: 60, vat: 20, inBrutto: false, passThrough: true },
    { key: 'warmwasser', label: 'Warmwasser', amount: 0, vat: 20, inBrutto: false, passThrough: true },
    { key: 'stellplatz', label: 'Stellplatz / Garage', amount: 0, vat: 20, inBrutto: true, passThrough: false },
    { key: 'moebel', label: 'Möblierungszuschlag', amount: 0, vat: 10, inBrutto: true, passThrough: false },
    { key: 'sonstige', label: 'Sonstige Mietbestandteile', amount: 20, vat: 20, inBrutto: false, passThrough: true },
  ],
};

export interface RentBreakdown {
  lines: { key: RentKey; label: string; net: number; vat: number; gross: number; inBrutto: boolean; passThrough: boolean; vatRate: number }[];
  hmz: number;
  bk: number;
  /** Nettokaltmiete: alle Ertragsbestandteile ohne USt. */
  income: number;
  passThrough: number;
  vatTotal: number;
  bruttomietzins: number;
  additional: number;
  tenantTotal: number;
  /** Jahresumsatz netto, maßgeblich für die Kleinunternehmergrenze. */
  annualTurnover: number;
}

export function rentBreakdown(rent: RentState): RentBreakdown {
  const lines = rent.components.map((c) => {
    const net = r2(Math.max(0, c.amount));
    const vatRate = rent.kleinunternehmer ? 0 : c.vat;
    const vat = r2((net * vatRate) / 100);
    return { key: c.key, label: c.label, net, vat, gross: r2(net + vat), inBrutto: c.inBrutto, passThrough: c.passThrough, vatRate };
  });
  const sum = (f: (l: (typeof lines)[number]) => number) => r2(lines.reduce((s, l) => s + f(l), 0));
  return {
    lines,
    hmz: lines.find((l) => l.key === 'hmz')?.net ?? 0,
    bk: lines.find((l) => l.key === 'bk')?.net ?? 0,
    income: sum((l) => (l.passThrough ? 0 : l.net)),
    passThrough: sum((l) => (l.passThrough ? l.net : 0)),
    vatTotal: sum((l) => l.vat),
    bruttomietzins: sum((l) => (l.inBrutto ? l.gross : 0)),
    additional: sum((l) => (l.inBrutto ? 0 : l.gross)),
    tenantTotal: sum((l) => l.gross),
    annualTurnover: r2(sum((l) => l.net) * 12),
  };
}

// ---------- Kosten ----------
export type CostInterval = 'einmalig' | 'monatlich' | 'quartal' | 'jaehrlich';
export type TaxMode = 'sofort' | 'verteilt15' | 'verteilt10' | 'nicht';

export const COST_CATEGORIES = [
  'Verwaltung', 'Instandhaltung', 'Reparatur', 'Rücklage', 'Versicherung', 'Steuern & Abgaben',
  'Finanzierung', 'Energie & Medien', 'Ausstattung', 'Leerstand', 'Sonstiges',
] as const;

export interface CostItem {
  id: string;
  name: string;
  amount: number;
  interval: CostInterval;
  category: string;
  /** Darf laut Vertrag/Gesetz auf den Mieter umgelegt werden. */
  umlagefaehig: boolean;
  payer: 'vermieter' | 'mieter';
  /** 'YYYY-MM', optional. */
  start?: string;
  end?: string;
  taxMode: TaxMode;
}

export const DEFAULT_COSTS: CostItem[] = [
  { id: 'ruecklage', name: 'Instandhaltungsrücklage', amount: 62, interval: 'monatlich', category: 'Rücklage', umlagefaehig: false, payer: 'vermieter', taxMode: 'nicht' },
  { id: 'verwaltung', name: 'Hausverwaltung (nicht umlagefähig)', amount: 25, interval: 'monatlich', category: 'Verwaltung', umlagefaehig: false, payer: 'vermieter', taxMode: 'sofort' },
  { id: 'versicherung', name: 'Versicherung', amount: 13, interval: 'monatlich', category: 'Versicherung', umlagefaehig: false, payer: 'vermieter', taxMode: 'sofort' },
];

/** Gesetzliche Mindestrücklage nach § 31 WEG ab 1.1.2026, € pro m² Nutzfläche und Monat. */
export const MINDESTRUECKLAGE_PRO_M2 = 1.12;

export const monthIndex = (ym: string | undefined): number | null => {
  if (!ym) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};

/** Monatlicher Gegenwert einer laufenden Position (einmalige: 0). */
export function monthlyEquivalent(c: CostItem): number {
  const a = Math.max(0, c.amount);
  return c.interval === 'monatlich' ? a : c.interval === 'quartal' ? a / 3 : c.interval === 'jaehrlich' ? a / 12 : 0;
}

/** Projektmonat (1-basiert), in dem eine einmalige Position anfällt. ≤ 1 bedeutet: Anfangskosten. */
export function oneTimeMonth(c: CostItem, startMonth: string): number {
  const s = monthIndex(c.start);
  const p = monthIndex(startMonth);
  if (s === null || p === null) return 1;
  return s - p + 1;
}

function activeInMonth(c: CostItem, startMonth: string, m: number): boolean {
  const p = monthIndex(startMonth);
  if (p === null) return true;
  const abs = p + m - 1;
  const s = monthIndex(c.start);
  const e = monthIndex(c.end);
  return (s === null || abs >= s) && (e === null || abs <= e);
}

/** Einmalige Vermieterkosten zum Kaufzeitpunkt (Teil der Gesamtinvestition). */
export function initialCosts(costs: CostItem[], startMonth: string): number {
  return r2(costs.reduce((s, c) => s + (c.interval === 'einmalig' && c.payer === 'vermieter' && oneTimeMonth(c, startMonth) <= 1 ? Math.max(0, c.amount) : 0), 0));
}

// ---------- Eingaben ----------
export interface TaxState {
  enabled: boolean;
  /** Grenzsteuersatz in %. */
  marginalRate: number;
  /** Anteil Grund und Boden in % (nicht abschreibbar). */
  landShare: number;
  afaRate: number;
  /** Beschleunigte AfA: Jahr 1 dreifach, Jahr 2 doppelt. */
  accelerated: boolean;
  /** Verluste mindern die Steuer auf anderes Einkommen. */
  offsetLosses: boolean;
}

export interface RentAdjustment {
  year: number;
  rent: number;
}

export interface InvestInput {
  price: number;
  totalInvestment: number;
  ownFunds: number;
  loanPrincipal: number;
  termYears: number;
  acquisitionCosts: number;
  financingCosts: number;
  renovation: number;
  renovationTax: 'verteilt15' | 'afa';
  rent: RentState;
  costs: CostItem[];
  startMonth: string;
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
}

// ---------- Typischer Monat ----------
export interface TypicalMonth {
  /** Nettokaltmiete bei voller Vermietung. */
  incomeFull: number;
  /** Nach Leerstand und Mietausfall. */
  income: number;
  vacancyLoss: number;
  landlordCosts: number;
  /** Betriebskosten, die der Vermieter im Leerstand selbst trägt. */
  vacancyCosts: number;
  /** Ertrag nach laufenden Vermieterkosten, vor Finanzierung. */
  netOperating: number;
  payment: number;
  extra: number;
  cashflow: number;
}

const vacancyShare = (i: InvestInput) => Math.min(1, Math.max(0, i.vacancyMonths) / 12);

function recurringLandlordCosts(i: InvestInput, m: number): number {
  return i.costs.reduce((s, c) => s + (c.payer === 'vermieter' && c.interval !== 'einmalig' && activeInMonth(c, i.startMonth, m) ? monthlyEquivalent(c) : 0), 0);
}
function recurringTenantCosts(i: InvestInput, m: number): number {
  return i.costs.reduce((s, c) => s + (c.payer === 'mieter' && c.interval !== 'einmalig' && activeInMonth(c, i.startMonth, m) ? monthlyEquivalent(c) : 0), 0);
}

/** Miet- und Kostenniveau je Jahr (Index 1 = erstes Jahr). */
function levels(i: InvestInput, years: number) {
  const b = rentBreakdown(i.rent);
  const otherIncome = b.income - b.hmz;
  const hmz: number[] = [0];
  const gf: number[] = [0];
  const cg: number[] = [0];
  let level = b.hmz;
  for (let y = 1; y <= years; y++) {
    if (y > 1) level *= 1 + i.rentGrowth / 100;
    const adj = i.rentAdjustments.find((a) => Math.round(a.year) === y);
    if (adj) level = Math.max(0, adj.rent);
    hmz[y] = level;
    gf[y] = Math.pow(1 + i.rentGrowth / 100, y - 1);
    cg[y] = Math.pow(1 + i.costGrowth / 100, y - 1);
  }
  return { b, otherIncome, hmz, gf, cg };
}

/** Ein normaler Monat ohne Einmaleffekte. `payment` ist die reguläre Kreditrate. */
export function typicalMonth(i: InvestInput, payment: number, extra = 0, year = 1): TypicalMonth {
  const L = levels(i, year);
  const v = vacancyShare(i);
  const m = (year - 1) * 12 + 1;
  const incomeFull = L.hmz[year] + L.otherIncome * L.gf[year];
  const income = incomeFull * (1 - v) * (1 - Math.max(0, i.rentLoss) / 100);
  const landlordCosts = recurringLandlordCosts(i, m) * L.cg[year];
  const vacancyCosts = v * (L.b.bk + recurringTenantCosts(i, m)) * L.cg[year];
  const netOperating = income - landlordCosts - vacancyCosts;
  return {
    incomeFull: r2(incomeFull),
    income: r2(income),
    vacancyLoss: r2(incomeFull - income),
    landlordCosts: r2(landlordCosts),
    vacancyCosts: r2(vacancyCosts),
    netOperating: r2(netOperating),
    payment: r2(payment),
    extra: r2(extra),
    cashflow: r2(netOperating - payment - extra),
  };
}

// ---------- Renditen ----------
export interface Yields {
  grossOnPrice: number;
  grossOnTotal: number;
  netOnTotal: number;
  /** null, wenn kein Eigenkapital eingesetzt wird. */
  cashOnCash: number | null;
}

export function yields(i: InvestInput, t: TypicalMonth): Yields {
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  return {
    grossOnPrice: pct(t.incomeFull * 12, i.price),
    grossOnTotal: pct(t.incomeFull * 12, i.totalInvestment),
    netOnTotal: pct(t.netOperating * 12, i.totalInvestment),
    cashOnCash: i.ownFunds > 0 ? (t.cashflow * 12) / i.ownFunds * 100 : null,
  };
}

// ---------- Prognose ----------
export interface InvestMonth {
  month: number;
  year: number;
  income: number;
  landlordCosts: number;
  vacancyCosts: number;
  oneTime: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  cashflow: number;
  tax: number;
  cashflowAfterTax: number;
  balance: number;
}

export interface InvestYear {
  year: number;
  income: number;
  landlordCosts: number;
  vacancyCosts: number;
  oneTime: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  cashflow: number;
  cumCashflow: number;
  afa: number;
  taxableSurplus: number;
  tax: number;
  cashflowAfterTax: number;
  cumCashflowAfterTax: number;
  value: number;
  balance: number;
  equity: number;
  grossYield: number;
  netYield: number;
  monthlyCashflow: number;
}

export interface Projection {
  months: InvestMonth[];
  years: InvestYear[];
  totalInterest: number;
  totalLandlordCosts: number;
  totalTax: number;
  /** Interner Zinsfuß pro Jahr über den Horizont, inkl. Verkauf zum Prognosewert. */
  irr: number | null;
  /** Vermögenszuwachs: Eigenkapital in der Immobilie + kumulierter Cashflow − eingesetzte Eigenmittel. */
  totalGain: number;
}

export function afaBase(i: InvestInput): number {
  return r2((i.price + i.acquisitionCosts) * (1 - Math.min(100, Math.max(0, i.tax.landShare)) / 100) + (i.renovationTax === 'afa' ? i.renovation : 0));
}

export function project(i: InvestInput, loan: LoanResult): Projection {
  const H = Math.max(1, Math.round(i.horizonYears));
  const L = levels(i, H);
  const v = vacancyShare(i);
  const loss = Math.max(0, i.rentLoss) / 100;
  const months: InvestMonth[] = [];
  const changeEvery = Math.round(i.tenantChangeYears) * 12;
  // Steuerlich abzugsfähige Beträge je Jahr (Index 1 = erstes Jahr).
  const deductible: number[] = new Array(H + 2).fill(0);
  const spread = (amount: number, fromYear: number, mode: TaxMode) => {
    if (mode === 'nicht' || amount <= 0) return;
    const n = mode === 'verteilt15' ? 15 : mode === 'verteilt10' ? 10 : 1;
    for (let k = 0; k < n; k++) if (fromYear + k <= H) deductible[fromYear + k] += amount / n;
  };
  for (const c of i.costs) {
    if (c.interval === 'einmalig' && c.payer === 'vermieter') {
      const m = oneTimeMonth(c, i.startMonth);
      if (m <= H * 12) spread(Math.max(0, c.amount), Math.max(1, Math.ceil(m / 12)), c.taxMode);
    }
  }
  if (i.renovationTax === 'verteilt15') spread(i.renovation, 1, 'verteilt15');

  for (let m = 1; m <= H * 12; m++) {
    const y = Math.ceil(m / 12);
    const free = m <= Math.round(i.freeMonths);
    const incomeFull = L.hmz[y] + L.otherIncome * L.gf[y];
    const income = free ? 0 : incomeFull * (1 - v) * (1 - loss);
    let landlordCosts = 0;
    for (const c of i.costs) {
      if (c.payer !== 'vermieter' || c.interval === 'einmalig' || !activeInMonth(c, i.startMonth, m)) continue;
      const amount = monthlyEquivalent(c) * L.cg[y];
      landlordCosts += amount;
      if (c.taxMode !== 'nicht') deductible[y] += amount;
    }
    const vacancyCosts = v * (L.b.bk + recurringTenantCosts(i, m)) * L.cg[y];
    let oneTime = 0;
    for (const c of i.costs) {
      if (c.interval === 'einmalig' && c.payer === 'vermieter' && oneTimeMonth(c, i.startMonth) === m && m > 1) oneTime += Math.max(0, c.amount);
    }
    if (changeEvery > 0 && m > 1 && (m - 1) % changeEvery === 0) {
      const change = i.tenantChangeCost * L.cg[y] + i.reletBrokerMonths * (L.hmz[y] + L.b.bk * L.cg[y]) * 1.2;
      oneTime += change;
      deductible[y] += change;
    }
    deductible[y] += vacancyCosts;
    const row = loan.rows[m - 1];
    // Kreditgebühren sind Teil der Kreditbelastung.
    const payment = (row?.payment ?? 0) + (row?.fees ?? 0);
    const extra = row?.extra ?? 0;
    months.push({
      month: m, year: y, income, landlordCosts, vacancyCosts, oneTime, payment,
      interest: row?.interest ?? 0, principal: row?.principal ?? 0, extra,
      cashflow: income - landlordCosts - vacancyCosts - oneTime - payment - extra,
      tax: 0, cashflowAfterTax: 0, balance: row ? row.balance : 0,
    });
  }

  const base = afaBase(i);
  const years: InvestYear[] = [];
  let cum = 0;
  let cumAfter = 0;
  for (let y = 1; y <= H; y++) {
    const ms = months.slice((y - 1) * 12, y * 12);
    const s = (f: (r: InvestMonth) => number) => ms.reduce((a, r) => a + f(r), 0);
    const income = s((r) => r.income);
    const interest = s((r) => r.interest);
    const afa = base * (i.tax.afaRate / 100) * (i.tax.accelerated ? (y === 1 ? 3 : y === 2 ? 2 : 1) : 1);
    const financing = y <= i.termYears && i.termYears > 0 ? i.financingCosts / i.termYears : 0;
    // Tilgung und Sondertilgung sind bewusst nicht enthalten.
    const taxableSurplus = income - interest - afa - financing - deductible[y];
    let tax = 0;
    if (i.tax.enabled) {
      tax = taxableSurplus * (i.tax.marginalRate / 100);
      if (tax < 0 && !i.tax.offsetLosses) tax = 0;
    }
    const cashflow = s((r) => r.cashflow);
    for (const r of ms) {
      r.tax = tax / 12;
      r.cashflowAfterTax = r.cashflow - r.tax;
    }
    cum += cashflow;
    cumAfter += cashflow - tax;
    const value = i.price * Math.pow(1 + i.valueGrowth / 100, y);
    const balance = ms[ms.length - 1].balance;
    const landlordCosts = s((r) => r.landlordCosts);
    const vacancyCosts = s((r) => r.vacancyCosts);
    const fullIncome = (L.hmz[y] + L.otherIncome * L.gf[y]) * 12;
    years.push({
      year: y, income: r2(income), landlordCosts: r2(landlordCosts), vacancyCosts: r2(vacancyCosts), oneTime: r2(s((r) => r.oneTime)),
      payment: r2(s((r) => r.payment)), interest: r2(interest), principal: r2(s((r) => r.principal)), extra: r2(s((r) => r.extra)),
      cashflow: r2(cashflow), cumCashflow: r2(cum), afa: r2(afa), taxableSurplus: r2(taxableSurplus), tax: r2(tax),
      cashflowAfterTax: r2(cashflow - tax), cumCashflowAfterTax: r2(cumAfter),
      value: r2(value), balance: r2(balance), equity: r2(value - balance),
      grossYield: i.price > 0 ? (fullIncome / i.price) * 100 : 0,
      netYield: i.totalInvestment > 0 ? ((income - landlordCosts - vacancyCosts) / i.totalInvestment) * 100 : 0,
      monthlyCashflow: r2(cashflow / 12),
    });
  }
  const last = years[years.length - 1];
  const flows = [-i.ownFunds, ...years.map((y, idx) => (i.tax.enabled ? y.cashflowAfterTax : y.cashflow) + (idx === years.length - 1 ? y.equity : 0))];
  const finalCum = i.tax.enabled ? last.cumCashflowAfterTax : last.cumCashflow;
  return {
    months, years,
    totalInterest: r2(years.reduce((a, y) => a + y.interest, 0)),
    totalLandlordCosts: r2(years.reduce((a, y) => a + y.landlordCosts + y.vacancyCosts + y.oneTime, 0)),
    totalTax: r2(years.reduce((a, y) => a + y.tax, 0)),
    irr: i.ownFunds > 0 ? irr(flows) : null,
    totalGain: r2(last.equity + finalCum - i.ownFunds),
  };
}

/** Interner Zinsfuß per Bisektion; null, wenn kein Vorzeichenwechsel vorliegt. */
export function irr(flows: number[]): number | null {
  const npv = (rate: number) => flows.reduce((s, f, t) => s + f / Math.pow(1 + rate, t), 0);
  let lo = -0.95;
  let hi = 1;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 100;
}

// ---------- Break-even (geschlossene Formeln) ----------
/** Hauptmietzins, der für den gewünschten monatlichen Cashflow nötig ist. */
export function requiredRent(i: InvestInput, t: TypicalMonth, targetCashflow: number): number {
  const b = rentBreakdown(i.rent);
  const k = (1 - vacancyShare(i)) * (1 - Math.max(0, i.rentLoss) / 100);
  if (k <= 0) return Infinity;
  const needed = (targetCashflow + t.landlordCosts + t.vacancyCosts + t.payment + t.extra) / k;
  return r2(Math.max(0, needed - (b.income - b.hmz)));
}

/** Leerstandsmonate pro Jahr, bei denen der Jahres-Cashflow gerade 0 ist. */
export function bearableVacancyMonths(i: InvestInput, t: TypicalMonth): number {
  const b = rentBreakdown(i.rent);
  const perMonthFull = t.incomeFull * (1 - Math.max(0, i.rentLoss) / 100);
  const vacCostFull = b.bk + recurringTenantCosts(i, 1);
  const denom = perMonthFull + vacCostFull;
  if (denom <= 0) return 0;
  const share = (perMonthFull - t.landlordCosts - t.payment - t.extra) / denom;
  return Math.max(0, Math.min(12, share * 12));
}

/** Wie viele Monate ohne Mieter eine Reserve reicht (alle Kosten und die Kreditrate laufen weiter). */
export function reserveMonths(i: InvestInput, t: TypicalMonth, reserve: number): number {
  const b = rentBreakdown(i.rent);
  const burn = t.landlordCosts + b.bk + recurringTenantCosts(i, 1) + t.payment + t.extra;
  return burn > 0 ? reserve / burn : Infinity;
}

/** Bisektion für monoton fallende Funktionen: größtes x in [lo, hi] mit f(x) ≥ 0, sonst null. */
export function bisectMax(f: (x: number) => number, lo: number, hi: number): number | null {
  if (f(lo) < 0) return null;
  if (f(hi) >= 0) return hi;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) >= 0) lo = mid;
    else hi = mid;
  }
  return lo;
}
