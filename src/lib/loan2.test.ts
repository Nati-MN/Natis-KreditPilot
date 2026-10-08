import { describe, expect, it } from 'vitest';
import {
  addMonths, annuity, balanceAtDate, calculateLoan, days30360, daysBetween, effectiveRate, extraEffect, milestones, NO_EXTRAS,
  principalForPayment, realTotal, round2, type ExtraRule, type LoanInput, type LoanResult,
} from './loan';

const base: LoanInput = {
  principal: 100000, termYears: 10, mode: 'fix', fixRate: 5, fixYears: 10, variableRate: 5, rateChanges: [],
  useReference: false, referenceRate: 2, margin: 1, adjustMonths: 3, extra: { ...NO_EXTRAS },
};
const rule = (p: Partial<ExtraRule>): ExtraRule => ({ id: 'r', label: 'R', interval: 'einmalig', unit: 'euro', amount: 0, from: 1, to: null, ...p });
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

/** Prüft jede Zeile: Anfangsschuld − Tilgung − Sondertilgung = Restschuld, nichts wird negativ. */
function consistent(input: LoanInput, r: LoanResult) {
  let prev = round2(input.principal);
  for (const row of r.rows) {
    expect(row.opening).toBe(prev);
    expect(round2(row.opening - row.principal - row.extra)).toBe(row.balance);
    expect(row.balance).toBeGreaterThanOrEqual(0);
    expect(row.principal).toBeGreaterThanOrEqual(0);
    expect(row.interest).toBeGreaterThanOrEqual(0);
    if (row.due) expect(round2(row.interest + row.principal)).toBe(row.payment);
    else expect(row.payment).toBe(0);
    expect(round2(row.payment + row.extra + row.fees)).toBe(row.total);
    prev = row.balance;
  }
  expect(sum(r.rows.map((x) => x.principal + x.extra))).toBeCloseTo(input.principal - r.finalBalance, 2);
  expect(r.totalPaid).toBeCloseTo(input.principal - r.finalBalance + r.totalInterest, 2);
  expect(sum(r.years.map((y) => y.interest))).toBeCloseTo(r.totalInterest, 2);
  expect(sum(r.years.map((y) => y.total))).toBeCloseTo(r.grandTotal - (input.oneTimeCosts ?? 0), 2);
}

describe('Effektivzins', () => {
  it('EU-Referenzbeispiele: 1.000 € → 1.200 € nach 18 Monaten', () => {
    expect(effectiveRate(1000, [{ t: 1.5, amount: 1200 }])!).toBeCloseTo(12.92, 2);
    expect(effectiveRate(950, [{ t: 1.5, amount: 1200 }])!).toBeCloseTo(16.85, 2); // mit 50 € Kosten
    // zwei Raten von je 600 € nach 1 und 2 Jahren
    expect(effectiveRate(1000, [{ t: 1, amount: 600 }, { t: 2, amount: 600 }])!).toBeCloseTo(13.07, 2);
  });
  it('ohne Kosten: (1 + i/12)^12 − 1', () => {
    const r = calculateLoan(base);
    expect(r.apr!).toBeCloseTo((Math.pow(1 + 0.05 / 12, 12) - 1) * 100, 2);
    expect(calculateLoan({ ...base, fixRate: 0 }).apr!).toBeCloseTo(0, 3);
  });
  it('mit Gebühren höher als der Nominalzins, Barwert stimmt auf den Cent', () => {
    const input = { ...base, oneTimeCosts: 2000, monthlyFees: 6 };
    const r = calculateLoan(input);
    expect(r.apr!).toBeGreaterThan(5.5);
    const x = r.apr! / 100;
    const pv = r.rows.reduce((s, row) => s + row.total / Math.pow(1 + x, row.month / 12), 0);
    expect(pv).toBeCloseTo(98000, 1);
    expect(r.totalFees).toBe(2000 + 6 * 120);
    expect(r.totalCost).toBe(round2(r.totalInterest + r.totalFees));
    // Sondertilgungen ändern den Effektivzins nicht
    expect(calculateLoan({ ...input, extra: { ...NO_EXTRAS, yearlyAmount: 5000 } }).apr!).toBeCloseTo(r.apr!, 6);
  });
});

describe('Kreditarten', () => {
  it('Ratentilgung: konstante Tilgung, fallende Rate', () => {
    const input: LoanInput = { ...base, principal: 120000, fixRate: 6, type: 'raten' };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.rows[0].principal).toBe(1000);
    expect(r.rows[0].interest).toBe(600);
    expect(r.firstPayment).toBe(1600);
    expect(r.rows[119].payment).toBe(1005);
    expect(r.totalInterest).toBe(36300); // 0,5 % · 1.000 € · (120·121/2)
    expect(r.months).toBe(120);
  });
  it('Endfällig: nur Zinsen, Kapital am Ende', () => {
    const input: LoanInput = { ...base, termYears: 5, fixRate: 4, type: 'endfaellig' };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.firstPayment).toBe(333.33);
    expect(r.rows[58].balance).toBe(100000);
    expect(r.rows[59].payment).toBe(100333.33);
    expect(r.totalInterest).toBeCloseTo(20000, 0);
  });
  it('Tilgungsfreie Phase: 12 Monate nur Zinsen, danach Annuität über die Restlaufzeit', () => {
    const input: LoanInput = { ...base, graceMonths: 12 };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.firstPayment).toBe(416.67);
    expect(r.rows[11].balance).toBe(100000);
    expect(r.paymentAfterGrace).toBe(annuity(100000, 5, 108));
    expect(r.months).toBe(120);
    expect(r.totalInterest).toBeGreaterThan(calculateLoan(base).totalInterest);
  });
  it('Vierteljährliche Zahlung', () => {
    const input: LoanInput = { ...base, fixRate: 4, interval: 3 };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.rows.filter((x) => x.due).length).toBe(40);
    expect(r.firstPayment).toBe(annuity(100000, 4, 40, 3));
    expect(r.rows[0].payment).toBe(0);
    expect(r.rows[2].interest).toBe(1000);
    expect(r.monthlyBurden).toBe(round2(r.firstPayment / 3));
    expect(r.rows[119].balance).toBe(0);
  });
  it('Feste Rate (Anfangstilgung 2 %): unabhängiges Referenzbeispiel 400.000 € · 3,7 % · 1.900 €', () => {
    const input: LoanInput = { ...base, principal: 400000, fixRate: 3.7, termYears: 30, fixedPayment: 1900 };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.rows[0].principal).toBeCloseTo(666.67, 2);
    expect(Math.abs(r.rows[119].balance - 303371)).toBeLessThan(5);
    expect(Math.abs(sum(r.rows.slice(0, 120).map((x) => x.interest)) - 131371)).toBeLessThan(5);
    expect(r.months).toBe(341); // 28,4 Jahre
    expect(Math.abs(r.totalInterest - 246370)).toBeLessThan(50);
    expect(r.neverRepaid).toBe(false);
  });
  it('Rate unter den Zinsen: wird nie getilgt und als solches gemeldet', () => {
    const r = calculateLoan({ ...base, fixedPayment: 300 });
    expect(r.neverRepaid).toBe(true);
    expect(r.finalBalance).toBe(100000);
    expect(r.months).toBe(120);
  });
  it('Rückwärtsrechnung ist die Umkehrung der Annuität', () => {
    const a = annuity(250000, 3.5, 300);
    expect(Math.abs(principalForPayment(a, 3.5, 300) - 250000)).toBeLessThan(1);
    expect(principalForPayment(500, 0, 120)).toBe(60000);
  });
});

describe('Datum und Zinsmethoden', () => {
  it('Monatsende und Schaltjahr', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2025-11-30', 3)).toBe('2026-02-28');
    expect(daysBetween('2024-02-01', '2024-03-01')).toBe(29);
    expect(days30360('2026-01-31', '2026-02-28')).toBe(28);
    expect(days30360('2026-01-15', '2026-02-15')).toBe(30);
    const r = calculateLoan({ ...base, startDate: '2024-01-31' });
    expect(r.rows[0].date).toBe('2024-02-29');
    expect(r.rows[1].date).toBe('2024-03-31');
    expect(r.rows[12].date).toBe('2025-02-28');
    expect(r.endDate).toBe('2034-01-31');
  });
  it('30/360 mit Datum entspricht der Rechnung ohne Datum', () => {
    const a = calculateLoan(base);
    const b = calculateLoan({ ...base, startDate: '2026-11-01' });
    expect(b.totalInterest).toBe(a.totalInterest);
    expect(b.firstPayment).toBe(a.firstPayment);
  });
  it('taggenau act/365 und act/360: mehr Zinsen, trotzdem vollständig getilgt', () => {
    const a = calculateLoan({ ...base, startDate: '2026-11-01' });
    const i365: LoanInput = { ...base, startDate: '2026-11-01', dayCount: 'act/365' };
    const i360: LoanInput = { ...base, startDate: '2026-11-01', dayCount: 'act/360' };
    const b = calculateLoan(i365);
    const c = calculateLoan(i360);
    consistent(i365, b);
    consistent(i360, c);
    expect(b.rows[0].interest).toBe(round2(100000 * 0.05 * 30 / 365)); // November: 30 Tage
    expect(c.rows[0].interest).toBe(round2(100000 * 0.05 * 30 / 360));
    expect(c.totalInterest).toBeGreaterThan(a.totalInterest);
    expect(c.totalInterest / a.totalInterest).toBeLessThan(1.02);
    // Schlussrate bleibt in der Größenordnung einer normalen Rate
    expect(c.rows[119].payment).toBeLessThan(c.firstPayment * 1.5);
    expect(b.rows[119].payment).toBeLessThan(b.firstPayment * 1.5);
  });
  it('abweichende erste Fälligkeit: längere erste Zinsperiode', () => {
    const r = calculateLoan({ ...base, startDate: '2026-11-10', firstDue: '2027-01-01' });
    expect(r.rows[0].interest).toBe(round2(100000 * 0.05 * 51 / 360));
    expect(r.rows[1].date).toBe('2027-02-01');
    expect(r.rows[r.rows.length - 1].balance).toBe(0);
  });
  it('Restschuld zu einem beliebigen Datum', () => {
    const r = calculateLoan({ ...base, startDate: '2026-11-01' });
    expect(balanceAtDate(r, '2026-11-15', 100000)).toBe(100000);
    expect(balanceAtDate(r, '2027-11-01', 100000)).toBe(r.rows[11].balance);
    expect(balanceAtDate(r, '2040-01-01', 100000)).toBe(0);
  });
});

describe('Sondertilgungen nach Regeln', () => {
  it('am ersten Zahlungstermin, kurz vor Ende und vollständige Rückzahlung', () => {
    const first: LoanInput = { ...base, extraRules: [rule({ amount: 10000, from: 1 })] };
    const a = calculateLoan(first);
    consistent(first, a);
    expect(a.rows[0].extra).toBe(10000);
    const late: LoanInput = { ...base, extraRules: [rule({ amount: 50000, from: 119 })] };
    const b = calculateLoan(late);
    consistent(late, b);
    expect(b.months).toBe(119);
    expect(b.rows[118].extra).toBeLessThan(2000);
    const full: LoanInput = { ...base, extraRules: [rule({ amount: 999999, from: 24 })] };
    const c = calculateLoan(full);
    consistent(full, c);
    expect(c.months).toBe(24);
    expect(c.rows[23].balance).toBe(0);
  });
  it('mehrere Regeln, Zeitraum, vierteljährlich und Prozent der Restschuld', () => {
    const input: LoanInput = { ...base, extraRules: [
      rule({ id: 'a', interval: 'quartal', amount: 500, from: 3, to: 24 }),
      rule({ id: 'b', interval: 'jaehrlich', unit: 'prozent', amount: 2, from: 12 }),
      rule({ id: 'c', interval: 'monatlich', amount: 50, from: 13, to: 18 }),
    ] };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.rows[2].extra).toBe(500);
    expect(r.rows[3].extra).toBe(0);
    expect(r.rows[11].extra).toBe(round2(500 + (r.rows[11].opening - r.rows[11].principal) * 0.02));
    expect(r.rows[12].extra).toBe(50);
    expect(r.rows[18].extra).toBe(0);
    expect(r.rows[26].extra).toBe(0); // Quartalsregel endet nach Monat 24
    expect(extraEffect(input, r).interestSaved).toBeGreaterThan(0);
  });
  it('Vertragsgrenze pro Jahr und Entschädigung mit Freibetrag', () => {
    const input: LoanInput = { ...base, extraRules: [rule({ interval: 'jaehrlich', amount: 20000, from: 6 })], extraLimitPercent: 10, prepayFeePercent: 1, prepayFreePerYear: 4000 };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.rows[5].extra).toBe(10000); // 10 % von 100.000 €
    expect(r.rows[5].fees).toBe(60); // 1 % von (10.000 − 4.000)
    const e = extraEffect(input, r);
    expect(e.prepayFees).toBe(r.prepayFees);
    expect(e.netSaving).toBe(round2(e.interestSaved - r.prepayFees));
    // in der variablen Phase fällt keine Entschädigung an
    const v = calculateLoan({ ...input, mode: 'variabel', fixYears: 1, extraLimitPercent: 0, extraRules: [rule({ amount: 20000, from: 18 })] });
    expect(v.prepayFees).toBe(0);
  });
  it('Strategien: Laufzeit kürzen, Rate senken, halb/halb', () => {
    const mk = (strategy: 'laufzeit' | 'rate' | 'kombi'): LoanInput => ({ ...base, extra: { ...NO_EXTRAS, strategy }, extraRules: [rule({ amount: 20000, from: 12 })] });
    const l = calculateLoan(mk('laufzeit'));
    const r = calculateLoan(mk('rate'));
    const k = calculateLoan(mk('kombi'));
    [['laufzeit', l], ['rate', r], ['kombi', k]].forEach(([s, res]) => consistent(mk(s as 'laufzeit'), res as LoanResult));
    expect(l.rows[20].payment).toBe(l.firstPayment);
    expect(r.months).toBe(120);
    expect(r.rows[20].payment).toBeLessThan(k.rows[20].payment);
    expect(k.rows[20].payment).toBeLessThan(l.rows[20].payment);
    expect(k.months).toBeGreaterThan(l.months);
    expect(k.months).toBeLessThan(120);
  });
  it('Sondertilgung zwischen zwei Quartalsterminen', () => {
    const input: LoanInput = { ...base, interval: 3, extraRules: [rule({ amount: 30000, from: 2 }), rule({ id: 'x', amount: 999999, from: 8 })] };
    const r = calculateLoan(input);
    consistent(input, r);
    expect(r.rows[1].balance).toBe(70000);
    expect(r.rows[2].interest).toBe(1125); // 416,67 + 416,67 + 291,67, erst bei der Buchung gerundet
    expect(r.months).toBe(8);
    expect(r.rows[7].interest).toBeGreaterThan(0); // aufgelaufene Zinsen werden mit abgerechnet
  });
});

describe('Zinsgrenzen, Meilensteine, Inflation', () => {
  it('Ober- und Untergrenze für den variablen Zins', () => {
    const v: LoanInput = { ...base, mode: 'variabel', fixYears: 2, variableRate: 8, rateCap: 6 };
    expect(calculateLoan(v).rows[24].rate).toBe(6);
    expect(calculateLoan({ ...v, variableRate: 1, rateFloor: 2.5 }).rows[24].rate).toBe(2.5);
    expect(calculateLoan(v).rows[23].rate).toBe(5);
    expect(calculateLoan(v).rows[24].rateChanged).toBe(true);
  });
  it('Meilensteine in zeitlicher Reihenfolge', () => {
    const input = { ...base, startDate: '2026-11-01' };
    const ms = milestones(input, calculateLoan(input));
    expect(ms[ms.length - 1].label).toBe('Schuldenfrei');
    expect(ms[ms.length - 1].date).toBe('2036-11-01');
    expect(ms.map((m) => m.month)).toEqual([...ms.map((m) => m.month)].sort((a, b) => a - b));
    expect(ms.some((m) => m.label.startsWith('50 %'))).toBe(true);
  });
  it('reale Belastung sinkt mit Inflation', () => {
    const r = calculateLoan(base);
    expect(realTotal(r, 0).total).toBe(r.grandTotal);
    expect(realTotal(r, 2).total).toBeLessThan(r.grandTotal);
    expect(realTotal(r, 2).lastPaymentReal).toBeLessThan(r.firstPayment);
  });
});

describe('Breiter Konsistenztest', () => {
  it('alle Kombinationen aus Art, Intervall, Zinsmethode, Phase und Sondertilgung', () => {
    let count = 0;
    for (const type of ['annuitaet', 'raten', 'endfaellig'] as const)
      for (const interval of [1, 3, 12] as const)
        for (const dayCount of ['30/360', 'act/360', 'act/365'] as const)
          for (const fixRate of [0, 0.05, 3.2, 11])
            for (const strategy of ['laufzeit', 'rate', 'kombi'] as const) {
              const input: LoanInput = {
                ...base, principal: 187654.32, termYears: 17, type, interval, dayCount, fixRate, startDate: '2027-01-31',
                mode: 'variabel', fixYears: 5, variableRate: 4.4, rateChanges: [{ year: 9, rate: 1.1 }], graceMonths: type === 'raten' ? 6 : 0,
                extra: { oneTimeAmount: 7000, oneTimeYear: 3, yearlyAmount: 1200, monthlyAmount: 35, strategy },
                extraRules: [rule({ interval: 'quartal', unit: 'prozent', amount: 0.5, from: 7, to: 60 })], monthlyFees: 4.5, oneTimeCosts: 1500,
              };
              const r = calculateLoan(input);
              consistent(input, r);
              expect(r.finalBalance).toBe(0);
              expect(r.apr).not.toBeNull();
              count++;
            }
    expect(count).toBe(324);
  });
});
