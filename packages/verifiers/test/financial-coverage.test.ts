import { describe, expect, it } from 'vitest';
import { verifyEarningsGrowth } from '../src/earnings-growth.js';
import { verifyValuation } from '../src/valuation.js';
import { ctx, makeClaim, seededClient } from './helpers.js';
const rows = [
  { symbol: 'BBTN', date: '2026-06-30', earnings: 1294233000000, provision: 579011000000, total_assets: 545161326000000, financials_sector_metrics: { interest_income: 8318939000000, net_interest_income: 4268477000000, total_earning_assets: null } },
  { symbol: 'BBTN', date: '2026-03-31', earnings: 1107979000000, provision: 966712000000, total_assets: 517542708000000, financials_sector_metrics: { interest_income: 8012591000000 } },
  { symbol: 'BBTN', date: '2025-12-31', earnings: 1198474000000 },
  { symbol: 'BBTN', date: '2025-09-30', earnings: 596291000000 },
  { symbol: 'BBTN', date: '2025-06-30', earnings: 802679000000, provision: 2745820000000, financials_sector_metrics: { interest_income: 10290432000000 } },
  { symbol: 'BBTN', date: '2025-03-31', earnings: 903710000000, provision: 927926000000, financials_sector_metrics: { interest_income: 8210264000000 } },
];
const params = { symbol: 'BBTN', n_quarters: 6, report_date: '2026-06-30' };
const clientFor = (response: unknown = rows) => seededClient([{ endpoint: 'fetchQuarterlyFinancials', params, response }]);
const claim = (metric: string, value: number, unit: '%' | 'IDR' = '%') => makeClaim('earnings_growth', 'BBTN', { metric, value, unit, period: 'Semester I 2026' });
describe('financial coverage against actual BBTN source fields', () => {
  it('supports nominal H1 profit and rejects an incorrect amount', async () => {
    const out = await verifyEarningsGrowth(claim('laba bersih', 2400000000000, 'IDR'), ctx(clientFor()));
    expect(out.matches).toBe(true); expect(out.computed?.value).toBe(2402212000000);
    expect(out.evidence[0]?.label).toContain('Semester I 2026');
    expect((await verifyEarningsGrowth(claim('laba bersih', 3000000000000, 'IDR'), ctx(clientFor()))).matches).toBe(false);
  });
  it('checks interest income itself instead of total revenue or earnings', async () => {
    const out = await verifyEarningsGrowth(claim('pendapatan bunga', -22), ctx(clientFor()));
    expect(out.matches).toBe(false); expect(out.computed?.value).toBe(-11.72);
    expect(out.evidence.map(item => item.value)).toContain(16331530000000);
    expect(out.details?.coverage).toMatchObject({ field: 'financials_sector_metrics.interest_income', status: 'CHECKED' });
  });
  it('checks provision expense instead of the loan-loss allowance stock', async () => {
    const out = await verifyEarningsGrowth(claim('biaya pencadangan kredit', -81), ctx(clientFor()));
    expect(out.matches).toBe(false); expect(out.computed?.value).toBe(-57.93);
    expect(out.evidence.map(item => item.value)).toContain(1545723000000);
    expect(out.details?.coverage).toMatchObject({ field: 'provision' });
  });
  it('does not sum balance-sheet assets over a semester', async () => {
    const out = await verifyEarningsGrowth(claim('total aset', 545161326000000, 'IDR'), ctx(clientFor()));
    expect(out.matches).toBe(true); expect(out.computed?.value).toBe(545161326000000);
    expect(out.details?.coverage).toMatchObject({ formula: 'snapshot' });
  });
  it('identifies the missing interest-income field and quarter without substituting earnings', async () => {
    const out = await verifyEarningsGrowth(claim('pendapatan bunga', -22), ctx(clientFor(rows.map(row => row.date === '2026-03-31' ? { ...row, financials_sector_metrics: null } : row))));
    expect(out.matches).toBeNull(); expect(out.computed).toBeUndefined();
    expect(out.details?.coverage).toMatchObject({ missing: [{ date: '2026-03-31', field: 'financials_sector_metrics.interest_income', reason: 'FIELD_NULL_OR_MISSING' }] });
  });
  it('identifies a missing base quarter and keeps available current evidence', async () => {
    const out = await verifyEarningsGrowth(claim('pendapatan bunga', -22), ctx(clientFor(rows.filter(row => row.date !== '2025-03-31'))));
    expect(out.matches).toBeNull(); expect(out.evidence).toHaveLength(1);
    expect(out.details?.coverage).toMatchObject({ missing: [{ date: '2025-03-31', reason: 'REPORT_MISSING' }] });
  });
  it('reports the annual-versus-semester gap for NIM after checking the financials source', async () => {
    const client = seededClient([{ endpoint: 'fetchCompanyReport', params: { symbol: 'BBTN', sections: ['financials'] }, response: { financials: { historical_financial_ratio: [{ year: '2025', profitability: { net_interest_margin: 0.03563185582805318 } }] } } }]);
    const out = await verifyEarningsGrowth(claim('NIM (level)', 3.5), ctx(client));
    expect(out.matches).toBeNull(); expect(out.computed).toBeUndefined();
    expect(out.details?.coverage).toMatchObject({ status: 'PERIOD_GRANULARITY_MISMATCH', availableYears: [2025], missingFields: ['NIM untuk periode klaim'] });
  });
  it('does not mistake a cache miss for confirmed absence from Sectors', async () => {
    const out = await verifyEarningsGrowth(claim('laba bersih', 40), ctx(seededClient([])));
    expect(out.details?.coverage).toMatchObject({ status: 'CACHE_MISS' });
    expect(out.note).toContain('belum membuktikan');
  });
  it('refuses unknown metrics and requires a period for nominal statements', async () => {
    expect((await verifyEarningsGrowth(claim('portofolio kredit pensiun', 7.34e12, 'IDR'), ctx(seededClient([])))).details?.coverage).toMatchObject({ status: 'METRIC_UNSUPPORTED' });
    const c = claim('laba bersih', 2.4e12, 'IDR'); delete c.asserted.period;
    expect((await verifyEarningsGrowth(c, ctx(seededClient([])))).details?.coverage).toMatchObject({ status: 'PERIOD_REQUIRED' });
  });
  it('sums all four standalone quarters for an annual nominal claim', async () => {
    const response = ['03-31', '06-30', '09-30', '12-31'].map(date => ({ symbol: 'BBTN', date: `2025-${date}`, earnings: 100 }));
    const c = claim('laba bersih', 400, 'IDR'); c.asserted.period = 'tahun 2025';
    const client = seededClient([{ endpoint: 'fetchQuarterlyFinancials', params: { symbol: 'BBTN', n_quarters: 8, report_date: '2025-12-31' }, response }]);
    const out = await verifyEarningsGrowth(c, ctx(client)); expect(out.computed?.value).toBe(400); expect(out.matches).toBe(true);
  });
});
describe('dated valuation coverage', () => {
  const valuationClient = () => seededClient([{ endpoint: 'fetchCompanyReport', params: { symbol: 'BBTN', sections: ['valuation'] }, response: { symbol: 'BBTN', valuation: { historical_valuation: [{ year: 2026, pb: 0.8 }, { year: 2025, pb: 0.47 }] } } }]);
  it('uses the requested year, not the newest annual ratio', async () => {
    const out = await verifyValuation(makeClaim('valuation', 'BBTN', { metric: 'PBV', value: 0.47, unit: 'x', period: '2025' }), ctx(valuationClient()));
    expect(out.matches).toBe(true); expect(out.computed?.value).toBe(0.47);
  });
  it('fetches the source but refuses to substitute an annual PBV for a dated daily value', async () => {
    const out = await verifyValuation(makeClaim('valuation', 'BBTN', { metric: 'PBV', value: 0.47, unit: 'x', period: '19 Jul 2026' }), ctx(valuationClient()));
    expect(out.matches).toBeNull(); expect(out.computed).toBeUndefined();
    expect(out.details?.coverage).toMatchObject({ status: 'DATED_SOURCE_MISSING', availableYears: [2026, 2025], requestedPeriod: '19 Jul 2026' });
  });
});

it('annual cumulative profit uses the annual total without adding interim quarters again', async () => {
  const c = claim('laba bersih', 400, 'IDR'); c.asserted.period = '2025';
  const client = seededClient([{ endpoint: 'fetchQuarterlyFinancials', params: { symbol: 'BBTN', n_quarters: 8, report_date: '2025-12-31' }, response: [
    { symbol: 'BBTN', date: '2025-03-31', earnings: 100, period_basis: 'cumulative' },
    { symbol: 'BBTN', date: '2025-06-30', earnings: 200, period_basis: 'cumulative' },
    { symbol: 'BBTN', date: '2025-09-30', earnings: 300, period_basis: 'cumulative' },
    { symbol: 'BBTN', date: '2025-12-31', earnings: 400, period_basis: 'cumulative' },
  ] }]);
  expect((await verifyEarningsGrowth(c, ctx(client))).computed?.value).toBe(400);
});
it('does not treat a cumulative quarterly value as standalone quarter earnings', async () => {
  const c = claim('laba bersih', 200, 'IDR'); c.asserted.period = 'Q2 2026';
  const client = seededClient([{ endpoint: 'fetchQuarterlyFinancials', params: { symbol: 'BBTN', n_quarters: 5, report_date: '2026-06-30' }, response: [{ symbol: 'BBTN', date: '2026-06-30', earnings: 200, period_basis: 'cumulative' }] }]);
  const out = await verifyEarningsGrowth(c, ctx(client)); expect(out.matches).toBeNull(); expect(out.details?.coverage).toMatchObject({ status: 'BASIS_MISMATCH' });
});

it('checks NIM for the exact requested year and converts the Sectors ratio to percentage points', async () => {
  const c = claim('NIM (level)', 3.56); c.asserted.period = '2025';
  const client = seededClient([{ endpoint: 'fetchCompanyReport', params: { symbol: 'BBTN', sections: ['financials'] }, response: { financials: { historical_financial_ratio: [
    { year: '2024', profitability: { net_interest_margin: 0.02531718544232781 } },
    { year: '2025', profitability: { net_interest_margin: 0.03563185582805318 } },
  ] } } }]);
  const out = await verifyEarningsGrowth(c, ctx(client));
  expect(out.matches).toBe(true); expect(out.computed?.value).toBeCloseTo(3.5631855828);
  c.asserted.value = 5; expect((await verifyEarningsGrowth(c, ctx(client))).matches).toBe(false);
  c.asserted.period = '2023'; expect((await verifyEarningsGrowth(c, ctx(client))).details?.coverage).toMatchObject({ status: 'FIELD_OR_YEAR_MISSING' });
});

it.each([
  ['ROA (level)', 'profitability', 'roa', 0.006633568868668351],
  ['ROE (level)', 'profitability', 'roe', 0.09668946893083688],
  ['CASA (level)', 'liquidity', 'casa_ratio', 0.5040156191866869],
  ['CAR (level)', 'capital', 'capital_adequacy_ratio', 0.1902433158450498],
] as const)('compares annual %s with its own reported Sectors field', async (metric, group, field, value) => {
  const c = claim(metric, value * 100); c.asserted.period = '2025';
  const client = seededClient([{ endpoint: 'fetchCompanyReport', params: { symbol: 'BBTN', sections: ['financials'] }, response: { financials: { historical_financial_ratio: [{ year: '2025', [group]: { [field]: value } }] } } }]);
  const out = await verifyEarningsGrowth(c, ctx(client));
  expect(out.matches).toBe(true); expect(out.computed?.value).toBeCloseTo(value * 100);
  expect(out.details?.coverage).toMatchObject({ field: `financials.historical_financial_ratio.${group}.${field}` });
});

describe('nine-month flows',()=>{
 it('sums three standalone quarters, and compares the same nine months last year',async()=>{
  const source=[{date:'2025-09-30',earnings:130},{date:'2025-06-30',earnings:110},{date:'2025-03-31',earnings:90},{date:'2024-12-31',earnings:999},{date:'2024-09-30',earnings:100},{date:'2024-06-30',earnings:100},{date:'2024-03-31',earnings:100}];
  const client=seededClient([{endpoint:'fetchQuarterlyFinancials',params:{symbol:'UNVR',n_quarters:7,report_date:'2025-09-30'},response:source}]);
  const c=makeClaim('earnings_growth','UNVR',{metric:'laba bersih',value:10,unit:'%',period:'hingga kuartal tiga 2025'});
  const out=await verifyEarningsGrowth(c,ctx(client));
  expect(out.matches).toBe(true);expect(out.computed?.value).toBe(10);
  expect(out.evidence.map(e=>e.value)).toContain(330);
  expect(out.evidence.map(e=>e.value)).toContain(300);
 });
 it('uses explicit cumulative Q3 once, never sums it with Q1 and Q2',async()=>{
  const client=seededClient([{endpoint:'fetchQuarterlyFinancials',params:{symbol:'UNVR',n_quarters:7,report_date:'2025-09-30'},response:[{date:'2025-09-30',earnings:330,period_basis:'cumulative'},{date:'2024-09-30',earnings:300,period_basis:'cumulative'}]}]);
  const out=await verifyEarningsGrowth(makeClaim('earnings_growth','UNVR',{metric:'laba bersih',value:10,unit:'%',period:'9M 2025'}),ctx(client));
  expect(out.computed?.value).toBe(10);expect(out.matches).toBe(true);
 });
});
