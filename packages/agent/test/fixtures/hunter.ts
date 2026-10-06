import type { Claim, Evidence } from '@cek-dulu/shared';
import { addDays, windowEndingToday, type ToolResult } from '@cek-dulu/sectors';
import { adroDividendFixture } from '../../../shared/fixtures/index.js';
import { flattenHunterToolResult, type HypothesisContext } from '../../src/hunter/index.js';

export const today = '2026-09-26';
export const context: HypothesisContext = { today, priceWindow: windowEndingToday(30, today), comparisonWindow: windowEndingToday(90, today) };
export const makeClaim = (type: Claim['type'], asserted: Partial<Claim['asserted']> = {}): Claim => ({
  claimId: 'c1', checkId: 'check1', ticker: 'ADRO', type, span: [0, 20], inScope: true,
  asserted: { metric: type === 'valuation' ? 'PER' : type === 'dividend' ? 'yield dividen' : 'perubahan harga',
    value: type === 'dividend' ? 25.5 : type === 'valuation' ? 6 : 80,
    unit: type === 'valuation' ? 'x' : '%', ...(type === 'price_move' ? { window: 'sebulan' } : {}), ...asserted },
});
export const toolResult = (data: unknown, endpoint: ToolResult<unknown>['endpoint'] = 'fetchCompanyReport',
  sections = ['dividend']): ToolResult<unknown> => ({ data, endpoint, params: { symbol: 'ADRO', ...(endpoint === 'fetchCompanyReport' ? { sections } : {}) },
  cached: true, credits: 0, fetchedAt: `${today}T00:00:00.000Z` });

/** Total/pembayaran kedua SINTETIS: hanya Rp1.358,18 dan tanggalnya merupakan fakta ADRO AGENTS.md. */
export function dividendData(overrides: Record<string, unknown> = {}) {
  return { symbol: 'ADRO', dividend: { yield_ttm: 0.0556, dividend_yield_avg: { avg_yield: 0.255, period: 5 },
    cash_payout_ratio: -0.897, historical_dividends: {
      '2024': { total_dividend: 1600, breakdown: [{ date: '2024-11-28', total: 1358.18, yield: 0.452 },
        { date: '2024-06-01', total: 241.82, yield: null }] },
    }, ...overrides } };
}
export function dividendEvidence(overrides: Record<string, unknown> = {}): Evidence[] {
  return flattenHunterToolResult(makeClaim('dividend'), toolResult(dividendData(overrides)), today);
}
export function actionsEvidence(available = false): Evidence[] {
  return flattenHunterToolResult(makeClaim('dividend'), toolResult({ symbol: 'ADRO', corporate_actions: { dividend: available
    ? [{ ex_date: '2026-06-01', payment_date: '2026-06-20', dividend_amount: 100 }] : [] } }, 'fetchCorporateActions'), today);
}
/** Fakta ADRO saja dari shared; metadata coverage mengikuti AGENTS, corporate-actions belum dikonfirmasi. */
export const adroKnownEvidence: Evidence[] = adroDividendFixture.result.evidence.filter((e) => ['adro-avg', 'adro-ttm', 'adro-cash'].includes(e.evidenceId))
  .map((e) => ({ ...e, claimId: 'c1', params: { ...e.params, hunter: { symbol: 'ADRO', metric:
    e.evidenceId === 'adro-avg' ? 'dividend.avg_yield' : e.evidenceId === 'adro-ttm' ? 'dividend.yield_ttm' : 'dividend.cash_payout_ratio' } } }));
adroKnownEvidence.push({ evidenceId: 'adro-coverage-agents', claimId: 'c1', tool: 'fixture:agents-section-6',
  params: { source: 'AGENTS.md bagian 6', hunter: { symbol: 'ADRO', metric: 'dividend.year_coverage', year: 2026 } },
  credits: 0, cached: true, fetchedAt: '2026-09-23T00:00:00.000Z', label: 'Data dividen ADRO 2026 belum tersedia', value: 'empty' });

/** Semua valuasi/peer di bawah sintetis; bukan angka aktual ADRO. */
export function valuationEvidence(current = 6, history = [3, 3, 3], peers = [3, 4, 5, 80, 1000, -2, 0], peg: number | null = -1): Evidence[] {
  return flattenHunterToolResult(makeClaim('valuation'), toolResult({ symbol: 'ADRO', valuation: { historical_valuation: [
    { year: 2026, pe: current, pb: 2, peg }, ...history.map((pe, i) => ({ year: 2025 - i, pe, pb: 2, peg: null })) ] },
    peers: peers.map((pe, i) => ({ symbol: `P${i}`, pe })) }, 'fetchCompanyReport', ['valuation', 'peers']), today);
}
/** Harga dan volume seluruhnya sintetis; 120 observasi untuk seluruh cabang harga. */
export function priceData(lowBase = true, volume = 10000) {
  return Array.from({ length: 120 }, (_, i) => ({ symbol: 'ADRO', date: addDays(today, i - 119),
    close: i < 90 ? 100 : lowBase ? 30 + (i - 90) * 30 / 29 : 100 + (i - 90) * 5 / 29, volume }));
}
export function priceEvidence(lowBase = true, volume = 10000): Evidence[] {
  return flattenHunterToolResult(makeClaim('price_move'), toolResult(priceData(lowBase, volume), 'fetchDailyPrice'), today);
}
