import type { Claim, Evidence, HypothesisResult } from '@cek-dulu/shared';
import { addDays, type DateWindow } from '@cek-dulu/sectors';
import { evidenceMeta, hunterEvidence } from './evidence.js';
import * as C from './constants.js';

export type HypothesisContext = { today: string; priceWindow?: DateWindow; comparisonWindow?: DateWindow };
const numeric = (items: Evidence[]): Array<Evidence & { value: number }> => items.filter(
  (e): e is Evidence & { value: number } => typeof e.value === 'number' && Number.isFinite(e.value));
const get = (claim: Claim, evidence: Evidence[], metric: string) => numeric(hunterEvidence(evidence, claim, metric));
const result = (id: string, claim: Claim, triggered: boolean, strong: boolean, refs: Evidence[], note: string): HypothesisResult => ({
  hypId: id, claimId: claim.claimId, triggered, strength: strong && triggered ? 'strong' : 'weak',
  evidenceIds: [...new Set(refs.map((e) => e.evidenceId))], note });
const absent = (id: string, claim: Claim) => result(id, claim, false, false, [], 'Data belum cukup untuk menguji hipotesis.');
export function median(values: readonly number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : sorted[middle - 1]! / 2 + sorted[middle]! / 2;
}
const matches = (value: number, asserted: number) => Math.abs(value - asserted) <= Math.abs(value) * C.ASSERTED_RELATIVE_TOLERANCE;

export function testDivOneOff(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'DIV_ONE_OFF';
  const payments = get(claim, evidence, 'dividend.payment').filter((e) => e.value > 0 && evidenceMeta(e).date! <= context.today);
  const totals = get(claim, evidence, 'dividend.total').filter((e) => e.value > 0);
  const explicitYear = claim.asserted.period && /\b(\d{4})\b/.exec(claim.asserted.period)?.[1];
  const years = [...new Set(totals.map((e) => evidenceMeta(e).year!))].sort((a, b) => b - a).slice(0, C.DIV_REVIEW_YEARS);
  let weak: HypothesisResult | undefined;
  for (const year of years) {
    if (explicitYear && year !== Number(explicitYear)) continue;
    const total = totals.find((e) => evidenceMeta(e).year === year)!;
    const rows = payments.filter((e) => evidenceMeta(e).year === year);
    const largest = [...rows].sort((a, b) => b.value - a.value)[0];
    if (!largest || largest.value > total.value) continue;
    if (largest.value / total.value > C.DIV_ONE_OFF_SHARE) {
      const strong = rows.length >= C.DIV_MIN_PAYMENTS_FOR_STRONG
        && Math.abs(rows.reduce((sum, e) => sum + e.value, 0) - total.value) <= total.value * C.ASSERTED_RELATIVE_TOLERANCE;
      const found = result(id, claim, true, strong, [total, ...rows], strong
        ? 'Satu pembayaran mendominasi total dividen periode tahunan; tidak mewakili pola pembayaran merata.'
        : 'Satu pembayaran dominan, tetapi data pembayaran belum cukup untuk membedakan dividen rutin dan khusus.');
      if (strong) return found;
      weak = found;
    }
  }
  return weak ?? result(id, claim, false, false, [...totals, ...payments], totals.length
    ? 'Tidak ada pembayaran yang mendominasi periode yang diperiksa.' : 'Total dividen periode belum tersedia.');
}

export function testDivTtmGap(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'DIV_TTM_GAP', avg = get(claim, evidence, 'dividend.avg_yield')[0], ttm = get(claim, evidence, 'dividend.yield_ttm')[0];
  if (!avg || !ttm || avg.value <= 0 || ttm.value < 0 || claim.asserted.value === undefined) return absent(id, claim);
  const asserted = claim.asserted.unit === '%' ? claim.asserted.value / 100 : claim.asserted.value;
  if (!matches(avg.value, asserted) || /\bttm\b/i.test(claim.asserted.metric)
    || (claim.asserted.period && /\b\d{4}\b/.test(claim.asserted.period))) {
    return result(id, claim, false, false, [avg, ttm], 'Klaim tidak merujuk rata-rata historis sebagai yield terkini.');
  }
  const gap = (avg.value - ttm.value) / avg.value > C.DIV_TTM_RELATIVE_GAP;
  const year = Number(context.today.slice(0, 4));
  const report = hunterEvidence(evidence, claim, 'dividend.year_coverage').filter((e) => evidenceMeta(e).year === year);
  const actions = hunterEvidence(evidence, claim, 'dividend.actions_coverage').filter((e) => evidenceMeta(e).year === year);
  const refs = [avg, ttm, ...report, ...actions];
  const available = [...report, ...actions].some((e) => e.value === 'available');
  const checked = report.length > 0 && actions.some((e) => e.value === 'available' || e.value === 'empty');
  if (!gap) return result(id, claim, false, false, refs, 'Yield TTM tidak jauh lebih rendah dari rata-rata historis.'
    + (!available && report.length ? ' data tahun ini belum tersedia.' : ''));
  if (!report.length && !actions.length) return result(id, claim, true, false, refs, 'Kelengkapan data tahun berjalan belum diperiksa.');
  if (!available) return result(id, claim, true, false, refs, 'data tahun ini belum tersedia; selisih TTM belum membuktikan penurunan dividen rutin.');
  if (!report.some((e) => e.value === 'available')) return result(id, claim, true, false, refs,
    'Pembayaran tahun ini tercatat di corporate-actions, tetapi laporan dividen belum lengkap; selisih TTM perlu dikonfirmasi.');
  if (!checked) return result(id, claim, true, false, refs, 'Selisih TTM terdeteksi; kelengkapan corporate-actions belum dapat dikonfirmasi.');
  return result(id, claim, true, true, refs, 'Rata-rata historis jauh di atas yield TTM, sementara data tahun berjalan sudah tersedia.');
}

export function testDivCashPayout(claim: Claim, evidence: Evidence[]): HypothesisResult {
  const id = 'DIV_CASH_PAYOUT', cash = get(claim, evidence, 'dividend.cash_payout_ratio')[0];
  if (!cash) return absent(id, claim);
  const triggered = cash.value < 0 || cash.value > C.CASH_PAYOUT_MAX;
  return result(id, claim, triggered, true, [cash], triggered
    ? 'Rasio pembayaran kas negatif atau melebihi arus kas; konteks kemampuan pembayaran perlu diperiksa.'
    : 'Rasio pembayaran kas tidak melewati ambang konteks.');
}

function valuationMetric(claim: Claim): 'pe' | 'pb' | null {
  if (/\b(pbv?|p\/b|price[ -]to[ -]book)\b/i.test(claim.asserted.metric)) return 'pb';
  return /\b(per|pe|p\/e|price[ -]to[ -]earnings)\b/i.test(claim.asserted.metric) ? 'pe' : null;
}
function valuationRows(claim: Claim, evidence: Evidence[], metric: string, context: HypothesisContext) {
  return get(claim, evidence, `valuation.${metric}`).filter((e) => evidenceMeta(e).year! <= Number(context.today.slice(0, 4)))
    .sort((a, b) => evidenceMeta(b).year! - evidenceMeta(a).year!);
}
function isLatestYear(current: Evidence | undefined, claim: Claim, evidence: Evidence[], context: HypothesisContext): boolean {
  const years = get(claim, evidence, 'valuation.year').map((e) => e.value)
    .filter((year) => year <= Number(context.today.slice(0, 4)));
  return !!current && years.length > 0 && evidenceMeta(current).year === Math.max(...years);
}

export function testValPeerGap(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'VAL_PEER_GAP';
  if (valuationMetric(claim) !== 'pe') return absent(id, claim);
  const current = valuationRows(claim, evidence, 'pe', context)[0];
  const peers = get(claim, evidence, 'peer.pe').filter((e) => e.value > 0 && e.value <= C.PEER_MAX_PE && evidenceMeta(e).peer !== claim.ticker);
  const unique = [...new Map(peers.map((e) => [evidenceMeta(e).peer, e])).values()];
  const initialMedian = median(unique.map((e) => e.value));
  if (!current || !isLatestYear(current, claim, evidence, context) || current.value <= 0 || !initialMedian) return absent(id, claim);
  const kept = unique.filter((e) => e.value <= initialMedian * C.PEER_OUTLIER_MEDIAN_MULTIPLE);
  const peerMedian = median(kept.map((e) => e.value));
  if (kept.length < C.PEER_MIN_COUNT || !peerMedian) return absent(id, claim);
  const triggered = current.value > peerMedian * (1 + C.VAL_PEER_PREMIUM);
  return result(id, claim, triggered, true, [current, ...kept], triggered
    ? 'PE emiten lebih tinggi dari median peer setelah PE negatif dan outlier dibuang; angka rendah absolut belum berarti murah relatif.'
    : 'PE emiten tidak memiliki premium material terhadap median peer yang valid.');
}

export function testValOwnHistory(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'VAL_OWN_HISTORY', metric = valuationMetric(claim);
  if (!metric) return absent(id, claim);
  const rows = valuationRows(claim, evidence, metric, context).filter((e) => e.value > 0);
  const unique = [...new Map(rows.map((e) => [evidenceMeta(e).year, e])).values()];
  const current = unique[0], history = unique.slice(1);
  if (!current || !isLatestYear(current, claim, evidence, context) || claim.asserted.value === undefined) return absent(id, claim);
  const oldMatch = history.find((e) => matches(e.value, claim.asserted.value!));
  if (!matches(current.value, claim.asserted.value) && oldMatch && !claim.asserted.period) return result(id, claim,
    true, true, [current, oldMatch], 'Angka klaim cocok dengan valuasi lama, bukan valuasi terbaru.');
  const ownMedian = median(history.map((e) => e.value));
  if (history.length < C.VAL_HISTORY_MIN_YEARS || !ownMedian) return absent(id, claim);
  const triggered = !claim.asserted.period && current.value > ownMedian * (1 + C.VAL_HISTORY_PREMIUM);
  return result(id, claim, triggered, true, [current, ...history], triggered
    ? 'Valuasi terbaru lebih tinggi dari median sejarah emiten sendiri.' : 'Tidak ada premium material terhadap sejarah emiten sendiri.');
}

export function testValNegPeg(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'VAL_NEG_PEG', peg = valuationRows(claim, evidence, 'peg', context)[0];
  if (!peg || !isLatestYear(peg, claim, evidence, context)) return absent(id, claim);
  const triggered = peg.value < C.PEG_NEGATIVE_BOUNDARY;
  return result(id, claim, triggered, true, [peg], triggered
    ? 'PEG negatif tidak mendukung interpretasi pertumbuhan laba positif.' : 'PEG tidak negatif.');
}

type PriceRow = { date: string; close: Evidence & { value: number }; volume?: Evidence & { value: number } };
function prices(claim: Claim, evidence: Evidence[], context: HypothesisContext): PriceRow[] {
  const volumes = new Map(get(claim, evidence, 'daily.volume').map((e) => [evidenceMeta(e).date, e]));
  const closes = new Map(get(claim, evidence, 'daily.close').filter((e) => e.value > 0
    && evidenceMeta(e).date! <= context.today).map((e) => [evidenceMeta(e).date!, e]));
  return [...closes].sort(([a], [b]) => a.localeCompare(b)).map(([date, close]) => ({ date, close, volume: volumes.get(date) }));
}
const within = (rows: PriceRow[], window: DateWindow) => rows.filter((r) => r.date >= window.start && r.date <= window.end);
const change = (rows: PriceRow[]) => (rows.at(-1)!.close.value - rows[0]!.close.value) / rows[0]!.close.value;

export function testPrcLowBase(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'PRC_LOW_BASE';
  if (!context.priceWindow) return absent(id, claim);
  const rows = prices(claim, evidence, context), current = within(rows, context.priceWindow);
  const history = rows.filter((r) => r.date < context.priceWindow!.start
    && r.date >= addDays(context.priceWindow!.start, -C.PRICE_HISTORY_DAYS));
  const baseMedian = median(history.map((r) => r.close.value));
  if (current.length < C.PRICE_WINDOW_MIN_OBSERVATIONS || history.length < C.PRICE_HISTORY_MIN_OBSERVATIONS || !baseMedian) return absent(id, claim);
  const triggered = current[0]!.close.value <= baseMedian * C.PRICE_LOW_BASE_RATIO && change(current) >= C.PRICE_REBOUND_MIN;
  return result(id, claim, triggered, true, [...history, ...current].map((r) => r.close), triggered
    ? 'Kenaikan berawal dari harga jauh di bawah median sejarah; basis rendah memperbesar persentase rebound.' : 'Basis awal tidak memenuhi kriteria rebound dari basis rendah.');
}

export function testPrcThinLiq(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'PRC_THIN_LIQ';
  if (!context.priceWindow) return absent(id, claim);
  const rows = within(prices(claim, evidence, context), context.priceWindow).filter((r) => r.volume && r.volume.value >= 0);
  if (rows.length < C.LIQUIDITY_MIN_OBSERVATIONS || rows.every((r) => r.volume!.value === 0)) return absent(id, claim);
  const averageTransaction = rows.reduce((sum, r) => sum + r.close.value * r.volume!.value, 0) / rows.length;
  if (!Number.isFinite(averageTransaction)) return absent(id, claim);
  const triggered = averageTransaction < C.THIN_LIQUIDITY_IDR;
  return result(id, claim, triggered, true, rows.flatMap((r) => [r.close, r.volume!]), triggered
    ? 'Rata-rata nilai transaksi harian rendah; dihitung dari volume dikali harga pada tanggal yang sama.' : 'Rata-rata nilai transaksi harian tidak berada di bawah ambang likuiditas tipis.');
}

export function testPrcWindow(claim: Claim, evidence: Evidence[], context: HypothesisContext): HypothesisResult {
  const id = 'PRC_WINDOW';
  if (!context.priceWindow || !context.comparisonWindow || context.priceWindow.start === context.comparisonWindow.start) return absent(id, claim);
  const rows = prices(claim, evidence, context), current = within(rows, context.priceWindow), other = within(rows, context.comparisonWindow);
  if (current.length < C.PRICE_WINDOW_MIN_OBSERVATIONS || other.length < C.PRICE_HISTORY_MIN_OBSERVATIONS
    || current[0]!.date === other[0]!.date) return absent(id, claim);
  const triggered = Math.abs(change(current) - change(other)) >= C.PRICE_WINDOW_GAP;
  return result(id, claim, triggered, true, [current[0]!.close, current.at(-1)!.close, other[0]!.close, other.at(-1)!.close], triggered
    ? 'Persentase perubahan berbeda material pada jendela pembanding; pemilihan jendela mengubah konteks.' : 'Jendela pembanding tidak mengubah persentase secara material.');
}
