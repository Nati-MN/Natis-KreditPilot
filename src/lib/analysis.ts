/** Verbindet Kreditrechner und Investment-Modul: eine Funktion liefert alle Ergebnisse für einen Zustand. */
import {
  bearableVacancyMonths, bisectMax, project, rentBreakdown, requiredRent, reserveMonths, typicalMonth, yields,
  type InvestInput, type Projection, type RentBreakdown, type TypicalMonth, type Yields,
} from './invest';
import { balanceAfterYears, calculateLoan, type LoanInput, type LoanResult } from './loan';
import { effectiveState, financing, toLoanInput, type AppState, type Financing } from './state';

export interface Analysis {
  /** Zustand, mit dem tatsächlich gerechnet wird (vereinfachte Ansicht pausiert Erweitertes). */
  s: AppState;
  fin: Financing;
  loanInput: LoanInput;
  loan: LoanResult;
  invest: InvestInput;
  rent: RentBreakdown;
  month: TypicalMonth;
  yields: Yields;
  projection: Projection;
  variable: boolean;
  /** Typischer Monat im ersten Jahr nach der Fixzinsperiode (nur bei variablem Zins). */
  afterFix: TypicalMonth | null;
}

export function toInvestInput(s: AppState, fin: Financing): InvestInput {
  const i = s.invest;
  return {
    price: s.price,
    totalInvestment: fin.totalInvestment,
    ownFunds: fin.ownFunds,
    loanPrincipal: fin.loan,
    termYears: s.termYears,
    acquisitionCosts: fin.acquisitionCosts,
    financingCosts: fin.financingCosts,
    renovation: fin.renovation,
    renovationTax: i.renovationTax,
    rent: i.rent,
    costs: i.costs,
    startMonth: i.startMonth,
    rentGrowth: i.rentGrowth,
    costGrowth: i.costGrowth,
    vacancyMonths: i.vacancyMonths,
    rentLoss: i.rentLoss,
    freeMonths: i.freeMonths,
    tenantChangeYears: i.tenantChangeYears,
    tenantChangeCost: i.tenantChangeCost,
    reletBrokerMonths: i.reletBrokerMonths,
    rentAdjustments: i.rentAdjustments,
    valueGrowth: i.valueGrowth,
    horizonYears: i.horizonYears,
    tax: i.tax,
  };
}

/** Schnelle Variante ohne Prognose, für Break-even-Suchen. */
function quick(raw: AppState) {
  const s = effectiveState(raw);
  const fin = financing(s);
  const loanInput = toLoanInput(s);
  const loan = calculateLoan(loanInput);
  const invest = toInvestInput(s, fin);
  const month = typicalMonth(invest, loan.firstPayment, s.extra.monthlyAmount);
  return { s, fin, loanInput, loan, invest, month };
}

export function analyze(raw: AppState): Analysis {
  const q = quick(raw);
  const { s, loan, invest } = q;
  const variable = s.mode === 'variabel' && s.fixYears < s.termYears;
  const afterFix = variable && loan.paymentAfterFix !== null ? typicalMonth(invest, loan.paymentAfterFix, s.extra.monthlyAmount, Math.min(s.fixYears + 1, s.termYears)) : null;
  return { ...q, rent: rentBreakdown(invest.rent), yields: yields(invest, q.month), projection: project(invest, loan), variable, afterFix };
}

export interface BreakEven {
  rentForZero: number;
  rentForTarget: number;
  /** Höchster Kaufpreis für die Ziel-Nettomietrendite auf die Gesamtinvestition. */
  maxPriceNet: number | null;
  /** Höchster Kaufpreis für dieselbe Zielrendite als Bruttomietrendite. */
  maxPriceGross: number | null;
  /** Mindest-Eigenkapital für Cashflow ≥ 0; null = auch ohne Kredit nicht positiv. */
  equityForPositive: number | null;
  /** Höchster Zinssatz mit Cashflow ≥ 0; null = schon heute negativ. */
  maxRate: number | null;
  maxRateLabel: string;
  vacancyMonthsPerYear: number;
  reserveMonths: number;
}

export function breakEven(raw: AppState, a: Analysis): BreakEven {
  const inv = raw.invest;
  const target = Math.max(0.1, inv.targetYield) / 100;

  // Cashflow steigt mit dem Eigenkapital, also fällt er mit (−Eigenkapital).
  const maxEquity = a.fin.totalInvestment;
  const cfAtEquity = (e: number) => quick({ ...raw, manualLoan: false, equity: e }).month.cashflow;
  const negEquity = bisectMax((x) => cfAtEquity(-x), -maxEquity, 0);

  // Zins: bei Fixzins der Fixzins selbst, sonst der variable Zins nach der Fixzinsperiode.
  let maxRate: number | null;
  let maxRateLabel: string;
  if (a.variable) {
    const year = Math.min(a.s.fixYears + 1, a.s.termYears);
    const cfAtRate = (rate: number) => {
      const st: AppState = { ...a.s, useReference: false, rateChanges: [], variableRate: rate };
      const loan = calculateLoan(toLoanInput(st));
      return typicalMonth(a.invest, loan.paymentAfterFix ?? loan.firstPayment, st.extra.monthlyAmount, year).cashflow;
    };
    maxRate = bisectMax(cfAtRate, 0, 25);
    maxRateLabel = `variabler Zins ab Jahr ${year}`;
  } else {
    maxRate = bisectMax((rate) => quick({ ...raw, fixRate: rate }).month.cashflow, 0, 25);
    maxRateLabel = 'Fixzins';
  }

  // Kaufpreis: Nebenkosten skalieren mit dem Preis, daher Bisektion über die echte Rechnung (ohne Kredit-Rückwirkung).
  const netYieldAt = (price: number) => {
    const st: AppState = { ...a.s, price, equity: Math.min(a.s.equity, price) };
    const fin = financing(st);
    return fin.totalInvestment > 0 ? (a.month.netOperating * 12) / fin.totalInvestment - target : -1;
  };
  const maxPriceNet = a.month.netOperating > 0 ? bisectMax(netYieldAt, 1000, 20_000_000) : null;

  return {
    rentForZero: requiredRent(a.invest, a.month, 0),
    rentForTarget: requiredRent(a.invest, a.month, inv.targetCashflow),
    maxPriceNet,
    maxPriceGross: a.month.incomeFull > 0 ? (a.month.incomeFull * 12) / target : null,
    equityForPositive: negEquity === null ? null : Math.max(0, -negEquity),
    maxRate,
    maxRateLabel,
    vacancyMonthsPerYear: bearableVacancyMonths(a.invest, a.month),
    reserveMonths: reserveMonths(a.invest, a.month, inv.reserve),
  };
}

export interface CompareMetrics {
  totalInvestment: number;
  ownFunds: number;
  loan: number;
  payment: number;
  cashflow: number;
  grossYield: number;
  netYield: number;
  balance10: number;
  irr: number | null;
  /** Beleihung: Kredit / Kaufpreis in %. */
  ltv: number;
  /** Schuldendienstdeckung: Ertrag nach Kosten / Kreditrate. */
  dscr: number | null;
  risk: 'niedrig' | 'mittel' | 'hoch';
}

export function compareMetrics(raw: AppState): CompareMetrics {
  const a = analyze({ ...raw, viewMode: 'erweitert' });
  const dscr = a.month.payment > 0 ? a.month.netOperating / a.month.payment : null;
  const ltv = a.s.price > 0 ? (a.fin.loan / a.s.price) * 100 : 0;
  const worst = a.afterFix && a.afterFix.payment > 0 ? Math.min(dscr ?? Infinity, a.afterFix.netOperating / a.afterFix.payment) : dscr;
  const risk = worst === null ? 'niedrig' : worst < 1 || ltv > 100 ? 'hoch' : worst < 1.2 || ltv > 80 || a.variable ? 'mittel' : 'niedrig';
  return {
    totalInvestment: a.fin.totalInvestment, ownFunds: a.fin.ownFunds, loan: a.fin.loan, payment: a.month.payment, cashflow: a.month.cashflow,
    grossYield: a.yields.grossOnPrice, netYield: a.yields.netOnTotal,
    balance10: balanceAfterYears(a.loan, Math.min(10, a.s.termYears), a.fin.loan), irr: a.projection.irr, ltv, dscr, risk,
  };
}
