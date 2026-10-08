/**
 * KreditPilot – Berechnungslogik (ohne UI-Abhängigkeiten).
 * Annuitätendarlehen mit monatlicher Zahlung, Nominalzins p.a. / 12.
 * Alle Geldbeträge werden intern auf Cent gerundet.
 */

export type LoanMode = 'fix' | 'variabel';
export type ExtraStrategy = 'laufzeit' | 'rate';

export interface RateChange {
  /** Kreditjahr, ab dessen erstem Monat der Wert gilt (z. B. 11). */
  year: number;
  /** Zinssatz in % p.a. (bei Referenzzins-Modell: Wert des Referenzzinses). */
  rate: number;
}

export interface ExtraPayments {
  oneTimeAmount: number;
  /** Kreditjahr, an dessen Ende die einmalige Sondertilgung erfolgt. */
  oneTimeYear: number;
  /** Jährlich, jeweils am Ende jedes Kreditjahres. */
  yearlyAmount: number;
  monthlyAmount: number;
  strategy: ExtraStrategy;
}

export interface LoanInput {
  principal: number;
  termYears: number;
  mode: LoanMode;
  /** Fixzins in % p.a. */
  fixRate: number;
  /** Dauer der Fixzinsperiode in Jahren (nur Modus "variabel"). */
  fixYears: number;
  /** Variabler Zins direkt nach der Fixzinsperiode, % p.a. */
  variableRate: number;
  rateChanges: RateChange[];
  /** Variabler Zins = Referenzzins + Aufschlag. */
  useReference: boolean;
  referenceRate: number;
  margin: number;
  /** Zinsanpassungsintervall in Monaten (Referenzzins-Modell). */
  adjustMonths: number;
  extra: ExtraPayments;
}

export interface ScheduleRow {
  month: number;
  year: number;
  /** Reguläre Rate (Zinsen + planmäßige Tilgung). */
  payment: number;
  interest: number;
  /** Planmäßige Tilgung. */
  principal: number;
  /** Sondertilgung in diesem Monat. */
  extra: number;
  balance: number;
  /** Zinssatz in % p.a. */
  rate: number;
}

export interface YearRow {
  year: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
  /** Zinssatz am Jahresende. */
  rate: number;
  /** Reguläre Monatsrate am Jahresende. */
  monthlyPayment: number;
}

export interface LoanResult {
  rows: ScheduleRow[];
  years: YearRow[];
  firstPayment: number;
  /** Erste reguläre Rate nach Ende der Fixzinsperiode (falls vorhanden). */
  paymentAfterFix: number | null;
  maxPayment: number;
  totalInterest: number;
  /** Summe aller Zahlungen inkl. Sondertilgungen. */
  totalPaid: number;
  totalExtra: number;
  months: number;
  interestShare: number;
}

export const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

/** Annuität: A = K · [i · (1 + i)^n] / [(1 + i)^n − 1]; bei 0 % Zins: K / n. */
export function annuity(principal: number, ratePercent: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const i = ratePercent / 100 / 12;
  if (Math.abs(i) < 1e-12) return round2(principal / months);
  const f = Math.pow(1 + i, months);
  return round2((principal * (i * f)) / (f - 1));
}

/** Anzahl Monate, bis eine Restschuld bei gegebener Rate getilgt ist. */
export function monthsToRepay(balance: number, ratePercent: number, payment: number): number {
  if (balance <= 0) return 0;
  if (payment <= 0) return Infinity;
  const i = ratePercent / 100 / 12;
  if (Math.abs(i) < 1e-12) return Math.ceil(balance / payment - 1e-9);
  if (payment <= balance * i) return Infinity;
  return Math.ceil(-Math.log(1 - (balance * i) / payment) / Math.log(1 + i) - 1e-9);
}

/** Zinssatz (in % p.a.), der im angegebenen Kreditmonat gilt. */
export function rateForMonth(input: LoanInput, month: number): number {
  const termMonths = Math.round(input.termYears * 12);
  if (input.mode === 'fix') return input.fixRate;
  const fixMonths = Math.min(Math.round(input.fixYears * 12), termMonths);
  if (month <= fixMonths) return input.fixRate;

  // Zinsanpassungen greifen nur an Anpassungsterminen.
  let effMonth = month;
  if (input.useReference) {
    const step = Math.max(1, Math.round(input.adjustMonths));
    const first = fixMonths + 1;
    effMonth = first + Math.floor((month - first) / step) * step;
  }
  let value = input.useReference ? input.referenceRate : input.variableRate;
  let bestStart = -1;
  for (const c of input.rateChanges) {
    const start = (Math.round(c.year) - 1) * 12 + 1;
    if (start > fixMonths && start <= effMonth && start >= bestStart) {
      bestStart = start;
      value = c.rate;
    }
  }
  const rate = input.useReference ? value + input.margin : value;
  return Math.max(0, round2(rate * 1000) / 1000);
}

function extraForMonth(e: ExtraPayments, month: number): number {
  let sum = Math.max(0, e.monthlyAmount || 0);
  if (month % 12 === 0) sum += Math.max(0, e.yearlyAmount || 0);
  if (e.oneTimeAmount > 0 && month === Math.round(e.oneTimeYear) * 12) sum += e.oneTimeAmount;
  return round2(sum);
}

export function hasExtras(e: ExtraPayments): boolean {
  return e.oneTimeAmount > 0 || e.yearlyAmount > 0 || e.monthlyAmount > 0;
}

export function calculateLoan(input: LoanInput): LoanResult {
  const n = Math.max(1, Math.round(input.termYears * 12));
  const fixMonths = input.mode === 'variabel' ? Math.min(Math.round(input.fixYears * 12), n) : n;
  const rows: ScheduleRow[] = [];
  let balance = round2(Math.max(0, input.principal));
  let rate = rateForMonth(input, 1);
  let payment = annuity(balance, rate, n);
  let extraPaid = false;
  let paymentAfterFix: number | null = null;

  for (let m = 1; m <= n && balance > 0.004; m++) {
    const newRate = rateForMonth(input, m);
    if (m > 1 && newRate !== rate) {
      // Neue Rate aus tatsächlicher Restschuld, neuem Zins und Restlaufzeit.
      let remaining = n - m + 1;
      if (extraPaid && input.extra.strategy === 'laufzeit') {
        const shortened = monthsToRepay(balance, rate, payment);
        if (Number.isFinite(shortened)) remaining = Math.max(1, Math.min(remaining, shortened));
      }
      rate = newRate;
      payment = annuity(balance, rate, remaining);
    }

    const interest = round2((balance * rate) / 100 / 12);
    let regular = payment;
    // Letzte Rate anpassen, damit die Restschuld exakt 0 € erreicht.
    if (m === n || regular >= balance + interest) regular = round2(balance + interest);
    const principalPart = round2(regular - interest);
    balance = round2(balance - principalPart);

    let extra = Math.min(extraForMonth(input.extra, m), balance);
    extra = round2(Math.max(0, extra));
    if (extra > 0) {
      balance = round2(balance - extra);
      extraPaid = true;
      if (input.extra.strategy === 'rate' && balance > 0 && m < n) {
        payment = annuity(balance, rate, n - m);
      }
    }
    if (balance < 0.005) balance = 0;

    if (m === fixMonths + 1 && input.mode === 'variabel') paymentAfterFix = regular;
    rows.push({
      month: m,
      year: Math.ceil(m / 12),
      payment: regular,
      interest,
      principal: principalPart,
      extra,
      balance,
      rate,
    });
  }

  const years: YearRow[] = [];
  for (const r of rows) {
    let y = years[r.year - 1];
    if (!y) {
      y = { year: r.year, payment: 0, interest: 0, principal: 0, extra: 0, balance: 0, rate: r.rate, monthlyPayment: r.payment };
      years.push(y);
    }
    y.payment = round2(y.payment + r.payment);
    y.interest = round2(y.interest + r.interest);
    y.principal = round2(y.principal + r.principal);
    y.extra = round2(y.extra + r.extra);
    y.balance = r.balance;
    y.rate = r.rate;
    // Die (ggf. kleinere) Schlussrate soll die Jahresanzeige nicht verfälschen.
    if (r.balance > 0 || y.monthlyPayment === 0) y.monthlyPayment = r.payment;
  }

  const totalInterest = round2(rows.reduce((s, r) => s + r.interest, 0));
  const totalExtra = round2(rows.reduce((s, r) => s + r.extra, 0));
  const totalPaid = round2(rows.reduce((s, r) => s + r.payment + r.extra, 0));
  return {
    rows,
    years,
    firstPayment: rows[0]?.payment ?? 0,
    paymentAfterFix,
    maxPayment: rows.reduce((mx, r) => Math.max(mx, r.payment), 0),
    totalInterest,
    totalPaid,
    totalExtra,
    months: rows.length,
    interestShare: totalPaid > 0 ? totalInterest / totalPaid : 0,
  };
}

/** Restschuld nach x vollen Jahren. */
export function balanceAfterYears(result: LoanResult, years: number, principal: number): number {
  if (years <= 0) return round2(principal);
  const idx = Math.round(years * 12) - 1;
  if (idx >= result.rows.length) return 0;
  return result.rows[idx].balance;
}

export const NO_EXTRAS: ExtraPayments = {
  oneTimeAmount: 0,
  oneTimeYear: 1,
  yearlyAmount: 0,
  monthlyAmount: 0,
  strategy: 'laufzeit',
};

export interface ExtraEffect {
  interestSaved: number;
  monthsSaved: number;
  /** Reguläre Rate am Ende mit bzw. ohne Sondertilgung. */
  paymentWithout: number;
  paymentWith: number;
}

export function extraEffect(input: LoanInput, withExtras: LoanResult): ExtraEffect {
  const base = calculateLoan({ ...input, extra: { ...NO_EXTRAS } });
  const lastRegular = (r: LoanResult) => {
    const rows = r.rows;
    return rows.length > 1 ? rows[rows.length - 2].payment : (rows[0]?.payment ?? 0);
  };
  return {
    interestSaved: round2(base.totalInterest - withExtras.totalInterest),
    monthsSaved: base.months - withExtras.months,
    paymentWithout: lastRegular(base),
    paymentWith: lastRegular(withExtras),
  };
}
