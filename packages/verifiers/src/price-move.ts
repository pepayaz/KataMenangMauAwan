import type { Claim } from '@cek-dulu/shared';
import type { CorporateActions, DailyDataItem } from '@cek-dulu/sectors';
import { isMissingData, parseWindowPhrase, sampledWindows, windowEndingToday, windowLengthDays, type DateWindow } from '@cek-dulu/sectors';
import { ABS_TOLERANCE_PP, describeAbsolute, withinAbsolute } from './tolerance.js';
import { makeEvidence, unverifiable, type Verifier, type VerifierOutput } from './types.js';

/**
 * Tipe 3 — Kenaikan harga. Contoh klaim: "Sebulan naik 80%".
 *
 * Verifikasi (bab 4): hitung perubahan harga pada jendela yang disebut;
 * toleransi ±3 poin persen.
 */

export const PRICE_DEFAULT_WINDOW_DAYS = 30;

export type PriceChange = {
  startDate: string;
  startClose: number;
  endDate: string;
  endClose: number;
  /** Perubahan dalam poin persen, mis. 80 untuk naik 80%. */
  changePct: number;
  /** Harga terendah dan tertinggi di jendela — bahan hipotesis PRC_LOW_BASE. */
  lowClose: number;
  highClose: number;
  /** Rata-rata volume harian; bahan hipotesis PRC_THIN_LIQ. */
  avgVolume: number | null;
  tradingDays: number;
};

/** Menghitung perubahan harga dari deret harian. Murni. */
export function computePriceChange(rows: DailyDataItem[]): PriceChange | null {
  const usable = rows
    .filter((r): r is DailyDataItem & { close: number } => typeof r.close === 'number' && r.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const first = usable[0];
  const last = usable[usable.length - 1];
  if (!first || !last || usable.length < 2) return null;

  const closes = usable.map((r) => r.close);
  const volumes = usable
    .map((r) => r.volume)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  return {
    startDate: first.date,
    startClose: first.close,
    endDate: last.date,
    endClose: last.close,
    changePct: ((last.close - first.close) / first.close) * 100,
    lowClose: Math.min(...closes),
    highClose: Math.max(...closes),
    avgVolume: volumes.length > 0 ? volumes.reduce((s, v) => s + v, 0) / volumes.length : null,
    tradingDays: usable.length,
  };
}

/** Aksi korporasi yang mengubah harga per lembar di dalam jendela. Murni. */
export function splitsInWindow(
  actions: CorporateActions | null,
  window: DateWindow,
): Array<{ date: string; split_ratio: number | null }> {
  const splits = actions?.corporate_actions?.stock_split ?? [];
  return (splits ?? []).filter((s) => s.date >= window.start && s.date <= window.end);
}

export const verifyPriceMove: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = describeAbsolute(ABS_TOLERANCE_PP.price_move);
  if (typeof claim.asserted.value !== 'number' || claim.asserted.unit !== '%') {
    return unverifiable('Klaim kenaikan harga tidak menyebut angka persen.', tol);
  }

  const window = ctx.window ?? windowEndingToday(parseWindowPhrase(claim.asserted.window) ?? PRICE_DEFAULT_WINDOW_DAYS, ctx.today);
  const days = windowLengthDays(window);
  // Jendela panjang: hanya harga awal dan akhir yang dibutuhkan; rendah/tinggi/volume tidak dilaporkan.
  const probes = sampledWindows(window);

  let daily;
  try {
    if (probes) {
      const head = await ctx.client.fetchDailyPrice(claim.ticker, probes[0], { checkId: ctx.checkId });
      const tail = await ctx.client.fetchDailyPrice(claim.ticker, probes[1], { checkId: ctx.checkId });
      daily = { ...tail, params: { symbol: claim.ticker, ...window, sampled: probes }, credits: head.credits + tail.credits,
        cached: head.cached && tail.cached, data: [...head.data, ...tail.data] };
    } else daily = await ctx.client.fetchDailyPrice(claim.ticker, window, { checkId: ctx.checkId });
  } catch (err) {
    if (isMissingData(err)) {
      return unverifiable(`Harga harian ${claim.ticker} tidak tersedia: ${(err as Error).message}`, tol);
    }
    throw err;
  }

  const change = computePriceChange(daily.data);
  if (!change) {
    return unverifiable(
      `Tidak ada cukup hari perdagangan ${claim.ticker} di jendela ${window.start} sampai ${window.end}.`,
      tol,
    );
  }

  // Aksi korporasi bersifat pelengkap: kegagalannya tidak menggagalkan verifikasi.
  let actions: CorporateActions | null = null;
  let actionsResult: Awaited<ReturnType<typeof ctx.client.fetchCorporateActions>> | null = null;
  try {
    actionsResult = await ctx.client.fetchCorporateActions(claim.ticker, { checkId: ctx.checkId });
    actions = actionsResult.data;
  } catch (err) {
    if (!isMissingData(err)) throw err;
  }

  const splits = splitsInWindow(actions, window);

  const evidence = [
    makeEvidence(
      claim.claimId,
      daily,
      `Perubahan harga ${claim.ticker} ${window.start} s.d. ${window.end}`,
      round2(change.changePct),
      '%',
    ),
    makeEvidence(claim.claimId, daily, `Harga ${claim.ticker} ${change.startDate}`, change.startClose, 'IDR'),
    makeEvidence(claim.claimId, daily, `Harga ${claim.ticker} ${change.endDate}`, change.endClose, 'IDR'),
    ...(probes ? [] : [
      makeEvidence(claim.claimId, daily, `Harga terendah ${claim.ticker} di jendela`, change.lowClose, 'IDR'),
      makeEvidence(claim.claimId, daily, `Harga tertinggi ${claim.ticker} di jendela`, change.highClose, 'IDR'),
    ]),
  ];

  if (change.avgVolume !== null && !probes) {
    evidence.push(
      makeEvidence(
        claim.claimId,
        daily,
        `Rata-rata volume harian ${claim.ticker}`,
        Math.round(change.avgVolume),
        'shares',
      ),
    );
  }
  if (actionsResult && splits.length > 0) {
    for (const s of splits) {
      evidence.push(
        makeEvidence(
          claim.claimId,
          actionsResult,
          `Stock split ${claim.ticker} ${s.date}`,
          s.split_ratio ?? 'tidak diketahui',
          'x',
        ),
      );
    }
  }

  const matches = withinAbsolute(claim.asserted.value, change.changePct, ABS_TOLERANCE_PP.price_move);
  const primary = evidence[0]!;

  return {
    evidence,
    computed: { value: round2(change.changePct), unit: '%', evidenceId: primary.evidenceId },
    matches,
    tolerance: tol,
    note:
      `${claim.ticker} bergerak ${fmtSigned(change.changePct)}% dari ${change.startDate} ` +
      `(${change.startClose}) ke ${change.endDate} (${change.endClose}).` +
      (matches ? '' : ` Klaim menyebut ${fmtSigned(claim.asserted.value)}%.`) +
      (splits.length > 0 ? ` Ada ${splits.length} stock split di jendela ini.` : ''),
    details: {
      windowDays: days,
      window,
      // Cuplikan hanya mewakili awal dan akhir jendela; rendah/tinggi/volume tidak berlaku.
      ...(probes ? { sampled: probes } : {
        lowClose: change.lowClose,
        highClose: change.highClose,
        avgVolume: change.avgVolume,
        tradingDays: change.tradingDays,
      }),
      splits,
    },
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtSigned(n: number): string {
  const s = round2(n).toString().replace('.', ',');
  return n > 0 ? `+${s}` : s;
}
