/**
 * Leistbarkeits- und Haushaltsrechner.
 * Die Orientierungswerte der Aufsicht sind Eingabeparameter (LendingRules) und nicht fest im Code verdrahtet.
 * Das Ergebnis ist eine Haushaltsrechnung nach eigenen Angaben und keine Kreditzusage.
 */
import { annuity, principalForPayment, round2 } from './loan';

export interface LendingRules {
  /** Schuldendienst höchstens x % des Nettoeinkommens. */
  maxDsti: number;
  /** Beleihungsquote höchstens x % (Kredit / Wert der Immobilie). */
  maxLtv: number;
  /** Laufzeit höchstens x Jahre. */
  maxTerm: number;
  /** Quelle und Stand, wird in der Oberfläche angezeigt. */
  source: string;
}

/** FMA-Rundschreiben zur soliden Vergabe privater Wohnimmobilienkredite vom 26.6.2025 (Nachfolge der KIM-V). */
export const DEFAULT_RULES: LendingRules = { maxDsti: 40, maxLtv: 90, maxTerm: 35, source: 'FMA-Rundschreiben vom 26.6.2025, abgerufen im Oktober 2026' };

export interface AffordState {
  income1: number;
  income2: number;
  incomeOther: number;
  /** 13. und 14. Gehalt anteilig mitrechnen (für die Schuldendienstquote). */
  salaries14: boolean;
  housing: number;
  operating: number;
  energy: number;
  food: number;
  mobility: number;
  insurance: number;
  existingLoans: number;
  alimony: number;
  children: number;
  other: number;
  savings: number;
  /** Betrag, der nach allen Ausgaben mindestens übrig bleiben soll. */
  buffer: number;
  /** Vorhandene Ersparnisse als Notgroschen. */
  reserve: number;
  // Annahmen der Belastungsszenarien
  stressRate: number;
  incomeLossPct: number;
  karenzSharePct: number;
  partTimeSharePct: number;
  operatingUpPct: number;
  livingUpPct: number;
  unexpected: number;
}

export const DEFAULT_AFFORD: AffordState = {
  income1: 2800, income2: 1800, incomeOther: 0, salaries14: true,
  housing: 0, operating: 250, energy: 160, food: 600, mobility: 250, insurance: 120, existingLoans: 0, alimony: 0, children: 0, other: 250, savings: 200,
  buffer: 300, reserve: 10000,
  stressRate: 2, incomeLossPct: 20, karenzSharePct: 40, partTimeSharePct: 60, operatingUpPct: 30, livingUpPct: 10, unexpected: 10000,
};

export interface AffordLoan {
  payment: number;
  principal: number;
  ratePercent: number;
  termMonths: number;
  /** Kaufpreis bzw. Wert der Immobilie für die Beleihungsquote. */
  propertyValue: number;
}

export type Status = 'ok' | 'knapp' | 'kritisch';

export interface AffordScenario {
  name: string;
  assumption: string;
  income: number;
  expenses: number;
  payment: number;
  surplus: number;
  dsti: number;
  status: Status;
}

export interface AffordResult {
  income: number;
  /** Einkommen für die Schuldendienstquote (ggf. inkl. Sonderzahlungen). */
  incomeForDsti: number;
  expenses: number;
  /** Frei verfügbar vor der neuen Kreditrate. */
  free: number;
  surplus: number;
  dsti: number;
  ltv: number;
  termYears: number;
  status: Status;
  /** Höchste Rate, die Haushalt und Schuldendienstquote zulassen. */
  affordablePayment: number;
  limitedBy: 'haushalt' | 'quote';
  maxLoan: number;
  maxLoanStress: number;
  reserveMonths: number;
  reserveAfterUnexpected: number;
  checks: { label: string; value: string; limit: string; ok: boolean }[];
  scenarios: AffordScenario[];
}

const pct = (v: number) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;

export function calculateAfford(a: AffordState, loan: AffordLoan, rules: LendingRules): AffordResult {
  const factor14 = a.salaries14 ? 14 / 12 : 1;
  const totals = (i1: number, i2: number, opFactor = 1, livingFactor = 1) => {
    const income = i1 + i2 + a.incomeOther;
    const incomeForDsti = (i1 + i2) * factor14 + a.incomeOther;
    const expenses = a.housing + (a.operating + a.energy) * opFactor + (a.food + a.mobility + a.insurance + a.children + a.other) * livingFactor + a.existingLoans + a.alimony + a.savings;
    return { income, incomeForDsti, expenses };
  };
  const status = (surplus: number): Status => (surplus >= a.buffer ? 'ok' : surplus >= 0 ? 'knapp' : 'kritisch');
  const dstiOf = (payment: number, incomeForDsti: number) => (incomeForDsti > 0 ? ((payment + a.existingLoans) / incomeForDsti) * 100 : Infinity);

  const base = totals(a.income1, a.income2);
  const free = base.income - base.expenses;
  const surplus = free - loan.payment;
  const dsti = dstiOf(loan.payment, base.incomeForDsti);
  const ltv = loan.propertyValue > 0 ? (loan.principal / loan.propertyValue) * 100 : 0;
  const termYears = loan.termMonths / 12;

  const byHousehold = free - a.buffer;
  const byRatio = (rules.maxDsti / 100) * base.incomeForDsti - a.existingLoans;
  const affordablePayment = round2(Math.max(0, Math.min(byHousehold, byRatio)));
  const stressPayment = annuity(loan.principal, loan.ratePercent + a.stressRate, loan.termMonths);

  const scenario = (name: string, assumption: string, t: ReturnType<typeof totals>, payment = loan.payment): AffordScenario => {
    const s = t.income - t.expenses - payment;
    return { name, assumption, income: round2(t.income), expenses: round2(t.expenses), payment: round2(payment), surplus: round2(s), dsti: dstiOf(payment, t.incomeForDsti), status: status(s) };
  };
  const loss = 1 - a.incomeLossPct / 100;
  const karenzOn2 = a.income2 > 0;
  const scenarios: AffordScenario[] = [
    scenario(`Zinsen +${a.stressRate.toLocaleString('de-DE')} Prozentpunkte`, `Rate neu gerechnet mit ${pct(loan.ratePercent + a.stressRate)}`, base, stressPayment),
    scenario('Einkommensverlust', `Erwerbseinkommen −${pct(a.incomeLossPct)}`, totals(a.income1 * loss, a.income2 * loss)),
    scenario('Karenz', `${karenzOn2 ? 'Zweites' : 'Erstes'} Einkommen sinkt auf ${pct(a.karenzSharePct)}`,
      karenzOn2 ? totals(a.income1, (a.income2 * a.karenzSharePct) / 100) : totals((a.income1 * a.karenzSharePct) / 100, 0)),
    scenario('Teilzeit', `Erstes Einkommen sinkt auf ${pct(a.partTimeSharePct)}`, totals((a.income1 * a.partTimeSharePct) / 100, a.income2)),
    scenario('Höhere Betriebskosten', `Betriebs- und Energiekosten +${pct(a.operatingUpPct)}`, totals(a.income1, a.income2, 1 + a.operatingUpPct / 100)),
    scenario('Steigende Lebenshaltungskosten', `Lebensmittel, Mobilität, Versicherungen, Kinder, Sonstiges +${pct(a.livingUpPct)}`, totals(a.income1, a.income2, 1, 1 + a.livingUpPct / 100)),
  ];

  const monthlyOut = base.expenses - a.savings + loan.payment;
  return {
    income: round2(base.income),
    incomeForDsti: round2(base.incomeForDsti),
    expenses: round2(base.expenses),
    free: round2(free),
    surplus: round2(surplus),
    dsti,
    ltv,
    termYears,
    status: status(surplus),
    affordablePayment,
    limitedBy: byHousehold <= byRatio ? 'haushalt' : 'quote',
    maxLoan: principalForPayment(affordablePayment, loan.ratePercent, loan.termMonths),
    maxLoanStress: principalForPayment(affordablePayment, loan.ratePercent + a.stressRate, loan.termMonths),
    reserveMonths: monthlyOut > 0 ? a.reserve / monthlyOut : Infinity,
    reserveAfterUnexpected: round2(a.reserve - a.unexpected),
    checks: [
      { label: 'Schuldendienstquote', value: pct(dsti), limit: `höchstens ${pct(rules.maxDsti)}`, ok: dsti <= rules.maxDsti },
      { label: 'Beleihungsquote', value: pct(ltv), limit: `höchstens ${pct(rules.maxLtv)}`, ok: ltv <= rules.maxLtv },
      { label: 'Laufzeit', value: `${termYears.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Jahre`, limit: `höchstens ${rules.maxTerm} Jahre`, ok: termYears <= rules.maxTerm },
    ],
    scenarios,
  };
}
