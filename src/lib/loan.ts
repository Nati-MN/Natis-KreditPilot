/**
 * Kredit Pilot – gemeinsamer Rechenkern für alle Module (ohne UI-Abhängigkeiten).
 *
 * Formeln:
 *  - Annuität je Periode: A = K · i · (1+i)^n / ((1+i)^n − 1), i = Nominalzins · Periodenlänge, n = Perioden. Bei i = 0: K / n.
 *  - Ratentilgung: Tilgung = K / n je Periode, Rate = Tilgung + Zinsen.
 *  - Endfällig: nur Zinsen, Kapital am Ende.
 *  - Zinsen je Monat: Restschuld · Nominalzins · Tagesanteil (30/360: 1/12, act/360: Tage/360, act/365: Tage/365).
 *  - Effektivzins: Zinssatz X, bei dem Auszahlung = Σ Zahlung_t / (1+X)^(t in Jahren) gilt (EU-Formel, Monate = 1/12 Jahr).
 * Alle Buchungen werden auf Cent gerundet, die letzte Rate gleicht Rundungsdifferenzen aus.
 */

export type LoanMode = 'fix' | 'variabel';
export type LoanType = 'annuitaet' | 'raten' | 'endfaellig';
export type ExtraStrategy = 'laufzeit' | 'rate' | 'kombi';
export type DayCount = '30/360' | 'act/360' | 'act/365';
export type Interval = 1 | 3 | 6 | 12;

export interface RateChange {
  /** Kreditjahr, ab dessen erstem Monat der Wert gilt (z. B. 11). */
  year: number;
  /** Zinssatz in % p.a. (bei Referenzzins-Modell: Wert des Referenzzinses). */
  rate: number;
}

/** Schnelleingabe für Sondertilgungen (einmalig, jährlich, monatlich). */
export interface ExtraPayments {
  oneTimeAmount: number;
  /** Kreditjahr, an dessen Ende die einmalige Sondertilgung erfolgt. */
  oneTimeYear: number;
  /** Jährlich, jeweils am Ende jedes Kreditjahres. */
  yearlyAmount: number;
  monthlyAmount: number;
  strategy: ExtraStrategy;
}

/** Frei definierbare Sondertilgung. Monate zählen ab der ersten Rate (1 = erster Zahlungstermin). */
export interface ExtraRule {
  id: string;
  label: string;
  interval: 'einmalig' | 'monatlich' | 'quartal' | 'jaehrlich';
  unit: 'euro' | 'prozent';
  /** Betrag in € oder Prozent der aktuellen Restschuld. */
  amount: number;
  from: number;
  /** Letzter Monat (einschließlich); null = bis zum Ende. */
  to: number | null;
}

export interface LoanInput {
  principal: number;
  termYears: number;
  /** Laufzeit in Monaten; hat Vorrang vor termYears. */
  termMonths?: number;
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

  type?: LoanType;
  /** Tilgungsfreie Monate am Anfang (nur Zinsen). */
  graceMonths?: number;
  /** Zahlungsintervall in Monaten. */
  interval?: Interval;
  dayCount?: DayCount;
  /** Kreditbeginn 'YYYY-MM-DD'. Ohne Angabe gibt es keine Datumsangaben und 30/360. */
  startDate?: string;
  /** Erste Fälligkeit 'YYYY-MM-DD'; Standard: ein Monat nach Kreditbeginn. */
  firstDue?: string;
  /** Ober- und Untergrenze für den variablen Zins in % p.a. */
  rateCap?: number | null;
  rateFloor?: number | null;
  /** Feste Rate je Zahlungstermin (Wunschrate oder aus Anfangstilgung). Die Laufzeit ergibt sich daraus. */
  fixedPayment?: number | null;
  extraRules?: ExtraRule[];
  /** Vertragliche Obergrenze je Kreditjahr in % des ursprünglichen Kreditbetrags; 0 = keine. */
  extraLimitPercent?: number;
  /** Entschädigung für Sondertilgungen in der Fixzinsphase, % des Betrags über dem Freibetrag. */
  prepayFeePercent?: number;
  prepayFreePerYear?: number;
  /** Einmalige Kreditkosten zu Beginn (für Effektivzins und Gesamtkosten). */
  oneTimeCosts?: number;
  /** Laufende Kosten pro Monat (Kontoführung, Pflichtversicherung). */
  monthlyFees?: number;
}

export interface ScheduleRow {
  month: number;
  year: number;
  /** Fälligkeitsdatum 'YYYY-MM-DD' oder '' ohne Kreditbeginn. */
  date: string;
  /** Restschuld vor der Zahlung. */
  opening: number;
  /** Reguläre Rate (Zinsen + planmäßige Tilgung). */
  payment: number;
  interest: number;
  /** Planmäßige Tilgung. */
  principal: number;
  /** Sondertilgung in diesem Monat. */
  extra: number;
  /** Laufende Gebühren und Entschädigung für Sondertilgung. */
  fees: number;
  /** Gesamte Zahlung: Rate + Sondertilgung + Gebühren. */
  total: number;
  balance: number;
  /** Zinssatz in % p.a. */
  rate: number;
  /** Zahlungstermin (bei viertel-, halb- oder jährlicher Zahlung nicht jeder Monat). */
  due: boolean;
  rateChanged: boolean;
}

export interface YearRow {
  year: number;
  payment: number;
  interest: number;
  principal: number;
  extra: number;
  fees: number;
  total: number;
  balance: number;
  /** Zinssatz am Jahresende. */
  rate: number;
  /** Reguläre Rate am Jahresende. */
  monthlyPayment: number;
}

export interface LoanResult {
  rows: ScheduleRow[];
  years: YearRow[];
  /** Erste reguläre Rate (in einer tilgungsfreien Zeit: nur Zinsen). */
  firstPayment: number;
  /** Erste Rate nach der tilgungsfreien Zeit, sonst null. */
  paymentAfterGrace: number | null;
  /** Erste reguläre Rate nach Ende der Fixzinsperiode (falls vorhanden). */
  paymentAfterFix: number | null;
  maxPayment: number;
  /** Durchschnittliche Belastung pro Monat aus der ersten Rate (Rate / Intervall). */
  monthlyBurden: number;
  totalInterest: number;
  /** Summe aller Raten und Sondertilgungen (ohne Gebühren). */
  totalPaid: number;
  totalExtra: number;
  /** Laufende Gebühren + einmalige Kreditkosten + Entschädigungen. */
  totalFees: number;
  prepayFees: number;
  /** Zinsen + Gebühren. */
  totalCost: number;
  /** Alles, was insgesamt gezahlt wird: Raten, Sondertilgungen, Gebühren. */
  grandTotal: number;
  months: number;
  interestShare: number;
  /** Effektiver Jahreszins in % nach den eingestellten Zinsannahmen, ohne Sondertilgungen; null wenn nicht berechenbar. */
  apr: number | null;
  /** Datum der letzten Zahlung. */
  endDate: string;
  /** Die Rate deckt die Zinsen nicht: der Kredit wird nie getilgt. */
  neverRepaid: boolean;
  /** Restschuld am Ende (nur > 0, wenn neverRepaid). */
  finalBalance: number;
}

export const round2 = (v: number): number => {
  const r = Math.round((v + Number.EPSILON) * 100) / 100;
  return r === 0 ? 0 : r; // kein −0
};

// ---------- Datum ----------
const parse = (iso: string): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Addiert Monate; der Tag wird auf das Monatsende begrenzt (31.1. + 1 Monat = 28./29.2.). */
export function addMonths(iso: string, months: number): string {
  const p = parse(iso);
  if (!p) return '';
  const total = p[0] * 12 + (p[1] - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${pad(m)}-${pad(Math.min(p[2], daysInMonth(y, m)))}`;
}

export function daysBetween(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

/** Tage nach der europäischen 30/360-Methode. */
export function days30360(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  return (pb[0] - pa[0]) * 360 + (pb[1] - pa[1]) * 30 + (Math.min(pb[2], 30) - Math.min(pa[2], 30));
}

// ---------- Grundformeln ----------
/** Annuität: A = K · [i · (1 + i)^n] / [(1 + i)^n − 1]; bei 0 % Zins: K / n. `periodMonths` = Länge einer Periode. */
export function annuity(principal: number, ratePercent: number, periods: number, periodMonths = 1): number {
  if (principal <= 0 || periods <= 0) return 0;
  const i = (ratePercent / 100 / 12) * periodMonths;
  if (Math.abs(i) < 1e-12) return round2(principal / periods);
  const f = Math.pow(1 + i, periods);
  return round2((principal * (i * f)) / (f - 1));
}

/** Anzahl Perioden, bis eine Restschuld bei gegebener Rate getilgt ist. */
export function monthsToRepay(balance: number, ratePercent: number, payment: number, periodMonths = 1): number {
  if (balance <= 0) return 0;
  if (payment <= 0) return Infinity;
  const i = (ratePercent / 100 / 12) * periodMonths;
  if (Math.abs(i) < 1e-12) return Math.ceil(balance / payment - 1e-9);
  if (payment <= balance * i) return Infinity;
  return Math.ceil(-Math.log(1 - (balance * i) / payment) / Math.log(1 + i) - 1e-9);
}

/** Rückwärtsrechnung: Kreditbetrag, den eine Monatsrate über die Laufzeit trägt (Barwert der Annuität). */
export function principalForPayment(payment: number, ratePercent: number, months: number): number {
  if (payment <= 0 || months <= 0) return 0;
  const i = ratePercent / 100 / 12;
  if (Math.abs(i) < 1e-12) return round2(payment * months);
  return round2((payment * (1 - Math.pow(1 + i, -months))) / i);
}

export const termMonthsOf = (input: LoanInput) => Math.max(1, Math.round(input.termMonths ?? input.termYears * 12));

/** Zinssatz (in % p.a.), der im angegebenen Kreditmonat gilt. */
export function rateForMonth(input: LoanInput, month: number): number {
  const termMonths = termMonthsOf(input);
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
  let rate = input.useReference ? value + input.margin : value;
  if (input.rateCap != null && Number.isFinite(input.rateCap)) rate = Math.min(rate, input.rateCap);
  if (input.rateFloor != null && Number.isFinite(input.rateFloor)) rate = Math.max(rate, input.rateFloor);
  return Math.max(0, round2(rate * 1000) / 1000);
}

// ---------- Sondertilgungen ----------
function quickExtra(e: ExtraPayments, month: number): number {
  let sum = Math.max(0, e.monthlyAmount || 0);
  if (month % 12 === 0) sum += Math.max(0, e.yearlyAmount || 0);
  if (e.oneTimeAmount > 0 && month === Math.round(e.oneTimeYear) * 12) sum += e.oneTimeAmount;
  return sum;
}

function ruleApplies(r: ExtraRule, month: number): boolean {
  const from = Math.max(1, Math.round(r.from));
  if (month < from) return false;
  if (r.interval === 'einmalig') return month === from;
  if (r.to != null && month > Math.round(r.to)) return false;
  const step = r.interval === 'monatlich' ? 1 : r.interval === 'quartal' ? 3 : 12;
  return (month - from) % step === 0;
}

function ruleExtra(rules: ExtraRule[], month: number, balance: number): number {
  let sum = 0;
  for (const r of rules) {
    if (!(r.amount > 0) || !ruleApplies(r, month)) continue;
    sum += r.unit === 'prozent' ? (balance * r.amount) / 100 : r.amount;
  }
  return sum;
}

export function hasExtras(e: ExtraPayments, rules: ExtraRule[] = []): boolean {
  return e.oneTimeAmount > 0 || e.yearlyAmount > 0 || e.monthlyAmount > 0 || rules.some((r) => r.amount > 0);
}

export const NO_EXTRAS: ExtraPayments = {
  oneTimeAmount: 0,
  oneTimeYear: 1,
  yearlyAmount: 0,
  monthlyAmount: 0,
  strategy: 'laufzeit',
};

const MAX_MONTHS = 720;

// ---------- Tilgungsplan ----------
export function calculateLoan(input: LoanInput, withApr = true): LoanResult {
  const type: LoanType = input.type ?? 'annuitaet';
  const k: number = input.interval ?? 1;
  const fixed = type === 'annuitaet' && input.fixedPayment != null && input.fixedPayment > 0 ? round2(input.fixedPayment) : null;
  const contractMonths = Math.ceil(termMonthsOf(input) / k) * k;
  const n = fixed !== null ? MAX_MONTHS : contractMonths;
  const grace = Math.min(Math.ceil(Math.max(0, Math.round(input.graceMonths ?? 0)) / k) * k, Math.max(0, n - k));
  const fixMonths = input.mode === 'variabel' ? Math.min(Math.round(input.fixYears * 12), contractMonths) : n;
  const rules = input.extraRules ?? [];
  const strategy = input.extra.strategy;
  const dayCount: DayCount = input.dayCount ?? '30/360';
  const start = input.startDate && parse(input.startDate) ? input.startDate : '';
  const firstDue = start ? (input.firstDue && parse(input.firstDue) && daysBetween(start, input.firstDue) > 0 ? input.firstDue : addMonths(start, 1)) : '';
  const customFirst = !!start && firstDue !== addMonths(start, 1);
  // Bei taggenauer Verzinsung fällt etwas mehr Zins an; die Rate wird entsprechend höher angesetzt.
  const rateAdj = dayCount === 'act/360' ? 365 / 360 : 1;
  const monthlyFees = round2(Math.max(0, input.monthlyFees ?? 0));
  const limit = input.extraLimitPercent && input.extraLimitPercent > 0 ? round2((input.principal * input.extraLimitPercent) / 100) : Infinity;
  const feePct = Math.max(0, input.prepayFeePercent ?? 0);
  const feeFree = Math.max(0, input.prepayFreePerYear ?? 0);

  // Ohne eigene erste Fälligkeit bleibt der Tag des Kreditbeginns maßgeblich (31.1. → 29.2. → 31.3.).
  const dateOf = (m: number) => (start ? (customFirst ? addMonths(firstDue, m - 1) : addMonths(start, m)) : '');
  const fraction = (m: number): number => {
    if (!start) return 1 / 12;
    const prev = m === 1 ? start : dateOf(m - 1);
    const cur = dateOf(m);
    if (dayCount === 'act/360') return daysBetween(prev, cur) / 360;
    if (dayCount === 'act/365') return daysBetween(prev, cur) / 365;
    return m === 1 && customFirst ? days30360(prev, cur) / 360 : 1 / 12;
  };

  const rows: ScheduleRow[] = [];
  let balance = round2(Math.max(0, input.principal));
  let rate = rateForMonth(input, 1);
  let payment = 0; // Annuität je Zahlungstermin
  let constPrincipal = 0; // Ratentilgung je Zahlungstermin
  let initialised = false;
  let pendingRate = false;
  let pendingExtra = false;
  let extraPaid = false;
  let accrued = 0;
  let extraYear = 0;
  let prepayFees = 0;
  let neverRepaid = false;
  let paymentAfterFix: number | null = null;
  let paymentAfterGrace: number | null = null;
  let prevRate = rate;

  for (let m = 1; m <= n && balance > 0.004; m++) {
    const newRate = rateForMonth(input, m);
    const rateChanged = m > 1 && newRate !== rate;
    if (rateChanged) {
      prevRate = rate;
      rate = newRate;
      pendingRate = true;
    }
    if ((m - 1) % 12 === 0) extraYear = 0;

    // Rate zu Beginn einer Zahlungsperiode festlegen bzw. neu berechnen.
    if ((m - 1) % k === 0 && m > grace) {
      const remaining = Math.max(1, Math.ceil((n - m + 1) / k));
      if (!initialised) {
        payment = fixed ?? annuity(balance, rate * rateAdj, remaining, k);
        constPrincipal = round2(balance / remaining);
        initialised = true;
        pendingRate = false;
        pendingExtra = false;
      } else {
        if (pendingRate && type === 'annuitaet' && fixed === null) {
          // Neue Rate aus tatsächlicher Restschuld, neuem Zins und Restlaufzeit.
          let periods = remaining;
          if (extraPaid && strategy !== 'rate') {
            const shortened = monthsToRepay(balance, prevRate * rateAdj, payment, k);
            if (Number.isFinite(shortened)) periods = Math.max(1, Math.min(periods, shortened));
          }
          payment = annuity(balance, rate * rateAdj, periods, k);
        }
        if (pendingExtra && strategy !== 'laufzeit' && fixed === null) {
          const full = annuity(balance, rate * rateAdj, remaining, k);
          const fullPrincipal = round2(balance / remaining);
          payment = strategy === 'rate' ? full : round2((payment + Math.min(payment, full)) / 2);
          constPrincipal = strategy === 'rate' ? fullPrincipal : round2((constPrincipal + Math.min(constPrincipal, fullPrincipal)) / 2);
        }
        pendingRate = false;
        pendingExtra = false;
      }
    }

    const opening = balance;
    // Zinsen laufen monatlich auf und werden erst bei der Buchung auf Cent gerundet.
    accrued += ((balance * rate) / 100) * fraction(m);
    let due = m % k === 0 || m === n;
    let interest = 0;
    let regular = 0;
    let principalPart = 0;

    if (due) {
      interest = round2(accrued);
      accrued = 0;
      if (m <= grace) {
        regular = interest;
      } else if (type === 'endfaellig') {
        regular = interest;
      } else if (type === 'raten') {
        principalPart = Math.min(constPrincipal, balance);
        regular = round2(principalPart + interest);
      } else {
        regular = payment;
        if (regular <= interest) {
          // Die Rate deckt die Zinsen nicht: keine Tilgung möglich.
          if (fixed !== null) neverRepaid = true;
          regular = interest;
        }
        principalPart = round2(regular - interest);
      }
      // Letzte Rate anpassen, damit die Restschuld exakt 0 € erreicht.
      if ((m === n && !neverRepaid) || principalPart >= balance) {
        principalPart = balance;
        regular = round2(balance + interest);
      }
      balance = round2(balance - principalPart);
    }

    // Sondertilgung: Wunschbetrag, begrenzt durch Vertragsgrenze und Restschuld.
    let extra = round2(quickExtra(input.extra, m) + ruleExtra(rules, m, balance));
    extra = round2(Math.max(0, Math.min(extra, limit - extraYear, balance)));
    let fees = balance > 0 || due || extra > 0 ? monthlyFees : 0;
    if (extra > 0) {
      const before = Math.max(0, extraYear - feeFree);
      extraYear = round2(extraYear + extra);
      balance = round2(balance - extra);
      extraPaid = true;
      pendingExtra = true;
      if (feePct > 0 && m <= fixMonths) {
        const base = Math.max(0, extraYear - feeFree) - before;
        const fee = round2((base * feePct * (n - m <= 12 ? 0.5 : 1)) / 100);
        prepayFees = round2(prepayFees + fee);
        fees = round2(fees + fee);
      }
      // Vollständige Rückzahlung zwischen zwei Zahlungsterminen: aufgelaufene Zinsen werden sofort fällig.
      if (balance < 0.005 && accrued > 0.004) {
        interest = round2(accrued);
        regular = interest;
        accrued = 0;
        due = true;
      }
    }
    if (balance < 0.005) balance = 0;

    if (due && m > fixMonths && paymentAfterFix === null && input.mode === 'variabel' && fixMonths < contractMonths) paymentAfterFix = regular;
    if (due && grace > 0 && m > grace && paymentAfterGrace === null) paymentAfterGrace = regular;
    rows.push({
      month: m, year: Math.ceil(m / 12), date: dateOf(m), opening, payment: regular, interest, principal: principalPart,
      extra, fees, total: round2(regular + extra + fees), balance, rate, due, rateChanged,
    });
    if (neverRepaid && m >= contractMonths) break;
  }

  if (fixed !== null && balance > 0.004) neverRepaid = true;

  const years: YearRow[] = [];
  for (const r of rows) {
    let y = years[r.year - 1];
    if (!y) {
      y = { year: r.year, payment: 0, interest: 0, principal: 0, extra: 0, fees: 0, total: 0, balance: 0, rate: r.rate, monthlyPayment: 0 };
      years.push(y);
    }
    y.payment = round2(y.payment + r.payment);
    y.interest = round2(y.interest + r.interest);
    y.principal = round2(y.principal + r.principal);
    y.extra = round2(y.extra + r.extra);
    y.fees = round2(y.fees + r.fees);
    y.total = round2(y.total + r.total);
    y.balance = r.balance;
    y.rate = r.rate;
    // Die (ggf. kleinere) Schlussrate soll die Jahresanzeige nicht verfälschen.
    if (r.due && (r.balance > 0 || y.monthlyPayment === 0)) y.monthlyPayment = r.payment;
  }

  const dueRows = rows.filter((r) => r.due);
  const oneTime = round2(Math.max(0, input.oneTimeCosts ?? 0));
  const totalInterest = round2(rows.reduce((s, r) => s + r.interest, 0));
  const totalExtra = round2(rows.reduce((s, r) => s + r.extra, 0));
  const totalPaid = round2(rows.reduce((s, r) => s + r.payment + r.extra, 0));
  const totalFees = round2(rows.reduce((s, r) => s + r.fees, 0) + oneTime);
  const firstPayment = dueRows[0]?.payment ?? 0;

  let apr: number | null = null;
  if (withApr) {
    const base = hasExtras(input.extra, rules) ? calculateLoan({ ...input, extra: { ...NO_EXTRAS, strategy }, extraRules: [] }, false) : null;
    const src = base ? base.rows : rows;
    const flows = src.filter((r) => r.total > 0).map((r) => ({ t: r.month / 12, amount: r.total }));
    const rest = base ? base.finalBalance : balance;
    if (rest > 0 && src.length) flows.push({ t: src[src.length - 1].month / 12, amount: rest });
    apr = effectiveRate(round2(input.principal - oneTime), flows);
  }

  return {
    rows,
    years,
    firstPayment,
    paymentAfterGrace,
    paymentAfterFix,
    maxPayment: rows.reduce((mx, r) => Math.max(mx, r.payment), 0),
    monthlyBurden: round2(firstPayment / k),
    totalInterest,
    totalPaid,
    totalExtra,
    totalFees,
    prepayFees,
    totalCost: round2(totalInterest + totalFees),
    grandTotal: round2(totalPaid + totalFees),
    months: rows.length,
    interestShare: totalPaid > 0 ? totalInterest / totalPaid : 0,
    apr,
    endDate: rows.length ? rows[rows.length - 1].date : '',
    neverRepaid,
    finalBalance: balance,
  };
}

/**
 * Effektiver Jahreszins in %: löst Auszahlung = Σ Zahlung / (1 + X)^t nach X (Bisektion).
 * `payout` = ausbezahlter Betrag nach Abzug einmaliger Kosten; t in Jahren.
 */
export function effectiveRate(payout: number, flows: { t: number; amount: number }[]): number | null {
  if (payout <= 0 || flows.length === 0) return null;
  const f = (x: number) => flows.reduce((s, c) => s + c.amount / Math.pow(1 + x, c.t), 0) - payout;
  let lo = -0.9;
  let hi = 10;
  if (f(lo) < 0 || f(hi) > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

/** Restschuld nach x vollen Jahren. */
export function balanceAfterYears(result: LoanResult, years: number, principal: number): number {
  if (years <= 0) return round2(principal);
  const idx = Math.round(years * 12) - 1;
  if (idx >= result.rows.length) return result.finalBalance;
  return result.rows[idx].balance;
}

/** Restschuld zu einem beliebigen Datum (nach der letzten Zahlung bis zu diesem Tag). */
export function balanceAtDate(result: LoanResult, iso: string, principal: number): number {
  let balance = round2(principal);
  for (const r of result.rows) {
    if (!r.date || r.date > iso) break;
    balance = r.balance;
  }
  return balance;
}

export interface ExtraEffect {
  interestSaved: number;
  monthsSaved: number;
  /** Reguläre Rate am Ende mit bzw. ohne Sondertilgung. */
  paymentWithout: number;
  paymentWith: number;
  baseMonths: number;
  baseInterest: number;
  /** Entschädigung an die Bank für Sondertilgungen. */
  prepayFees: number;
  /** Zinsersparnis minus Entschädigung. */
  netSaving: number;
}

export function extraEffect(input: LoanInput, withExtras: LoanResult): ExtraEffect {
  const base = calculateLoan({ ...input, extra: { ...NO_EXTRAS, strategy: input.extra.strategy }, extraRules: [] }, false);
  const lastRegular = (r: LoanResult) => {
    const due = r.rows.filter((x) => x.due);
    return due.length > 1 ? due[due.length - 2].payment : (due[0]?.payment ?? 0);
  };
  const interestSaved = round2(base.totalInterest - withExtras.totalInterest);
  return {
    interestSaved,
    monthsSaved: base.months - withExtras.months,
    paymentWithout: lastRegular(base),
    paymentWith: lastRegular(withExtras),
    baseMonths: base.months,
    baseInterest: base.totalInterest,
    prepayFees: withExtras.prepayFees,
    netSaving: round2(interestSaved - withExtras.prepayFees),
  };
}

/** Meilensteine der Rückzahlung. */
export interface Milestone {
  label: string;
  month: number;
  date: string;
  detail: string;
}

export function milestones(input: LoanInput, result: LoanResult): Milestone[] {
  const out: Milestone[] = [];
  const P = input.principal;
  const find = (pred: (r: ScheduleRow) => boolean) => result.rows.find(pred);
  const cross = find((r) => r.due && r.principal > r.interest && r.principal > 0);
  if (cross && cross.month > 1) out.push({ label: 'Tilgung überholt die Zinsen', month: cross.month, date: cross.date, detail: 'Ab hier fließt der größere Teil der Rate in die Rückzahlung.' });
  for (const share of [0.25, 0.5, 0.75]) {
    const r = find((x) => x.balance <= P * (1 - share) + 0.005);
    if (r) out.push({ label: `${share * 100} % zurückgezahlt`, month: r.month, date: r.date, detail: '' });
  }
  if (input.mode === 'variabel') {
    const fixMonths = Math.round(input.fixYears * 12);
    const r = result.rows[fixMonths - 1];
    if (r && fixMonths < result.rows.length) out.push({ label: 'Ende der Fixzinsperiode', month: r.month, date: r.date, detail: 'Danach gilt der variable Zins.' });
  }
  const last = result.rows[result.rows.length - 1];
  if (last && !result.neverRepaid) out.push({ label: 'Schuldenfrei', month: last.month, date: last.date, detail: 'Letzte Rate bezahlt.' });
  return out.sort((a, b) => a.month - b.month);
}

/** Summe aller Zahlungen in heutiger Kaufkraft bei konstanter Inflation (% p.a.). */
export function realTotal(result: LoanResult, inflationPercent: number): { total: number; lastPaymentReal: number } {
  const f = 1 + inflationPercent / 100;
  let total = 0;
  let last = 0;
  for (const r of result.rows) {
    const v = r.total / Math.pow(f, r.month / 12);
    total += v;
    if (r.due) last = r.payment / Math.pow(f, r.month / 12);
  }
  return { total: round2(total), lastPaymentReal: round2(last) };
}
