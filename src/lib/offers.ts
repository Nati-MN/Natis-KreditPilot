/** Kreditvergleich mehrerer Angebote und Zins-Szenarien. Rechnet ausschließlich über den gemeinsamen Kern in loan.ts. */
import { balanceAfterYears, calculateLoan, NO_EXTRAS, round2, type LoanInput, type LoanMode, type LoanResult, type LoanType } from './loan';

export interface Offer {
  id: string;
  name: string;
  amount: number;
  termYears: number;
  type: LoanType;
  mode: LoanMode;
  fixRate: number;
  fixYears: number;
  variableRate: number;
  /** Bearbeitungsgebühr in % des Kreditbetrags und als fixer Betrag. */
  setupPercent: number;
  setupEuro: number;
  accountMonthly: number;
  /** Sonstige verpflichtende Kosten pro Monat (z. B. Versicherung). */
  otherMonthly: number;
  /** Kostenlose Sondertilgung pro Jahr in % des Kreditbetrags (100 = unbegrenzt, 0 = keine). */
  extraFreePercent: number;
  /** Entschädigung bei vorzeitiger Rückzahlung in %. */
  prepayFeePercent: number;
}

export function offerInput(o: Offer): LoanInput {
  return {
    principal: Math.max(0, o.amount),
    termYears: o.termYears,
    mode: o.mode,
    fixRate: o.fixRate,
    fixYears: Math.min(o.fixYears, o.termYears),
    variableRate: o.variableRate,
    rateChanges: [],
    useReference: false,
    referenceRate: 0,
    margin: 0,
    adjustMonths: 3,
    extra: { ...NO_EXTRAS },
    type: o.type,
    oneTimeCosts: round2((o.amount * o.setupPercent) / 100 + o.setupEuro),
    monthlyFees: round2(o.accountMonthly + o.otherMonthly),
  };
}

export interface OfferMetrics {
  offer: Offer;
  result: LoanResult;
  variable: boolean;
  paymentAfterFix: number | null;
  balanceAfterFix: number | null;
  /** Anteil der Laufzeit mit variablem Zins (0–1). */
  variableShare: number;
  /** Mehrkosten gegenüber dem günstigsten Angebot (Zinsen + Gebühren). */
  costDiff: number;
  /** Getrennte Bewertungen von 1 (schwach) bis 5 (stark). */
  scoreCost: number;
  scoreFlex: number;
  scoreRisk: number;
}

/** Flexibilität: Sondertilgungsrecht und Entschädigung, unabhängig von den Kosten. */
export function flexScore(o: Offer): number {
  let pts = o.extraFreePercent >= 100 ? 3 : o.extraFreePercent >= 10 ? 2 : o.extraFreePercent > 0 ? 1 : 0;
  pts += o.prepayFeePercent <= 0 ? 1 : 0;
  return Math.min(5, 1 + pts);
}

export function compareOffers(offers: Offer[]): OfferMetrics[] {
  const base = offers.map((o) => {
    const result = calculateLoan(offerInput(o));
    const variable = o.mode === 'variabel' && o.fixYears < o.termYears;
    return { o, result, variable };
  });
  const aprs = base.map((b) => b.result.apr ?? Infinity).filter(Number.isFinite);
  const minApr = Math.min(...aprs);
  const maxApr = Math.max(...aprs);
  const minCost = Math.min(...base.map((b) => b.result.totalCost));
  return base.map(({ o, result, variable }) => {
    const share = variable ? (o.termYears - o.fixYears) / o.termYears : 0;
    const apr = result.apr;
    return {
      offer: o,
      result,
      variable,
      paymentAfterFix: variable ? result.paymentAfterFix : null,
      balanceAfterFix: variable ? balanceAfterYears(result, o.fixYears, o.amount) : null,
      variableShare: share,
      costDiff: round2(result.totalCost - minCost),
      // Kosten: bester Effektivzins = 5, schlechtester = 1 (bei gleichen Werten 5).
      scoreCost: apr === null ? 1 : maxApr - minApr < 1e-9 ? 5 : Math.round((5 - (4 * (apr - minApr)) / (maxApr - minApr)) * 10) / 10,
      scoreFlex: flexScore(o),
      // Zinsrisiko: durchgehend fix = 5, vollständig variabel = 1.
      scoreRisk: Math.round((5 - 4 * share) * 10) / 10,
    };
  });
}

export const EXAMPLE_OFFERS: Offer[] = [
  { id: 'a', name: 'Beispiel A: 30 Jahre fix', amount: 89000, termYears: 30, type: 'annuitaet', mode: 'fix', fixRate: 3.6, fixYears: 30, variableRate: 3.6, setupPercent: 1, setupEuro: 0, accountMonthly: 6, otherMonthly: 0, extraFreePercent: 0, prepayFeePercent: 1 },
  { id: 'b', name: 'Beispiel B: 10 Jahre fix', amount: 89000, termYears: 30, type: 'annuitaet', mode: 'variabel', fixRate: 3.2, fixYears: 10, variableRate: 4, setupPercent: 1.5, setupEuro: 0, accountMonthly: 5, otherMonthly: 0, extraFreePercent: 10, prepayFeePercent: 1 },
  { id: 'c', name: 'Beispiel C: variabel', amount: 89000, termYears: 30, type: 'annuitaet', mode: 'variabel', fixRate: 2.9, fixYears: 1, variableRate: 3.4, setupPercent: 0.5, setupEuro: 150, accountMonthly: 8, otherMonthly: 0, extraFreePercent: 100, prepayFeePercent: 0 },
];

// ---------- Zins-Simulator ----------
export interface RateScenario {
  label: string;
  delta: number;
  /** Zinssatz nach der Fixzinsperiode. */
  rate: number;
  result: LoanResult;
  paymentAfterFix: number;
  /** Unterschied zu „bleibt unverändert“. */
  interestDiff: number;
  paymentDiff: number;
}

/**
 * Simuliert, was nach der Fixzinsperiode passiert, wenn der Zins um `delta` Prozentpunkte vom Ausgangswert abweicht.
 * `baseRate` ist der angenommene Zins nach der Fixzinsperiode im Szenario „bleibt unverändert“.
 */
export function rateScenarios(input: LoanInput, fixYears: number, baseRate: number, deltas: { label: string; delta: number }[]): RateScenario[] {
  const run = (delta: number) => {
    const rate = Math.max(0, round2(baseRate + delta));
    const result = calculateLoan({
      ...input, mode: 'variabel', fixYears, useReference: false, variableRate: rate,
      rateChanges: input.rateChanges.map((c) => ({ ...c, rate: Math.max(0, c.rate + delta) })),
    }, false);
    return { rate, result };
  };
  const base = run(0);
  const basePay = base.result.paymentAfterFix ?? base.result.firstPayment;
  return deltas.map(({ label, delta }) => {
    const { rate, result } = delta === 0 ? base : run(delta);
    const pay = result.paymentAfterFix ?? result.firstPayment;
    return { label, delta, rate, result, paymentAfterFix: pay, interestDiff: round2(result.totalInterest - base.result.totalInterest), paymentDiff: round2(pay - basePay) };
  });
}
