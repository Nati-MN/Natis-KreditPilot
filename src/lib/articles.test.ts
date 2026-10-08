import { describe, expect, it } from 'vitest';
import { ARTICLES, findArticle } from './articles';
import { calculateLoan, extraEffect, NO_EXTRAS, principalForPayment, type LoanInput } from './loan';
import { allRoutes, metaFor, parseHash, parsePath, pathFor, PAGES } from './routes';

const base: LoanInput = { principal: 300000, termYears: 30, mode: 'fix', fixRate: 3.5, fixYears: 30, variableRate: 3.5, rateChanges: [], useReference: false, referenceRate: 0, margin: 0, adjustMonths: 12, extra: NO_EXTRAS };
/** 1347.13 → "1.347,13", 184969.51 → "184.970" (ohne Nachkommastellen). */
const de = (v: number, digits = 0) => v.toFixed(digits).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const text = (slug: string) => JSON.stringify(findArticle(slug));

describe('Rechenbeispiele in den Ratgebertexten', () => {
  it('Fixzins oder variabel', () => {
    const t = text('fixzins-oder-variabel');
    const fix = calculateLoan(base);
    const up = calculateLoan({ ...base, mode: 'variabel', fixYears: 10, variableRate: 5.5 });
    const down = calculateLoan({ ...base, mode: 'variabel', fixYears: 10, variableRate: 2.5 });
    for (const v of [de(fix.firstPayment, 2), de(up.paymentAfterFix ?? 0, 2), de(down.paymentAfterFix ?? 0, 2), de(fix.totalInterest), de(up.totalInterest)]) expect(t).toContain(v);
    expect(Math.round(((up.paymentAfterFix ?? 0) - fix.firstPayment) / 10) * 10).toBe(250);
  });
  it('Leistbarkeit', () => {
    const t = text('wie-viel-kredit-kann-ich-mir-leisten');
    for (const [rate, months] of [[3.5, 360], [3.5, 300], [5.5, 360]]) expect(t).toContain(`rund ${de(Math.round(principalForPayment(1200, rate, months) / 1000) * 1000)} €`);
  });
  it('Sondertilgung', () => {
    const t = text('sondertilgung');
    const run = (extra: Partial<typeof NO_EXTRAS>) => {
      const input = { ...base, extra: { ...NO_EXTRAS, ...extra } };
      return extraEffect(input, calculateLoan(input));
    };
    const early = run({ oneTimeAmount: 20000, oneTimeYear: 3 });
    const late = run({ oneTimeAmount: 20000, oneTimeYear: 20 });
    const yearly = run({ yearlyAmount: 3000 });
    expect(early.monthsSaved).toBe(36);
    expect(late.monthsSaved).toBe(20);
    expect(360 - yearly.monthsSaved).toBe(23 * 12);
    for (const v of [early.interestSaved, late.interestSaved, yearly.interestSaved]) expect(t).toContain(`${de(v)} €`);
  });
  it('Kaufnebenkosten', () => {
    const t = text('kaufnebenkosten-oesterreich');
    const [grest, grundbuch, makler] = [300000 * 0.035, 300000 * 0.011, 300000 * 0.03 * 1.2];
    for (const v of [grest, grundbuch, makler, grest + grundbuch + makler]) expect(t).toContain(`${de(v)} €`);
    expect(((grest + grundbuch + makler) / 300000) * 100).toBeCloseTo(8.2, 6);
  });
  it('Effektivzins', () => {
    const t = text('effektivzins-und-nominalzins');
    const a = calculateLoan({ ...base, principal: 200000, termYears: 25, fixYears: 25, fixRate: 3.4, oneTimeCosts: 5000, monthlyFees: 8 });
    const b = calculateLoan({ ...base, principal: 200000, termYears: 25, fixYears: 25, fixRate: 3.6 });
    for (const v of [de(a.firstPayment, 2), de(a.apr ?? 0, 2), de(a.totalCost), de(b.firstPayment, 2), de(b.apr ?? 0, 2), de(b.totalCost)]) expect(t).toContain(v);
    expect(Math.round((a.totalCost - b.totalCost) / 5) * 5).toBe(965);
  });
  it('Vermietung', () => {
    const t = text('wohnung-vermieten-rendite');
    const rate = calculateLoan({ ...base, principal: 160000 }).firstPayment;
    expect(t).toContain(de(rate, 2));
    expect(Math.round(750 - 100 - rate)).toBe(-68);
    expect(((750 * 12) / 200000) * 100).toBe(4.5);
  });
});

describe('Adressen', () => {
  it('jeder Bereich und jeder Ratgebertext hat einen eindeutigen Pfad, der zurück zum Bereich führt', () => {
    const paths = allRoutes().map((r) => pathFor(r.section, r.slug));
    expect(new Set(paths).size).toBe(paths.length);
    for (const r of allRoutes()) expect(parsePath(pathFor(r.section, r.slug))).toEqual(r);
  });
  it('liest Varianten und weist Unbekanntes ab', () => {
    expect(parsePath('/')).toEqual({ section: 'start', slug: null });
    expect(parsePath('/kreditrechner/')).toEqual({ section: 'kredit', slug: null });
    expect(parsePath('/kreditrechner.html')).toEqual({ section: 'kredit', slug: null });
    expect(parsePath('/gibt-es-nicht')).toBeNull();
    expect(parsePath('/ratgeber/gibt-es-nicht')).toBeNull();
    expect(parseHash('#invest')).toEqual({ section: 'invest', slug: null });
    expect(parseHash('#ratgeber/sondertilgung')).toEqual({ section: 'ratgeber', slug: 'sondertilgung' });
    expect(parseHash('#unsinn')).toBeNull();
  });
  it('Titel und Beschreibungen sind vorhanden und nicht zu lang für Suchergebnisse', () => {
    for (const r of allRoutes()) {
      const m = metaFor(r.section, r.slug);
      expect(m.title.length).toBeGreaterThan(10);
      expect(m.title.length).toBeLessThanOrEqual(75);
      expect(m.description.length).toBeGreaterThan(50);
      expect(m.description.length).toBeLessThanOrEqual(170);
      expect(m.url.startsWith('https://kredit-pilot.site/')).toBe(true);
    }
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
    expect(PAGES.start.path).toBe('/');
  });
});
