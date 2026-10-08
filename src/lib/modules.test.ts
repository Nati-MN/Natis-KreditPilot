import { describe, expect, it } from 'vitest';
import { calculateAfford, DEFAULT_AFFORD, DEFAULT_RULES } from './afford';
import { analyze } from './analysis';
import { annuity, calculateLoan, NO_EXTRAS, principalForPayment, round2, type LoanInput } from './loan';
import { compareOffers, EXAMPLE_OFFERS, flexScore, rateScenarios } from './offers';
import { calculatePoi, DEFAULT_POI } from './payinvest';
import { calculateRefi, DEFAULT_REFI } from './refinance';
import { DEFAULT_STATE, exportScenarios, financing, importScenarios, normalize, toLoanInput, type AppState } from './state';

const adv: AppState = { ...DEFAULT_STATE, viewMode: 'erweitert' };
const loan: LoanInput = {
  principal: 200000, termYears: 25, mode: 'fix', fixRate: 4, fixYears: 25, variableRate: 4, rateChanges: [],
  useReference: false, referenceRate: 0, margin: 0, adjustMonths: 3, extra: { ...NO_EXTRAS },
};

describe('Kreditvergleich', () => {
  it('drei Beispielangebote: Kosten, Flexibilität und Zinsrisiko getrennt', () => {
    const m = compareOffers(EXAMPLE_OFFERS);
    expect(m.length).toBe(3);
    expect(Math.min(...m.map((x) => x.costDiff))).toBe(0);
    expect(Math.max(...m.map((x) => x.scoreCost))).toBe(5);
    expect(Math.min(...m.map((x) => x.scoreCost))).toBe(1);
    expect(m[0].scoreRisk).toBe(5); // durchgehend fix
    expect(m[2].scoreRisk).toBeLessThan(m[1].scoreRisk);
    expect(m[2].scoreFlex).toBe(5);
    expect(m[0].scoreFlex).toBe(1);
    for (const x of m) {
      expect(x.result.apr!).toBeGreaterThan(x.offer.fixRate);
      expect(x.result.totalFees).toBe(round2((x.offer.amount * x.offer.setupPercent) / 100 + x.offer.setupEuro + (x.offer.accountMonthly + x.offer.otherMonthly) * 360));
    }
    expect(m[1].balanceAfterFix).toBe(m[1].result.rows[119].balance);
    expect(flexScore({ ...EXAMPLE_OFFERS[0], extraFreePercent: 10, prepayFeePercent: 0 })).toBe(4);
  });
  it('fünf und mehr Angebote', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...EXAMPLE_OFFERS[0], id: `x${i}`, fixRate: 3 + i * 0.2 }));
    const m = compareOffers(many);
    expect(m[0].scoreCost).toBe(5);
    expect(m[6].scoreCost).toBe(1);
    expect(m[3].costDiff).toBeGreaterThan(0);
  });
});

describe('Zins-Simulator', () => {
  it('+1, +2, −1 Prozentpunkte nach der Fixzinsperiode', () => {
    const sc = rateScenarios(loan, 10, 4, [{ label: 'gleich', delta: 0 }, { label: '+1', delta: 1 }, { label: '+2', delta: 2 }, { label: '−1', delta: -1 }]);
    const fix = calculateLoan(loan);
    expect(sc[0].result.totalInterest).toBe(fix.totalInterest);
    expect(sc[0].interestDiff).toBe(0);
    expect(sc[1].paymentAfterFix).toBe(annuity(fix.rows[119].balance, 5, 180));
    expect(sc[2].interestDiff).toBeGreaterThan(sc[1].interestDiff);
    expect(sc[3].interestDiff).toBeLessThan(0);
    expect(sc[3].paymentDiff).toBeLessThan(0);
  });
});

describe('Leistbarkeit', () => {
  const l = { payment: 1200, principal: 250000, ratePercent: 3.5, termMonths: 360, propertyValue: 300000 };
  it('Haushaltsrechnung und Quoten', () => {
    const r = calculateAfford(DEFAULT_AFFORD, l, DEFAULT_RULES);
    expect(r.income).toBe(4600);
    expect(r.incomeForDsti).toBeCloseTo((4600 * 14) / 12, 2);
    expect(r.expenses).toBe(250 + 160 + 600 + 250 + 120 + 250 + 200);
    expect(r.free).toBe(4600 - 1830);
    expect(r.surplus).toBe(4600 - 1830 - 1200);
    expect(r.dsti).toBeCloseTo((1200 / ((4600 * 14) / 12)) * 100, 6);
    expect(r.ltv).toBeCloseTo(83.333, 2);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    // 40 % von 5.366,67 = 2.146,67; Haushalt ließe 2.470 zu → die Quote begrenzt
    expect(r.affordablePayment).toBe(2146.67);
    expect(r.limitedBy).toBe('quote');
    expect(r.maxLoan).toBe(principalForPayment(2146.67, 3.5, 360));
    expect(r.maxLoanStress).toBeLessThan(r.maxLoan);
  });
  it('Szenarien und Grenzwertverletzungen', () => {
    const tight = { ...DEFAULT_AFFORD, income2: 0, existingLoans: 400 };
    const r = calculateAfford(tight, l, DEFAULT_RULES);
    expect(r.checks[0].ok).toBe(false);
    expect(r.limitedBy).toBe('haushalt');
    expect(r.scenarios.find((s) => s.name === 'Karenz')!.assumption).toContain('Erstes');
    expect(r.scenarios.find((s) => s.name === 'Einkommensverlust')!.status).toBe('kritisch');
    expect(r.scenarios[0].payment).toBe(annuity(250000, 5.5, 360));
    expect(calculateAfford(DEFAULT_AFFORD, { ...l, principal: 290000 }, DEFAULT_RULES).checks[1].ok).toBe(false);
    expect(calculateAfford(DEFAULT_AFFORD, { ...l, termMonths: 480 }, DEFAULT_RULES).checks[2].ok).toBe(false);
    // Grenzwerte sind Parameter, nicht fest verdrahtet
    expect(calculateAfford(tight, l, { ...DEFAULT_RULES, maxDsti: 60 }).checks[0].ok).toBe(true);
  });
});

describe('Umschuldung', () => {
  it('niedrigerer Zins spart trotz Wechselkosten, Break-even nach einigen Monaten', () => {
    const r = calculateRefi(DEFAULT_REFI);
    expect(r.oldPayment).toBe(annuity(150000, 4.9, 240));
    expect(r.newPayment).toBe(annuity(150000, 3.6, 240));
    expect(r.penalty).toBe(1500);
    expect(r.setup).toBe(1500);
    expect(r.upfront).toBe(4800);
    expect(r.monthlySaving).toBe(round2(r.oldPayment + 8 - r.newPayment - 6));
    expect(r.netSaving).toBe(round2(r.old.grandTotal - r.neu.grandTotal - 4800));
    expect(r.netSaving).toBeGreaterThan(15000);
    expect(r.breakEvenMonth!).toBeGreaterThan(12);
    expect(r.breakEvenMonth!).toBeLessThan(48);
    expect(r.advantage[r.advantage.length - 1].value).toBeCloseTo(r.netSaving, 1);
  });
  it('Kosten mitfinanziert, Rate beibehalten, kein Vorteil bei gleichem Zins', () => {
    const fin = calculateRefi({ ...DEFAULT_REFI, financeCosts: true });
    expect(fin.newPrincipal).toBe(round2((150000 + 1500 + 1800) / 0.99));
    expect(fin.setup).toBe(round2(fin.newPrincipal * 0.01));
    expect(fin.advantage[fin.advantage.length - 1].value).toBeCloseTo(fin.netSaving, 1);
    const keep = calculateRefi({ ...DEFAULT_REFI, keepPayment: true });
    expect(keep.newPayment).toBe(keep.oldPayment);
    expect(keep.newMonths).toBeLessThan(240);
    expect(keep.netSaving).toBeGreaterThan(calculateRefi(DEFAULT_REFI).netSaving);
    const same = calculateRefi({ ...DEFAULT_REFI, newRate: 4.9, newMonthlyFee: 8 });
    expect(same.netSaving).toBe(-4800);
    expect(same.breakEvenMonth).toBeNull();
    expect(calculateRefi(DEFAULT_REFI, 1).netSaving).toBeLessThan(calculateRefi(DEFAULT_REFI).netSaving);
  });
});

describe('Tilgen oder investieren', () => {
  it('ohne Steuer und Kosten liegt die Break-even-Rendite beim Kreditzins', () => {
    const r = calculatePoi({ ...DEFAULT_POI, costs: 0, taxRate: 0, horizonYears: 25 }, loan);
    expect(r.breakEvenReturn!).toBeCloseTo(4, 1);
    expect(r.interestSaved).toBeGreaterThan(10000);
    expect(r.monthsSaved).toBeGreaterThan(0);
  });
  it('mit Steuer und Kosten braucht es mehr Rendite; Szenarien sind geordnet', () => {
    const r = calculatePoi(DEFAULT_POI, loan);
    expect(r.breakEvenReturn!).toBeGreaterThan(4.3);
    expect(r.scenarios[0].diff).toBeLessThan(0);
    expect(r.scenarios[2].diff).toBeGreaterThan(0);
    expect(r.scenarios[0].investNet).toBeLessThan(r.scenarios[1].investNet);
    const s = r.scenarios[1];
    expect(s.investNet).toBeCloseTo(s.investGross - s.tax, 2);
    // unabhängige Kontrolle: 10.000 € über 179 Monate (Anlage im Monat 1) bei 4,7 % netto
    expect(s.investGross).toBeCloseTo(10000 * Math.pow(1 + 0.047 / 12, 179), 0);
    expect(s.tax).toBeCloseTo((s.investGross - 10000) * 0.275, 1);
  });
  it('monatlicher Betrag und Horizont länger als die Laufzeit', () => {
    const r = calculatePoi({ ...DEFAULT_POI, amount: 0, monthly: 200, horizonYears: 30 }, loan);
    expect(r.monthsSaved).toBeGreaterThan(24);
    expect(Number.isFinite(r.scenarios[1].diff)).toBe(true);
    expect(r.breakEvenReturn).not.toBeNull();
  });
});

describe('Zustand: neue Kreditoptionen, Import und Export', () => {
  it('Anfangstilgung und Wunschrate ergeben die Laufzeit', () => {
    const t = analyze({ ...adv, termMode: 'tilgung', initialRepayment: 2 });
    expect(t.loan.firstPayment).toBe(round2((89000 * 5.2) / 100 / 12));
    expect(t.loan.months).toBeGreaterThan(300);
    const w = analyze({ ...adv, termMode: 'rate', desiredPayment: 600 });
    expect(w.loan.firstPayment).toBe(600);
    expect(w.loan.months).toBeLessThan(240);
    expect(analyze({ ...adv, termMode: 'rate', desiredPayment: 100 }).loan.neverRepaid).toBe(true);
  });
  it('Finanzierungskosten fließen in den Effektivzins, Gebühren in den Cashflow', () => {
    const a = analyze(adv);
    expect(a.loanInput.oneTimeCosts).toBe(a.fin.financingCosts);
    expect(a.loan.apr!).toBeGreaterThan(3.25);
    const withFees = analyze({ ...adv, fees: { accountMonthly: 10, insuranceMonthly: 5, otherOneTime: 0 } });
    expect(withFees.month.payment).toBe(round2(a.month.payment + 15));
    expect(withFees.month.cashflow).toBe(round2(a.month.cashflow - 15));
    expect(withFees.projection.years[0].cashflow).toBeCloseTo(a.projection.years[0].cashflow - 180, 1);
  });
  it('Kapitalbedarf, Eigenkapital- und Beleihungsquote', () => {
    const f = financing({ ...adv, furnishing: 8000, liquidityReserve: 5000 });
    const f0 = financing(adv);
    expect(f.totalInvestment).toBe(round2(f0.totalInvestment + 8000));
    expect(f.capitalNeed).toBe(round2(f.totalInvestment + 5000));
    expect(f.ownFundsNeeded).toBe(round2(f.capitalNeed - 89000));
    expect(f.ltv).toBeCloseTo((89000 / 119000) * 100, 6);
    expect(financing({ ...adv, furnishing: 8000, costsFinanced: true }).loan).toBeGreaterThan(89000 + 8000);
  });
  it('vereinfachte Ansicht pausiert die neuen Optionen', () => {
    const s: AppState = { ...DEFAULT_STATE, loanType: 'endfaellig', graceMonths: 24, fees: { accountMonthly: 9, insuranceMonthly: 0, otherOneTime: 0 }, extraRules: [{ id: 'a', label: '', interval: 'monatlich', unit: 'euro', amount: 100, from: 1, to: null }] };
    const a = analyze(s);
    expect(a.loan.firstPayment).toBe(384.9);
    expect(a.loan.months).toBe(360);
  });
  it('Export und Import: Rundreise und Abwehr ungültiger Daten', () => {
    const state: AppState = { ...adv, price: 250000, extraRules: [{ id: 'a', label: 'Bonus', interval: 'jaehrlich', unit: 'euro', amount: 3000, from: 12, to: null }], rateChanges: [{ year: 12, rate: 5 }] };
    const text = exportScenarios([{ id: '1', name: 'Wohnung A', savedAt: '2026-10-08T10:00:00Z', state }], state);
    const back = importScenarios(text)!;
    expect(back.scenarios[0].name).toBe('Wohnung A');
    expect(back.scenarios[0].state).toEqual(state);
    expect(back.current).toEqual(state);
    expect(importScenarios('kein json')).toBeNull();
    expect(importScenarios('{"app":"etwas anderes"}')).toBeNull();
    const evil = normalize({ price: 'DROP TABLE', mode: 'hack', interval: 7, loanType: '<script>', termYears: Infinity, extraRules: [{ amount: 'x', interval: 'nie' }, 5, null],
      offers: [{ name: '<img onerror=x>', amount: {}, mode: 'x' }], invest: { costs: 'nope', rent: { components: [] } }, __proto__: { polluted: true }, unbekannt: 1 });
    expect(evil.price).toBe(DEFAULT_STATE.price);
    expect(evil.mode).toBe('fix');
    expect(evil.interval).toBe(1);
    expect(evil.loanType).toBe('annuitaet');
    expect(evil.termYears).toBe(30);
    expect(evil.extraRules.length).toBe(1);
    expect(evil.extraRules[0].amount).toBe(0);
    expect(evil.extraRules[0].interval).toBe('einmalig');
    expect(evil.offers[0].amount).toBe(EXAMPLE_OFFERS[0].amount);
    expect(evil.offers[0].mode).toBe('fix');
    expect(evil.invest.rent.components.length).toBe(7);
    expect((evil as unknown as Record<string, unknown>).unbekannt).toBeUndefined();
    expect(() => analyze(evil)).not.toThrow();
    expect(toLoanInput(normalize({ loanStart: '31.12.2026' })).startDate).toBe(DEFAULT_STATE.loanStart);
  });
});
