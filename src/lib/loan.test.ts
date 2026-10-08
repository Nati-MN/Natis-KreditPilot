import { describe, expect, it } from 'vitest';
import { annuity, balanceAfterYears, calculateLoan, extraEffect, NO_EXTRAS, round2, type LoanInput } from './loan';

const base: LoanInput = {
  principal: 119000,
  termYears: 30,
  mode: 'fix',
  fixRate: 3.2,
  fixYears: 10,
  variableRate: 4,
  rateChanges: [],
  useReference: false,
  referenceRate: 2.5,
  margin: 1.5,
  adjustMonths: 6,
  extra: { ...NO_EXTRAS },
};

const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

function checkConsistency(input: LoanInput) {
  const r = calculateLoan(input);
  const last = r.rows[r.rows.length - 1];
  expect(last.balance).toBe(0);
  expect(Math.min(...r.rows.map((x) => x.balance))).toBeGreaterThanOrEqual(0);
  expect(Math.min(...r.rows.map((x) => x.principal))).toBeGreaterThanOrEqual(0);
  // Tilgung + Sondertilgung = Kreditbetrag, Zahlungen = Kredit + Zinsen
  expect(sum(r.rows.map((x) => x.principal + x.extra))).toBeCloseTo(input.principal, 2);
  expect(r.totalPaid).toBeCloseTo(input.principal + r.totalInterest, 2);
  return r;
}

describe('Fixzins', () => {
  it('119.000 € · 3,2 % · 30 Jahre', () => {
    const r = checkConsistency(base);
    console.log('Rate', r.firstPayment, 'Zinsen', r.totalInterest, 'Gesamt', r.totalPaid, 'Monat 1', r.rows[0]);
    expect(Math.abs(r.firstPayment - 514.66)).toBeLessThan(0.05);
    expect(r.rows[0].interest).toBe(317.33);
    expect(Math.abs(r.rows[0].principal - 197.33)).toBeLessThan(0.05);
    expect(Math.abs(r.rows[0].balance - 118802.67)).toBeLessThan(0.05);
    expect(r.months).toBe(360);
    // letzte Rate weicht höchstens geringfügig ab
    expect(Math.abs(r.rows[359].payment - r.firstPayment)).toBeLessThan(5);
  });

  it('0 % Zinsen', () => {
    const r = checkConsistency({ ...base, fixRate: 0 });
    expect(r.firstPayment).toBe(round2(119000 / 360));
    expect(r.totalInterest).toBe(0);
    expect(r.totalPaid).toBe(119000);
    expect(r.months).toBe(360);
  });

  it('Annuitätenformel', () => {
    expect(annuity(100000, 6, 120)).toBe(1110.21);
    expect(annuity(1200, 0, 12)).toBe(100);
  });
});

describe('Fix, danach variabel', () => {
  it('Wechsel nach 10 Jahren auf 4,0 %', () => {
    const input: LoanInput = { ...base, mode: 'variabel' };
    const r = checkConsistency(input);
    const rest = r.rows[119].balance;
    expect(rest).toBe(balanceAfterYears(calculateLoan(base), 10, 119000));
    expect(r.rows[119].payment).toBe(r.firstPayment);
    expect(r.rows[120].rate).toBe(4);
    expect(r.rows[120].payment).toBe(annuity(rest, 4, 240));
    expect(r.paymentAfterFix).toBe(annuity(rest, 4, 240));
    expect(r.rows[120].payment).toBeGreaterThan(r.firstPayment);
    expect(r.months).toBe(360);
    console.log('Restschuld nach 10 J.', rest, 'neue Rate', r.rows[120].payment);
  });

  it('gleichbleibender Zins ergibt identischen Plan', () => {
    const a = calculateLoan(base);
    const b = checkConsistency({ ...base, mode: 'variabel', variableRate: 3.2 });
    expect(b.totalInterest).toBe(a.totalInterest);
  });

  it('sinkende Zinsen senken die Rate', () => {
    const r = checkConsistency({ ...base, mode: 'variabel', variableRate: 2 });
    expect(r.rows[120].payment).toBeLessThan(r.firstPayment);
  });

  it('mehrere Zinsänderungen (Jahr 11/13/16/20)', () => {
    const r = checkConsistency({
      ...base,
      mode: 'variabel',
      rateChanges: [
        { year: 11, rate: 4 },
        { year: 13, rate: 5 },
        { year: 16, rate: 3.5 },
        { year: 20, rate: 2.5 },
      ],
    });
    expect(r.rows[120].rate).toBe(4);
    expect(r.rows[143].rate).toBe(4);
    expect(r.rows[144].rate).toBe(5);
    expect(r.rows[144].payment).toBe(annuity(r.rows[143].balance, 5, 360 - 144));
    expect(r.rows[180].rate).toBe(3.5);
    expect(r.rows[228].rate).toBe(2.5);
    expect(r.rows[359].rate).toBe(2.5);
    expect(r.months).toBe(360);
  });

  it('Referenzzins + Aufschlag mit Anpassungsintervall', () => {
    const r = checkConsistency({
      ...base,
      mode: 'variabel',
      useReference: true,
      referenceRate: 2.5,
      margin: 1.25,
      adjustMonths: 6,
      rateChanges: [{ year: 12, rate: 3 }],
    });
    expect(r.rows[120].rate).toBe(3.75);
    expect(r.rows[132].rate).toBe(4.25);
  });

  it('Anpassung greift erst am nächsten Anpassungstermin', () => {
    // Fix 1 Jahr, Intervall 12 Monate ab Monat 13; Änderung ab Jahr 2 wirkt sofort,
    const r = calculateLoan({
      ...base, mode: 'variabel', fixYears: 1.5 as number, useReference: true, adjustMonths: 12, margin: 1,
      referenceRate: 2, rateChanges: [{ year: 3, rate: 4 }],
    });
    // Fixende Monat 18, Termine: 19, 31, ... Änderung ab Monat 25 wirkt erst ab Monat 31
    expect(r.rows[24].rate).toBe(3);
    expect(r.rows[30].rate).toBe(5);
  });
});

describe('Sondertilgungen', () => {
  it('Laufzeit verkürzen: Rate bleibt, Zinsen sinken', () => {
    const input: LoanInput = { ...base, extra: { oneTimeAmount: 5000, oneTimeYear: 2, yearlyAmount: 2000, monthlyAmount: 100, strategy: 'laufzeit' } };
    const r = checkConsistency(input);
    const e = extraEffect(input, r);
    expect(r.months).toBeLessThan(360);
    expect(e.monthsSaved).toBe(360 - r.months);
    expect(e.interestSaved).toBeGreaterThan(0);
    expect(r.rows[50].payment).toBe(r.firstPayment);
    expect(r.rows[23].extra).toBe(7100);
    console.log('Laufzeit', r.months, 'Zinsersparnis', e.interestSaved);
  });

  it('Rate senken: Laufzeit bleibt', () => {
    const input: LoanInput = { ...base, extra: { oneTimeAmount: 5000, oneTimeYear: 2, yearlyAmount: 0, monthlyAmount: 0, strategy: 'rate' } };
    const r = checkConsistency(input);
    expect(r.months).toBe(360);
    expect(r.rows[24].payment).toBeLessThan(r.firstPayment);
    expect(r.rows[24].payment).toBe(annuity(r.rows[23].balance, 3.2, 336));
    expect(extraEffect(input, r).interestSaved).toBeGreaterThan(0);
  });

  it('Sondertilgung größer als Restschuld', () => {
    const r = checkConsistency({ ...base, principal: 30000, termYears: 5, extra: { oneTimeAmount: 500000, oneTimeYear: 1, yearlyAmount: 0, monthlyAmount: 0, strategy: 'laufzeit' } });
    expect(r.months).toBe(12);
  });

  it('variabel + Sondertilgung mit Laufzeitverkürzung bleibt verkürzt', () => {
    const input: LoanInput = { ...base, mode: 'variabel', extra: { oneTimeAmount: 0, oneTimeYear: 1, yearlyAmount: 3000, monthlyAmount: 0, strategy: 'laufzeit' } };
    const r = checkConsistency(input);
    expect(r.months).toBeLessThan(330);
  });
});

describe('Randfälle', () => {
  it('viele Kombinationen tilgen vollständig', () => {
    for (const principal of [30000, 89000, 119000, 487000, 1000000])
      for (const term of [5, 17, 30, 40])
        for (const rate of [0, 0.1, 3.2, 7.3, 12])
          for (const vr of [0, 2.5, 12]) {
            checkConsistency({ ...base, principal, termYears: term, fixRate: rate });
            checkConsistency({ ...base, principal, termYears: term, fixRate: rate, mode: 'variabel', fixYears: Math.min(10, term), variableRate: vr });
            checkConsistency({ ...base, principal, termYears: term, fixRate: rate, mode: 'variabel', fixYears: Math.min(3, term), variableRate: vr,
              extra: { oneTimeAmount: 4000, oneTimeYear: 2, yearlyAmount: 1500, monthlyAmount: 50, strategy: vr > 2 ? 'rate' : 'laufzeit' } });
          }
  });
});
