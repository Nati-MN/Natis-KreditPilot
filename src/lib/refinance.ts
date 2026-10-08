/** Umschuldungsrechner: bestehender Kredit gegen neues Angebot, beide über den gemeinsamen Kern gerechnet. */
import { calculateLoan, NO_EXTRAS, round2, type LoanInput, type LoanMode, type LoanResult } from './loan';

export interface RefiState {
  balance: number;
  oldRate: number;
  remainingMonths: number;
  oldMonthlyFee: number;
  /** Entschädigung für die vorzeitige Rückzahlung in % der Restschuld. */
  penaltyPercent: number;
  /** Wechselkosten in €: Löschung und Neueintragung des Pfandrechts, Beglaubigung, Schätzung. */
  switchCosts: number;
  newMode: LoanMode;
  newRate: number;
  newFixYears: number;
  newVariableRate: number;
  /** 0 = gleiche Restlaufzeit wie bisher. */
  newTermMonths: number;
  newSetupPercent: number;
  newSetupEuro: number;
  newMonthlyFee: number;
  /** Kosten des Wechsels über den neuen Kredit finanzieren. */
  financeCosts: boolean;
  /** Bisherige Rate beibehalten und dadurch schneller fertig werden. */
  keepPayment: boolean;
}

export const DEFAULT_REFI: RefiState = {
  balance: 150000, oldRate: 4.9, remainingMonths: 240, oldMonthlyFee: 8, penaltyPercent: 1, switchCosts: 1800,
  newMode: 'fix', newRate: 3.6, newFixYears: 10, newVariableRate: 4, newTermMonths: 0, newSetupPercent: 1, newSetupEuro: 0, newMonthlyFee: 6,
  financeCosts: false, keepPayment: false,
};

export interface RefiResult {
  old: LoanResult;
  neu: LoanResult;
  oldPayment: number;
  newPayment: number;
  penalty: number;
  setup: number;
  /** Alle Kosten des Wechsels. */
  upfront: number;
  newPrincipal: number;
  oldTotal: number;
  newTotal: number;
  /** Ersparnis pro Monat inkl. Kontoführung (positiv = günstiger). */
  monthlySaving: number;
  netSaving: number;
  /** Monat, ab dem sich der Wechsel gerechnet hat; null = nie. */
  breakEvenMonth: number | null;
  newMonths: number;
  /** Vermögensvorteil des Wechsels je Monat (für das Diagramm). */
  advantage: { month: number; value: number }[];
}

const fixLoan = (principal: number, months: number, rate: number, fee: number): LoanInput => ({
  principal, termYears: months / 12, termMonths: months, mode: 'fix', fixRate: rate, fixYears: months / 12, variableRate: rate,
  rateChanges: [], useReference: false, referenceRate: 0, margin: 0, adjustMonths: 3, extra: { ...NO_EXTRAS }, monthlyFees: fee,
});

export function calculateRefi(s: RefiState, rateDelta = 0): RefiResult {
  const months = Math.max(1, Math.round(s.remainingMonths));
  const old = calculateLoan(fixLoan(s.balance, months, s.oldRate, s.oldMonthlyFee), false);
  const penalty = round2((s.balance * s.penaltyPercent) / 100);
  const pctSetup = s.newSetupPercent / 100;
  // Bei Mitfinanzierung hängt die prozentuale Gebühr vom neuen Kreditbetrag ab: K = (Restschuld + fixe Kosten) / (1 − Satz).
  const newPrincipal = s.financeCosts ? round2((s.balance + penalty + s.switchCosts + s.newSetupEuro) / (1 - Math.min(0.5, pctSetup))) : s.balance;
  const setup = round2(newPrincipal * pctSetup + s.newSetupEuro);
  const upfront = round2(penalty + s.switchCosts + setup);
  const newMonths = s.newTermMonths > 0 ? Math.round(s.newTermMonths) : months;
  const variable = s.newMode === 'variabel' && s.newFixYears * 12 < newMonths;
  const neu = calculateLoan({
    ...fixLoan(newPrincipal, newMonths, Math.max(0, s.newRate + (variable ? 0 : rateDelta)), s.newMonthlyFee),
    mode: variable ? 'variabel' : 'fix',
    fixYears: variable ? s.newFixYears : newMonths / 12,
    variableRate: Math.max(0, s.newVariableRate + rateDelta),
    fixedPayment: s.keepPayment ? old.firstPayment : null,
  }, false);
  const cash = s.financeCosts ? 0 : upfront;
  const oldTotal = old.grandTotal;
  const newTotal = round2(neu.grandTotal + cash);

  // Vorteil zum Zeitpunkt m: bisher weniger gezahlt, korrigiert um die Differenz der Restschuld und die bar bezahlten Kosten.
  const advantage: { month: number; value: number }[] = [];
  let cumOld = 0;
  let cumNew = 0;
  let breakEvenMonth: number | null = null;
  const horizon = Math.max(old.rows.length, neu.rows.length);
  for (let m = 1; m <= horizon; m++) {
    const o = old.rows[m - 1];
    const n = neu.rows[m - 1];
    cumOld += o?.total ?? 0;
    cumNew += n?.total ?? 0;
    const balOld = o ? o.balance : 0;
    const balNew = n ? n.balance : neu.finalBalance;
    const value = round2(cumOld - cumNew - cash - (balNew - balOld));
    advantage.push({ month: m, value });
    if (breakEvenMonth === null && value >= 0) breakEvenMonth = m;
  }
  // Ein später wieder negativer Verlauf zählt nicht als Break-even.
  if (advantage.length && advantage[advantage.length - 1].value < 0) breakEvenMonth = null;

  return {
    old, neu, oldPayment: old.firstPayment, newPayment: neu.firstPayment, penalty, setup, upfront, newPrincipal, oldTotal, newTotal,
    monthlySaving: round2(old.firstPayment + s.oldMonthlyFee - neu.firstPayment - s.newMonthlyFee),
    netSaving: round2(oldTotal - newTotal),
    breakEvenMonth,
    newMonths: neu.months,
    advantage,
  };
}
