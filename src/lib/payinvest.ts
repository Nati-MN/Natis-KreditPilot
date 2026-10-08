/**
 * Sondertilgen oder investieren? Vergleich des Nettovermögens am Ende des Betrachtungszeitraums.
 * Weg A: Betrag in den Kredit. Ist der Kredit früher fertig, wird die frei gewordene Rate angelegt.
 * Weg B: Betrag anlegen, Kredit läuft unverändert.
 * Anlagerenditen sind unsichere Annahmen. Kursgewinne werden am Ende einmal besteuert.
 */
import { calculateLoan, round2, type ExtraRule, type LoanInput, type LoanResult } from './loan';

export interface PoiState {
  amount: number;
  monthly: number;
  horizonYears: number;
  returnLow: number;
  returnMid: number;
  returnHigh: number;
  /** Laufende Anlagekosten in % p.a. */
  costs: number;
  /** Steuer auf Kursgewinne in % (Österreich: KESt 27,5 %). */
  taxRate: number;
}

export const DEFAULT_POI: PoiState = { amount: 10000, monthly: 0, horizonYears: 15, returnLow: 1, returnMid: 5, returnHigh: 8, costs: 0.3, taxRate: 27.5 };

export interface PoiScenario {
  label: string;
  returnPercent: number;
  /** Weg B: Depotwert vor Steuer, Steuer, Kosten, Depot netto. */
  investGross: number;
  tax: number;
  costs: number;
  investNet: number;
  /** Nettovermögen = Depot netto − Restschuld. */
  wealthInvest: number;
  wealthRepay: number;
  /** Positiv: Investieren liegt vorne. */
  diff: number;
}

export interface PoiResult {
  base: LoanResult;
  repay: LoanResult;
  interestSaved: number;
  monthsSaved: number;
  prepayFees: number;
  horizonMonths: number;
  scenarios: PoiScenario[];
  /** Rendite vor Kosten und Steuer, ab der Investieren gleich gut ist; null wenn außerhalb 0–30 %. */
  breakEvenReturn: number | null;
}

/** Wert regelmäßiger Einzahlungen bei monatlicher Verzinsung; liefert Endwert und Summe der Einzahlungen. */
function grow(contrib: (m: number) => number, months: number, annualPercent: number) {
  const i = annualPercent / 100 / 12;
  let value = 0;
  let paid = 0;
  for (let m = 0; m <= months; m++) {
    if (m > 0) value *= 1 + i;
    const c = contrib(m);
    value += c;
    paid += c;
  }
  return { value, paid };
}

export function calculatePoi(p: PoiState, loan: LoanInput): PoiResult {
  const rules: ExtraRule[] = [
    ...(loan.extraRules ?? []),
    ...(p.amount > 0 ? [{ id: 'poi-einmal', label: 'Vergleich', interval: 'einmalig' as const, unit: 'euro' as const, amount: p.amount, from: 1, to: null }] : []),
    ...(p.monthly > 0 ? [{ id: 'poi-monat', label: 'Vergleich', interval: 'monatlich' as const, unit: 'euro' as const, amount: p.monthly, from: 1, to: null }] : []),
  ];
  const base = calculateLoan({ ...loan, extra: { ...loan.extra, strategy: 'laufzeit' } }, false);
  const repay = calculateLoan({ ...loan, extra: { ...loan.extra, strategy: 'laufzeit' }, extraRules: rules }, false);
  const H = Math.max(1, Math.round(p.horizonYears * 12));
  const balanceAt = (r: LoanResult, m: number) => (m <= 0 ? loan.principal : m > r.rows.length ? r.finalBalance : r.rows[m - 1].balance);
  const outAt = (r: LoanResult, m: number) => (m >= 1 && m <= r.rows.length ? r.rows[m - 1].total : 0);

  // Beide Wege geben jeden Monat gleich viel Geld aus (normale Rate + Zusatzbetrag).
  // Weg B legt den Zusatzbetrag an. Weg A tilgt damit und legt an, was nach dem früheren Kreditende frei wird.
  const extraBudget = (m: number) => (m < 1 ? 0 : p.monthly + (m === 1 ? p.amount : 0));
  const investB = (m: number) => extraBudget(m);
  const investA = (m: number) => (m < 1 ? 0 : Math.max(0, outAt(base, m) + extraBudget(m) - outAt(repay, m)));

  const wealth = (annual: number) => {
    const after = (contrib: (m: number) => number) => {
      const g = grow(contrib, H, annual - p.costs);
      const gross = grow(contrib, H, annual);
      const tax = (Math.max(0, g.value - g.paid) * p.taxRate) / 100;
      return { gross: g.value, tax, costs: Math.max(0, gross.value - g.value), netValue: g.value - tax };
    };
    const a = after(investA);
    const b = after(investB);
    return { a, b, wealthA: a.netValue - balanceAt(repay, H), wealthB: b.netValue - balanceAt(base, H) };
  };

  const scenario = (label: string, r: number): PoiScenario => {
    const w = wealth(r);
    return {
      label, returnPercent: r, investGross: round2(w.b.gross), tax: round2(w.b.tax), costs: round2(w.b.costs), investNet: round2(w.b.netValue),
      wealthInvest: round2(w.wealthB), wealthRepay: round2(w.wealthA), diff: round2(w.wealthB - w.wealthA),
    };
  };

  // Break-even-Rendite per Bisektion (Differenz wächst mit der Rendite).
  const diff = (r: number) => { const w = wealth(r); return w.wealthB - w.wealthA; };
  let breakEvenReturn: number | null = null;
  if (diff(0) < 0 && diff(30) > 0) {
    let lo = 0;
    let hi = 30;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (diff(mid) < 0) lo = mid;
      else hi = mid;
    }
    breakEvenReturn = (lo + hi) / 2;
  } else if (diff(0) >= 0) breakEvenReturn = 0;

  return {
    base, repay,
    interestSaved: round2(base.totalInterest - repay.totalInterest),
    monthsSaved: base.months - repay.months,
    prepayFees: round2(repay.prepayFees - base.prepayFees),
    horizonMonths: H,
    scenarios: [scenario('Schwach', p.returnLow), scenario('Mittel', p.returnMid), scenario('Stark', p.returnHigh)],
    breakEvenReturn,
  };
}
