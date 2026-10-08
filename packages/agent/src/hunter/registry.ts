import { ClaimSchema, HypothesisSchema, type Claim, type ClaimType, type Hypothesis, type ToolCall } from '@cek-dulu/shared';
import { addDays, ENDPOINTS, estimateCredits, sampledWindows, splitWindow, windowEndingToday,
  type DateWindow, type EndpointName } from '@cek-dulu/sectors';
import { isDividendAmountClaim } from '@cek-dulu/verifiers';
import { routeClaim } from '../router.js';
import * as tests from './hypotheses.js';
import * as C from './constants.js';

export type HypothesisRegistry = ReadonlyMap<string, Hypothesis>;
const definitions = [
  ['DIV_ONE_OFF', 'dividend', 'Periksa pembayaran dominan dalam total dividen tahunan, termasuk pembayaran khusus.', tests.testDivOneOff],
  ['DIV_TTM_GAP', 'dividend', 'Periksa rata-rata historis vs TTM dan kelengkapan data tahun berjalan melalui corporate-actions.', tests.testDivTtmGap],
  ['DIV_CASH_PAYOUT', 'dividend', 'Periksa rasio pembayaran kas negatif atau di atas arus kas.', tests.testDivCashPayout],
  ['VAL_PEER_GAP', 'valuation', 'Periksa PE relatif median peer setelah PE negatif dan outlier dibuang.', tests.testValPeerGap],
  ['VAL_OWN_HISTORY', 'valuation', 'Periksa angka lama atau premium terhadap median sejarah emiten sendiri.', tests.testValOwnHistory],
  ['VAL_NEG_PEG', 'valuation', 'Periksa PEG negatif yang tidak mewakili pertumbuhan positif.', tests.testValNegPeg],
  ['PRC_LOW_BASE', 'price_move', 'Periksa rebound dari basis jauh di bawah median harga sejarah.', tests.testPrcLowBase],
  ['PRC_THIN_LIQ', 'price_move', 'Periksa nilai transaksi harian rendah dari volume dikali harga.', tests.testPrcThinLiq],
  ['PRC_WINDOW', 'price_move', 'Periksa sensitivitas persentase perubahan terhadap jendela pembanding.', tests.testPrcWindow],
] as const;

/** Registry terikat tanggal/rentang eksplisit; test tetap sinkron dan tanpa I/O. */
export function createHypothesisRegistry(input: Claim, options: { today: string; priceWindow?: DateWindow }): HypothesisRegistry {
  const claim = ClaimSchema.parse(input);
  const date = new Date(`${options.today}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.today) || !Number.isFinite(date.getTime())
    || date.toISOString().slice(0, 10) !== options.today) throw new Error('Tanggal hunter tidak valid.');
  let priceWindow: DateWindow | undefined;
  if (claim.type === 'price_move' && claim.inScope) {
    const plan = routeClaim(claim, { today: options.today, window: options.priceWindow });
    if (plan.status !== 'ready') throw new Error('Jendela harga perlu diklarifikasi sebelum hunter.');
    priceWindow = { start: plan.tools[0]!.params.start as string, end: plan.tools.at(-1)!.params.end as string };
  }
  // Jendela panjang diverifikasi lewat dua cuplikan; hipotesis harga butuh deret penuh
  // (puluhan kredit), jadi tidak berlaku alih-alih didaftarkan lalu selalu dilewati.
  const longPriceWindow = priceWindow !== undefined && sampledWindows(priceWindow, ENDPOINTS.fetchDailyPrice.maxWindowDays!) !== null;
  const context: tests.HypothesisContext = { today: options.today, priceWindow,
    comparisonWindow: priceWindow ? windowEndingToday(C.PRICE_COMPARISON_DAYS, priceWindow.end) : undefined };
  const report = (sections: string[]): ToolCall => ({ tool: 'fetchCompanyReport', params: { symbol: claim.ticker, sections } });
  const daily = (window: DateWindow): ToolCall[] => splitWindow(window, ENDPOINTS.fetchDailyPrice.maxWindowDays!).map(
    (chunk) => ({ tool: 'fetchDailyPrice', params: { symbol: claim.ticker, ...chunk } }));
  const registry = new Map<string, Hypothesis>();
  // Hipotesis dividen menguji apakah yield tinggi representatif; pengumuman nominal
  // per saham ("Rp87 per saham") tidak diubah maknanya oleh konteks itu.
  const dividendAmount = claim.type === 'dividend' && isDividendAmountClaim(claim);
  for (const [id, claimType, description, test] of definitions) {
    if (claimType !== claim.type || (claimType === 'dividend' && dividendAmount) || (claimType === 'price_move' && longPriceWindow)) continue;
    if (claimType === 'dividend' && /payout|rasio pembayaran|rasio pembagian/i.test(claim.asserted.metric) && id !== 'DIV_CASH_PAYOUT') continue;
    let requiredTools: ToolCall[];
    if (claimType === 'dividend') requiredTools = [report(['dividend']), ...(id === 'DIV_TTM_GAP'
      ? [{ tool: 'fetchCorporateActions', params: { symbol: claim.ticker } }] : [])];
    else if (claimType === 'valuation') requiredTools = [report(id === 'VAL_PEER_GAP' ? ['valuation', 'peers'] : ['valuation'])];
    else if (!priceWindow) requiredTools = [];
    else if (id === 'PRC_LOW_BASE') requiredTools = daily({ start: addDays(priceWindow.start, -C.PRICE_HISTORY_DAYS), end: priceWindow.end });
    else if (id === 'PRC_WINDOW') requiredTools = daily({ start: priceWindow.start < context.comparisonWindow!.start
      ? priceWindow.start : context.comparisonWindow!.start, end: priceWindow.end });
    else requiredTools = daily(priceWindow);
    const hypothesis: Hypothesis = { id, claimType: claimType as ClaimType, description, requiredTools,
      estCredits: requiredTools.reduce((sum, call) => sum + estimateCredits(call.tool as EndpointName, call.params), 0),
      test: (candidate, evidence) => {
        if (candidate.claimId !== claim.claimId || candidate.ticker !== claim.ticker || candidate.type !== claimType || !candidate.inScope)
          throw new Error('Hipotesis dipanggil untuk klaim berbeda atau di luar cakupan.');
        return test(candidate, evidence, context);
      } };
    registry.set(id, HypothesisSchema.parse(hypothesis));
  }
  return registry;
}
