import type { Claim } from '@cek-dulu/shared';
import type { BrokerSummaryResponse, ShareholderSnapshot, ShareholdersComposition } from '@cek-dulu/sectors';
import { isMissingData, windowEndingToday } from '@cek-dulu/sectors';
import { makeEvidence, unverifiable, type Verifier, type VerifierOutput } from './types.js';

/**
 * Tipe 6 — Akumulasi institusi atau bandar. Contoh klaim: "Lagi dikoleksi institusi".
 *
 * Verifikasi (bab 4): periksa perubahan kategori institusi dan konsentrasi
 * broker pembeli. Jendela broker summary maksimal 14 hari per panggilan.
 */

export const BROKER_WINDOW_DAYS = 14;

/**
 * Kategori pemegang saham yang dihitung sebagai institusi.
 * `individual` sengaja di luar daftar — justru itu pembandingnya.
 * Sufiks `_l` (lokal) dan `_f` (asing) ditambahkan saat penjumlahan.
 */
export const INSTITUTIONAL_CATEGORIES = [
  'insurance',
  'corporate',
  'pension_fund',
  'financial_institutions',
  'mutual_fund',
  'securities_companies',
  'foundation',
] as const;

export type OwnershipSplit = {
  date: string;
  institutional: number;
  individual: number;
  total: number;
  institutionalShare: number;
};

/** Memecah satu snapshot komposisi menjadi institusi versus individu. Murni. */
export function splitOwnership(snapshot: ShareholderSnapshot): OwnershipSplit {
  let institutional = 0;
  for (const cat of INSTITUTIONAL_CATEGORIES) {
    for (const suffix of ['_l', '_f'] as const) {
      const v = snapshot[`${cat}${suffix}`];
      if (typeof v === 'number' && Number.isFinite(v)) institutional += v;
    }
  }
  let individual = 0;
  for (const suffix of ['_l', '_f'] as const) {
    const v = snapshot[`individual${suffix}`];
    if (typeof v === 'number' && Number.isFinite(v)) individual += v;
  }
  const total = institutional + individual;
  return {
    date: snapshot.date,
    institutional,
    individual,
    total,
    institutionalShare: total > 0 ? institutional / total : 0,
  };
}

export type OwnershipChange = {
  first: OwnershipSplit;
  last: OwnershipSplit;
  /** Perubahan porsi institusi dalam poin persen. */
  institutionalSharePp: number;
  institutionalDelta: number;
  individualDelta: number;
};

/** Perubahan komposisi antara snapshot terlama dan terbaru. Murni. */
export function computeOwnershipChange(
  composition: ShareholdersComposition,
): OwnershipChange | null {
  const snapshots = [...(composition.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  if (!first || !last || first.date === last.date) return null;

  const a = splitOwnership(first);
  const b = splitOwnership(last);
  return {
    first: a,
    last: b,
    institutionalSharePp: (b.institutionalShare - a.institutionalShare) * 100,
    institutionalDelta: b.institutional - a.institutional,
    individualDelta: b.individual - a.individual,
  };
}

export type BrokerConcentration = {
  totalNetBuy: number;
  topBrokers: Array<{ broker: string; net: number; share: number }>;
  /** Porsi pembelian bersih yang dipegang dua broker teratas. */
  top2Share: number;
};

/**
 * Konsentrasi broker pembeli pada jendela. Murni.
 *
 * Nilai bersih per broker dijumlahkan lintas hari lebih dulu; broker yang beli
 * lalu jual di hari berbeda tidak boleh terhitung sebagai akumulasi.
 */
export function computeBrokerConcentration(
  response: BrokerSummaryResponse,
  topN = 5,
): BrokerConcentration {
  const netByBroker = new Map<string, number>();
  for (const day of response.data ?? []) {
    for (const row of day.summary ?? []) {
      const net = typeof row.nval === 'number' && Number.isFinite(row.nval) ? row.nval : 0;
      netByBroker.set(row.broker_code, (netByBroker.get(row.broker_code) ?? 0) + net);
    }
  }

  const buyers = [...netByBroker.entries()]
    .filter(([, net]) => net > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalNetBuy = buyers.reduce((s, [, net]) => s + net, 0);

  const topBrokers = buyers.slice(0, topN).map(([broker, net]) => ({
    broker,
    net,
    share: totalNetBuy > 0 ? net / totalNetBuy : 0,
  }));

  const top2Share = topBrokers.slice(0, 2).reduce((s, b) => s + b.share, 0);
  return { totalNetBuy, topBrokers, top2Share };
}

export const verifyAccumulation: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = 'perubahan porsi institusi dan konsentrasi broker pembeli';
  const window = windowEndingToday(BROKER_WINDOW_DAYS, ctx.today);
  const year = Number(ctx.today.slice(0, 4));

  let broker;
  try {
    broker = await ctx.client.fetchBrokerSummary(claim.ticker, window, { checkId: ctx.checkId });
  } catch (err) {
    if (isMissingData(err)) {
      return unverifiable(`Broker summary ${claim.ticker} tidak tersedia: ${(err as Error).message}`, tol);
    }
    throw err;
  }

  // Komposisi pemegang saham bersifat pelengkap; snapshotnya bulanan dan bisa kosong.
  let composition = null;
  let compositionResult: Awaited<
    ReturnType<typeof ctx.client.fetchShareholdersComposition>
  > | null = null;
  try {
    compositionResult = await ctx.client.fetchShareholdersComposition(claim.ticker, year, {
      checkId: ctx.checkId,
    });
    composition = computeOwnershipChange(compositionResult.data);
  } catch (err) {
    if (!isMissingData(err)) throw err;
  }

  const concentration = computeBrokerConcentration(broker.data);
  const evidence = [
    makeEvidence(
      claim.claimId,
      broker,
      `Total beli bersih broker ${claim.ticker} ${BROKER_WINDOW_DAYS} hari`,
      Math.round(concentration.totalNetBuy),
      'IDR',
    ),
  ];

  for (const b of concentration.topBrokers.slice(0, 3)) {
    evidence.push(
      makeEvidence(
        claim.claimId,
        broker,
        `Beli bersih broker ${b.broker} di ${claim.ticker}`,
        Math.round(b.net),
        'IDR',
      ),
    );
  }

  if (compositionResult && composition) {
    evidence.push(
      makeEvidence(
        claim.claimId,
        compositionResult,
        `Porsi institusi ${claim.ticker} ${composition.last.date}`,
        round2(composition.last.institutionalShare * 100),
        '%',
      ),
      makeEvidence(
        claim.claimId,
        compositionResult,
        `Perubahan porsi institusi ${claim.ticker} sejak ${composition.first.date}`,
        round2(composition.institutionalSharePp),
        '%',
      ),
    );
  }

  const primary = evidence[0]!;

  // Institusi dianggap benar-benar menambah bila porsinya naik. Tanpa data
  // komposisi, jatuh ke tanda beli bersih broker sebagai indikasi lemah.
  const institutionalRising =
    composition !== null ? composition.institutionalSharePp > 0 : concentration.totalNetBuy > 0;

  const notes: string[] = [];
  if (composition) {
    notes.push(
      composition.institutionalSharePp > 0
        ? `Porsi institusi ${claim.ticker} naik ${round2(composition.institutionalSharePp)} poin persen ` +
          `sejak ${composition.first.date} menjadi ${round2(composition.last.institutionalShare * 100)}%.`
        : `Porsi institusi ${claim.ticker} justru turun ${round2(Math.abs(composition.institutionalSharePp))} ` +
          `poin persen sejak ${composition.first.date}; yang bertambah adalah individu.`,
    );
  } else {
    notes.push(`Komposisi pemegang saham ${claim.ticker} tahun ${year} tidak tersedia.`);
  }

  if (concentration.topBrokers.length > 0) {
    notes.push(
      `Pembelian ${BROKER_WINDOW_DAYS} hari terakhir terkonsentrasi ${Math.round(concentration.top2Share * 100)}% ` +
        `di dua broker teratas (${concentration.topBrokers.slice(0, 2).map((b) => b.broker).join(', ')}).`,
    );
  }

  return {
    evidence,
    computed: composition
      ? {
          value: round2(composition.institutionalSharePp),
          unit: '%',
          evidenceId: evidence[evidence.length - 1]!.evidenceId,
        }
      : { value: Math.round(concentration.totalNetBuy), unit: 'IDR', evidenceId: primary.evidenceId },
    matches: institutionalRising,
    tolerance: tol,
    note: notes.join(' '),
    details: { concentration, composition, window },
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
