import type { Claim } from '@cek-dulu/shared';
import { normalizeTicker } from '@cek-dulu/shared';
import type {
  CorporateActions,
  FreeFloatItem,
  OverviewSection,
  SuspensionItem,
} from '@cek-dulu/sectors';
import { isMissingData } from '@cek-dulu/sectors';
import { makeEvidence, unverifiable, type Verifier, type VerifierOutput } from './types.js';

/**
 * Tipe 7 — Keamanan dan aksi korporasi. Contoh klaim: "Aman kok, perusahaan gede".
 *
 * Klaim tipe ini kualitatif, jadi yang diperiksa adalah sinyal risiko yang bisa
 * diukur (bab 4). Verifier tidak menilai "aman" atau "tidak aman" — ia
 * mengumpulkan sinyal, dan `matches: false` berarti "ada sinyal risiko yang
 * bertentangan dengan klaim menenangkan", bukan rekomendasi apa pun.
 */

/** Aturan BEI: free float minimal 15%. Per 31 Mei 2026, 327 emiten belum patuh. */
export const FREE_FLOAT_RULE = 0.15;
export const SUSPENSION_LOOKBACK_DAYS = 730;

export type RiskSignal = {
  id: 'SUSPENSION' | 'DILUTION' | 'LOW_FREE_FLOAT' | 'SMALL_CAP';
  summary: string;
  value: number | string;
  unit?: string;
};

export type SafetyAssessment = {
  signals: RiskSignal[];
  suspensionCount: number;
  freeFloat: number | null;
  marketCapRank: number | null;
};

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

/** Mengumpulkan sinyal risiko yang bisa diukur. Murni. */
export function assessRiskSignals(input: {
  suspensions: SuspensionItem[];
  actions: CorporateActions | null;
  freeFloat: number | null;
  overview: OverviewSection | null;
  today: string;
}): SafetyAssessment {
  const { suspensions, actions, freeFloat, overview, today } = input;
  const signals: RiskSignal[] = [];

  const recent = suspensions.filter(
    (s) => daysBetween(s.suspension_date, today) <= SUSPENSION_LOOKBACK_DAYS,
  );
  if (recent.length > 0) {
    const latest = [...recent].sort((a, b) => b.suspension_date.localeCompare(a.suspension_date))[0]!;
    signals.push({
      id: 'SUSPENSION',
      summary: `Pernah disuspensi ${recent.length} kali dalam dua tahun terakhir, terakhir ${latest.suspension_date}.`,
      value: recent.length,
    });
  }

  const rights = actions?.corporate_actions?.right_issue ?? [];
  const warrants = actions?.corporate_actions?.warrant ?? [];
  const dilutionCount = (rights?.length ?? 0) + (warrants?.length ?? 0);
  if (dilutionCount > 0) {
    signals.push({
      id: 'DILUTION',
      summary: `Ada ${rights?.length ?? 0} rights issue dan ${warrants?.length ?? 0} waran dalam riwayat aksi korporasi.`,
      value: dilutionCount,
    });
  }

  if (freeFloat !== null && freeFloat < FREE_FLOAT_RULE) {
    signals.push({
      id: 'LOW_FREE_FLOAT',
      summary: `Free float ${(freeFloat * 100).toFixed(1).replace('.', ',')}%, di bawah aturan BEI 15%.`,
      value: freeFloat,
      unit: '%',
    });
  }

  const rank = overview?.market_cap_rank ?? null;
  if (rank !== null && rank > 100) {
    signals.push({
      id: 'SMALL_CAP',
      summary: `Peringkat kapitalisasi pasar ke-${rank}, di luar 100 besar IDX.`,
      value: rank,
    });
  }

  return {
    signals,
    suspensionCount: recent.length,
    freeFloat,
    marketCapRank: rank,
  };
}

/** Slug sektor untuk parameter free-float: "Financials" -> "financials". */
export function toSectorSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function findFreeFloat(list: FreeFloatItem[], ticker: string): number | null {
  const target = normalizeTicker(ticker);
  const hit = list.find((row) => normalizeTicker(row.symbol) === target);
  return typeof hit?.free_float === 'number' ? hit.free_float : null;
}

export const verifySafety: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = 'sinyal risiko terukur: suspensi, dilusi, free float, dan ukuran kapitalisasi';

  let report;
  try {
    report = await ctx.client.fetchCompanyReport(claim.ticker, ['overview'], {
      checkId: ctx.checkId,
    });
  } catch (err) {
    if (isMissingData(err)) {
      return unverifiable(`Profil ${claim.ticker} tidak tersedia: ${(err as Error).message}`, tol);
    }
    throw err;
  }
  const overview = report.data.overview ?? null;

  let suspensionsResult = null;
  let suspensions: SuspensionItem[] = [];
  try {
    suspensionsResult = await ctx.client.fetchSuspensions(
      { symbol: claim.ticker },
      { checkId: ctx.checkId },
    );
    suspensions = suspensionsResult.data.results ?? [];
  } catch (err) {
    if (!isMissingData(err)) throw err;
  }

  let actionsResult = null;
  let actions: CorporateActions | null = null;
  try {
    actionsResult = await ctx.client.fetchCorporateActions(claim.ticker, { checkId: ctx.checkId });
    actions = actionsResult.data;
  } catch (err) {
    if (!isMissingData(err)) throw err;
  }

  // Free float hanya tersedia sebagai daftar. Disaring per subsektor supaya
  // biayanya 2 kredit, bukan 10 untuk seluruh bursa.
  let freeFloatResult = null;
  let freeFloat: number | null = null;
  const subSector = overview?.sub_sector;
  if (subSector) {
    try {
      freeFloatResult = await ctx.client.fetchFreeFloat(
        { sub_sector: toSectorSlug(subSector) },
        { checkId: ctx.checkId },
      );
      freeFloat = findFreeFloat(freeFloatResult.data, claim.ticker);
    } catch (err) {
      if (!isMissingData(err)) throw err;
    }
  }

  const assessment = assessRiskSignals({
    suspensions,
    actions,
    freeFloat,
    overview,
    today: ctx.today,
  });

  const evidence = [];
  if (overview?.market_cap != null) {
    evidence.push(
      makeEvidence(claim.claimId, report, `Kapitalisasi pasar ${claim.ticker}`, overview.market_cap, 'IDR'),
    );
  }
  if (overview?.market_cap_rank != null) {
    evidence.push(
      makeEvidence(
        claim.claimId,
        report,
        `Peringkat kapitalisasi ${claim.ticker}`,
        overview.market_cap_rank,
      ),
    );
  }
  if (suspensionsResult) {
    evidence.push(
      makeEvidence(
        claim.claimId,
        suspensionsResult,
        `Jumlah suspensi ${claim.ticker} dua tahun terakhir`,
        assessment.suspensionCount,
      ),
    );
  }
  if (freeFloatResult && freeFloat !== null) {
    evidence.push(
      makeEvidence(
        claim.claimId,
        freeFloatResult,
        `Free float ${claim.ticker}`,
        round2(freeFloat * 100),
        '%',
      ),
    );
  }
  if (actionsResult) {
    const rights = actions?.corporate_actions?.right_issue?.length ?? 0;
    evidence.push(
      makeEvidence(claim.claimId, actionsResult, `Jumlah rights issue ${claim.ticker}`, rights),
    );
  }

  if (evidence.length === 0) {
    return unverifiable(`Tidak ada sinyal risiko ${claim.ticker} yang bisa diukur dari data Sectors.`, tol);
  }

  const note =
    assessment.signals.length === 0
      ? `Tidak ditemukan sinyal risiko terukur pada ${claim.ticker}: tidak ada suspensi dua tahun terakhir, ` +
        'tidak ada rights issue atau waran, dan free float memenuhi aturan BEI.'
      : `Ditemukan ${assessment.signals.length} sinyal risiko pada ${claim.ticker}. ` +
        assessment.signals.map((s) => s.summary).join(' ');

  return {
    evidence,
    computed: {
      value: assessment.signals.length,
      unit: 'sinyal',
      evidenceId: evidence[0]!.evidenceId,
    },
    matches: assessment.signals.length === 0,
    tolerance: tol,
    note,
    details: { assessment },
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
