import type { Claim } from '@cek-dulu/shared';
import type { ForeignFlowItem } from '@cek-dulu/sectors';
import {
  isMissingData,
  parseWindowPhrase,
  windowEndingToday,
  type DateWindow,
} from '@cek-dulu/sectors';
import { FLOW_TOLERANCE } from './tolerance.js';
import { makeEvidence, unverifiable, type Verifier, type VerifierOutput } from './types.js';

/**
 * Tipe 5 — Arus asing. Contoh klaim: "Asing lagi borong".
 *
 * Verifikasi (bab 4): jumlahkan net foreign inflow pada jendela yang disebut
 * atau 5/20/60 hari. Batas endpoint 90 hari per panggilan sudah ditangani klien.
 *
 * Kebanyakan klaim tipe ini tidak menyebut angka, hanya arah. Untuk klaim arah,
 * yang dinilai adalah tandanya; toleransi besaran hanya berlaku bila klaim
 * menyebut nilai rupiah.
 */

export const STANDARD_WINDOWS = [5, 20, 60] as const;
export const FLOW_DEFAULT_WINDOW_DAYS = 20;
export const FLOW_MAX_WINDOW_DAYS = 90;

export type FlowSummary = {
  net: number;
  buy: number;
  sell: number;
  days: number;
  positiveDays: number;
  negativeDays: number;
};

/** Menjumlahkan arus asing pada sederet hari. Murni. */
export function summarizeFlow(rows: ForeignFlowItem[]): FlowSummary {
  let net = 0;
  let buy = 0;
  let sell = 0;
  let positiveDays = 0;
  let negativeDays = 0;

  for (const row of rows) {
    const n = row.net_foreign_inflow;
    if (typeof n === 'number' && Number.isFinite(n)) {
      net += n;
      if (n > 0) positiveDays += 1;
      else if (n < 0) negativeDays += 1;
    }
    if (typeof row.foreign_buy_idr === 'number') buy += row.foreign_buy_idr;
    if (typeof row.foreign_sell_idr === 'number') sell += row.foreign_sell_idr;
  }

  return { net, buy, sell, days: rows.length, positiveDays, negativeDays };
}

/** Membatasi deret ke `days` hari perdagangan terakhir. Murni. */
export function lastNTradingDays(rows: ForeignFlowItem[], days: number): ForeignFlowItem[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
}

/**
 * Ringkasan untuk jendela 5/20/60 hari sekaligus. Murni.
 *
 * Bahan hipotesis FGN_WINDOW: jendela lain yang berlawanan arah adalah tanda
 * angka yang benar tetapi dipilih.
 */
export function summarizeStandardWindows(rows: ForeignFlowItem[]): Record<number, FlowSummary> {
  const out: Record<number, FlowSummary> = {};
  for (const d of STANDARD_WINDOWS) out[d] = summarizeFlow(lastNTradingDays(rows, d));
  return out;
}

export const verifyForeignFlow: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const claimedDays = parseWindowPhrase(claim.asserted.window);
  const days = Math.min(claimedDays ?? FLOW_DEFAULT_WINDOW_DAYS, FLOW_MAX_WINDOW_DAYS);
  const window: DateWindow = windowEndingToday(days, ctx.today);
  const tol =
    typeof claim.asserted.value === 'number'
      ? `±${Math.round(FLOW_TOLERANCE * 100)}% dari nilai resmi`
      : 'arah arus (beli bersih atau jual bersih)';

  let flow;
  try {
    flow = await ctx.client.fetchForeignFlow(claim.ticker, window, { checkId: ctx.checkId });
  } catch (err) {
    if (isMissingData(err)) {
      return unverifiable(`Arus asing ${claim.ticker} tidak tersedia: ${(err as Error).message}`, tol);
    }
    throw err;
  }

  const rows = flow.data.data ?? [];
  if (rows.length === 0) {
    return unverifiable(
      `Tidak ada data arus asing ${claim.ticker} untuk ${window.start} sampai ${window.end}.`,
      tol,
    );
  }

  const summary = summarizeFlow(rows);
  const byWindow = summarizeStandardWindows(rows);

  const evidence = [
    makeEvidence(
      claim.claimId,
      flow,
      `Net arus asing ${claim.ticker} ${days} hari`,
      Math.round(summary.net),
      'IDR',
    ),
    makeEvidence(claim.claimId, flow, `Beli asing ${claim.ticker} ${days} hari`, Math.round(summary.buy), 'IDR'),
    makeEvidence(claim.claimId, flow, `Jual asing ${claim.ticker} ${days} hari`, Math.round(summary.sell), 'IDR'),
    makeEvidence(
      claim.claimId,
      flow,
      `Hari beli bersih ${claim.ticker}`,
      `${summary.positiveDays} dari ${summary.days}`,
    ),
  ];

  for (const d of STANDARD_WINDOWS) {
    if (d === days) continue;
    const s = byWindow[d];
    if (!s || s.days === 0) continue;
    evidence.push(
      makeEvidence(claim.claimId, flow, `Net arus asing ${claim.ticker} ${d} hari`, Math.round(s.net), 'IDR'),
    );
  }

  const primary = evidence[0]!;
  const direction = flowDirection(claim.asserted.metric);
  const claimedInflow = direction !== 'out';

  let matches: boolean | null;
  if (typeof claim.asserted.value === 'number') {
    const claimedValue = claim.asserted.value;
    matches =
      Math.sign(claimedValue) === Math.sign(summary.net) &&
      Math.abs(Math.abs(claimedValue) - Math.abs(summary.net)) <=
        FLOW_TOLERANCE * Math.abs(summary.net);
  } else if (direction === null) {
    // Tanpa arah, tidak ada yang bisa dibandingkan; jangan anggap beli.
    matches = null;
  } else {
    matches = claimedInflow ? summary.net > 0 : summary.net < 0;
  }

  const arah = summary.net > 0 ? 'beli bersih' : summary.net < 0 ? 'jual bersih' : 'netral';

  return {
    evidence,
    computed: { value: Math.round(summary.net), unit: 'IDR', evidenceId: primary.evidenceId },
    matches,
    tolerance: tol,
    note:
      `Dalam ${days} hari terakhir asing ${arah} ${formatIdr(summary.net)} di ${claim.ticker} ` +
      `(${summary.positiveDays} dari ${summary.days} hari beli bersih).`,
    details: {
      windowDays: days,
      window,
      summary,
      byWindow,
      claimedInflow,
    },
  };
};

const OUTFLOW_WORDS = /\b(jual|jualan|menjual|kabur|keluar|outflow|buang|distribusi|lepas|net sell|guyur)\b/i;
const INFLOW_WORDS = /\b(beli|membeli|borong|memborong|masuk|inflow|akumulasi|serok|koleksi|tampung|net buy)\b/i;

/** Arah yang dinyatakan klaim; null bila tidak disebut atau bertentangan. Murni. */
export function flowDirection(text: string): 'in' | 'out' | null {
  const out = OUTFLOW_WORDS.test(text), inflow = INFLOW_WORDS.test(text);
  return out === inflow ? null : out ? 'out' : 'in';
}

/** "Borong", "akumulasi", "masuk" berarti arus masuk; "kabur", "jualan" arus keluar. */
export function isInflowClaim(metric: string): boolean {
  return flowDirection(metric) !== 'out';
}

function formatIdr(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}Rp${(abs / 1e12).toFixed(2).replace('.', ',')} triliun`;
  if (abs >= 1e9) return `${sign}Rp${(abs / 1e9).toFixed(2).replace('.', ',')} miliar`;
  if (abs >= 1e6) return `${sign}Rp${(abs / 1e6).toFixed(2).replace('.', ',')} juta`;
  return `${sign}Rp${Math.round(abs)}`;
}
