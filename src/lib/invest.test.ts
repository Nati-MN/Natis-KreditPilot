import { describe, expect, it } from 'vitest';
import { analyze, breakEven, compareMetrics } from './analysis';
import { DEFAULT_RENT, project, rentBreakdown, typicalMonth, type CostItem } from './invest';
import { DEFAULT_STATE, effectiveState, financing, type AppState } from './state';

const adv: AppState = { ...DEFAULT_STATE, viewMode: 'erweitert' };
const withInvest = (s: AppState, p: Partial<AppState['invest']>): AppState => ({ ...s, invest: { ...s.invest, ...p } });
const noRisk = { vacancyMonths: 0, rentLoss: 0, tenantChangeYears: 0, rentGrowth: 0, costGrowth: 0 };
const cost = (p: Partial<CostItem>): CostItem => ({ id: 'x', name: 'X', amount: 0, interval: 'monatlich', category: 'Sonstiges', umlagefaehig: false, payer: 'vermieter', taxMode: 'sofort', ...p });

describe('Finanzierung', () => {
  it('Standard: 89.000 € Kredit, Nebenkosten aus Eigenmitteln', () => {
    const f = financing(adv);
    expect(f.loan).toBe(89000);
    // 3,5 % + 1,1 % + 3,6 % + 1,8 % von 119.000 + 600 + 250 + (1,2 % + 1 %) von 89.000 + 400
    expect(f.costs).toBeCloseTo(119000 * 0.1 + 850 + 89000 * 0.022 + 400, 2);
    expect(f.totalInvestment).toBeCloseTo(119000 + f.costs, 2);
    expect(f.ownFunds).toBeCloseTo(f.totalInvestment - 89000, 2);
    console.log('Nebenkosten', f.costs, 'Gesamtinvestition', f.totalInvestment, 'Eigenmittel', f.ownFunds);
  });
  it('Mitfinanzierung: kreditabhängige Gebühren sind konsistent', () => {
    const f = financing({ ...adv, costsFinanced: true });
    expect(f.loan).toBeCloseTo(119000 - 30000 + f.costs, 1);
    expect(f.ownFunds).toBeCloseTo(30000, 1);
  });
});

describe('Miete und Umsatzsteuer', () => {
  it('Beispiel 600 + 150 + 60 + 20, Kleinunternehmer', () => {
    const b = rentBreakdown(DEFAULT_RENT);
    expect(b.income).toBe(600);
    expect(b.vatTotal).toBe(0);
    expect(b.bruttomietzins).toBe(750);
    expect(b.tenantTotal).toBe(830);
  });
  it('Regelbesteuerung: unterschiedliche Sätze je Bestandteil', () => {
    const b = rentBreakdown({ ...DEFAULT_RENT, kleinunternehmer: false });
    expect(b.vatTotal).toBe(60 + 15 + 12 + 4);
    expect(b.bruttomietzins).toBe(660 + 165);
    expect(b.tenantTotal).toBe(830 + 91);
    expect(b.income).toBe(600); // USt und Betriebskosten sind kein Ertrag
  });
});

describe('Cashflow', () => {
  it('Beispiel: 700 € Miete − 100 € Kosten − Kreditrate', () => {
    const s = withInvest({ ...adv, manualLoan: true, manualLoanAmount: 119000 }, {
      ...noRisk, rent: { ...DEFAULT_RENT, components: DEFAULT_RENT.components.map((c) => (c.key === 'hmz' ? { ...c, amount: 700 } : c)) },
    });
    const a = analyze(s);
    expect(a.month.landlordCosts).toBe(100);
    expect(a.month.payment).toBe(514.64);
    expect(a.month.cashflow).toBe(85.36);
    expect(a.yields.grossOnPrice).toBeCloseTo((8400 / 119000) * 100, 6);
  });
  it('Monat × 12 = Jahr, einmalige Kosten nicht monatlich', () => {
    const s = withInvest(adv, { ...noRisk, startMonth: '2026-10', costs: [
      cost({ id: 'a', amount: 300, interval: 'jaehrlich' }), cost({ id: 'b', amount: 90, interval: 'quartal' }),
      cost({ id: 'c', amount: 5000, interval: 'einmalig', start: '2028-03' }), cost({ id: 'd', amount: 1000, interval: 'einmalig' }),
      cost({ id: 'e', amount: 40, payer: 'mieter', umlagefaehig: true }),
    ] });
    const a = analyze(s);
    expect(a.month.landlordCosts).toBe(55);
    expect(a.fin.initialCosts).toBe(1000);
    const y = a.projection.years;
    expect(y[0].cashflow).toBeCloseTo(a.month.cashflow * 12, 1);
    expect(y[0].oneTime).toBe(0);
    expect(y[1].oneTime).toBe(5000); // März 2028 = Monat 18
    expect(y[2].oneTime).toBe(0);
    expect(y[1].cashflow).toBeCloseTo(a.month.cashflow * 12 - 5000, 1);
  });
  it('Leerstand: Mietausfall plus Betriebskosten beim Vermieter', () => {
    const a = analyze(withInvest(adv, { ...noRisk, vacancyMonths: 1.2 }));
    expect(a.month.income).toBe(540);
    expect(a.month.vacancyCosts).toBe(15);
  });
  it('Prognose übernimmt Restschuld und variable Rate aus dem Kreditrechner', () => {
    const a = analyze({ ...adv, mode: 'variabel', variableRate: 4.5 });
    expect(a.projection.years[9].balance).toBe(a.loan.rows[119].balance);
    expect(a.projection.months[120].payment).toBe(a.loan.paymentAfterFix);
    expect(a.afterFix!.payment).toBeGreaterThan(a.month.payment);
    expect(a.projection.years[29].balance).toBe(0);
    expect(a.projection.totalInterest).toBeCloseTo(a.loan.totalInterest, 1);
  });
});

describe('Steuer', () => {
  it('Tilgung ist nicht abzugsfähig, Zinsen und AfA schon', () => {
    const s = withInvest(adv, { ...noRisk, tax: { enabled: true, marginalRate: 40, landShare: 40, afaRate: 1.5, accelerated: false, offsetLosses: true }, costs: [] });
    const a = analyze(s);
    const y = a.projection.years[0];
    const base = (119000 + a.fin.acquisitionCosts) * 0.6;
    expect(y.afa).toBeCloseTo(base * 0.015, 1);
    expect(y.taxableSurplus).toBeCloseTo(7200 - y.interest - y.afa - a.fin.financingCosts / 30, 1);
    expect(y.tax).toBeCloseTo(y.taxableSurplus * 0.4, 1);
    expect(y.cashflowAfterTax).toBeCloseTo(y.cashflow - y.tax, 2);
    expect(y.principal).toBeGreaterThan(0);
  });
});

describe('Break-even', () => {
  it('Mindestmiete ergibt Cashflow 0 bzw. Zielwert', () => {
    const be = breakEven(adv, analyze(adv));
    const set = (hmz: number) => withInvest(adv, { rent: { ...DEFAULT_RENT, components: DEFAULT_RENT.components.map((c) => (c.key === 'hmz' ? { ...c, amount: hmz } : c)) } });
    expect(Math.abs(analyze(set(be.rentForZero)).month.cashflow)).toBeLessThan(0.02);
    expect(Math.abs(analyze(set(be.rentForTarget)).month.cashflow - 200)).toBeLessThan(0.02);
  });
  it('Zins-, Eigenkapital- und Leerstandsgrenzen', () => {
    const a = analyze(adv);
    const be = breakEven(adv, a);
    expect(be.maxRate!).toBeGreaterThan(3.2);
    expect(Math.abs(analyze({ ...adv, fixRate: be.maxRate! }).month.cashflow)).toBeLessThan(0.5);
    expect(be.equityForPositive!).toBeLessThan(30000);
    expect(Math.abs(analyze({ ...adv, equity: be.equityForPositive! }).month.cashflow)).toBeLessThan(1);
    const tight = withInvest(adv, { rent: { ...DEFAULT_RENT, components: DEFAULT_RENT.components.map((c) => (c.key === 'hmz' ? { ...c, amount: 420 } : c)) } });
    const be2 = breakEven(tight, analyze(tight));
    expect(be2.maxRate!).toBeLessThan(3.2);
    expect(be2.equityForPositive!).toBeGreaterThan(30000);
    expect(Math.abs(analyze({ ...tight, equity: be2.equityForPositive! }).month.cashflow)).toBeLessThan(1);
    const v = be.vacancyMonthsPerYear;
    expect(Math.abs(analyze(withInvest(adv, { vacancyMonths: v })).month.cashflow)).toBeLessThan(0.5);
    console.log('max Zins', be.maxRate, 'Leerstand', v, 'max Preis netto', be.maxPriceNet, 'IRR', a.projection.irr);
  });
});

describe('Ansichten und Vergleich', () => {
  it('Vereinfachte Ansicht pausiert Erweitertes', () => {
    const s: AppState = { ...DEFAULT_STATE, viewMode: 'einfach', extra: { ...DEFAULT_STATE.extra, monthlyAmount: 100 } };
    expect(effectiveState(s).extra.monthlyAmount).toBe(0);
    expect(analyze(s).loan.months).toBe(360);
    expect(analyze({ ...s, viewMode: 'erweitert' }).loan.months).toBeLessThan(360);
  });
  it('Wohnung A gegen Wohnung B', () => {
    const a = compareMetrics(adv);
    const b = compareMetrics({ ...adv, price: 160000, invest: { ...adv.invest, rent: { ...DEFAULT_RENT, components: DEFAULT_RENT.components.map((c) => (c.key === 'hmz' ? { ...c, amount: 850 } : c)) } } });
    expect(b.loan).toBe(130000);
    expect(b.payment).toBeGreaterThan(a.payment);
    expect(a.irr).not.toBeNull();
  });
  it('Grenzfälle: ohne Kredit, ohne Miete, fallende Preise', () => {
    const cash = analyze({ ...adv, equity: 119000 });
    expect(cash.month.payment).toBe(0);
    expect(cash.projection.years[29].equity).toBeGreaterThan(0);
    const empty = analyze(withInvest(adv, { rent: { ...DEFAULT_RENT, components: DEFAULT_RENT.components.map((c) => ({ ...c, amount: 0 })) } }));
    expect(empty.month.cashflow).toBeLessThan(0);
    const falling = analyze(withInvest(adv, { valueGrowth: -5 }));
    expect(falling.projection.years[4].equity).toBeLessThan(falling.projection.years[0].equity + 20000);
    expect(Number.isFinite(project(falling.invest, falling.loan).totalGain)).toBe(true);
    expect(typicalMonth(falling.invest, 0).payment).toBe(0);
  });
});
