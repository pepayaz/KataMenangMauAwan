/**
 * Deteksi perubahan status klaim (bab 8.1 B nomor 5, bab 1.3 nomor 5). Pemilik: B.
 *
 * Klaim yang sama dikenali lewat `claim_hash`. Ketika data baru terbit dan cek
 * diulang, verdict untuk hash yang sama bisa berbeda; baris seperti itulah yang
 * ditandai "status berubah" di riwayat.
 */

export type HistoryRow = {
  claim_hash: string;
  claim_id: string;
  check_id: string;
  ticker: string;
  type: string;
  asserted: Record<string, unknown>;
  verdict: string;
  explanation: string;
  created_at: string;
};

export type StatusChange = {
  claimHash: string;
  ticker: string;
  type: string;
  previousVerdict: string;
  currentVerdict: string;
  previousCheckedAt: string;
  currentCheckedAt: string;
  currentCheckId: string;
  explanation: string;
};

/**
 * Membandingkan verdict terbaru dengan verdict sebelumnya untuk setiap
 * `claim_hash`. Murni, jadi bisa diuji tanpa basis data.
 *
 * Untuk setiap hash hanya dua pemeriksaan teratas yang menentukan: yang
 * diberitahukan ke pengguna adalah "berubah sejak terakhir kamu cek", bukan
 * seluruh sejarahnya. Klaim yang sempat berubah lalu kembali ke status semula
 * karena itu tetap dilaporkan sebagai perubahan dari pemeriksaan sebelumnya.
 */
export function detectStatusChanges(rows: HistoryRow[]): StatusChange[] {
  const byHash = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const list = byHash.get(row.claim_hash);
    if (list) list.push(row);
    else byHash.set(row.claim_hash, [row]);
  }

  const changes: StatusChange[] = [];
  for (const [claimHash, list] of byHash) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const current = sorted[0]!;
    const previous = sorted[1]!;
    if (current.verdict === previous.verdict) continue;

    changes.push({
      claimHash,
      ticker: current.ticker,
      type: current.type,
      previousVerdict: previous.verdict,
      currentVerdict: current.verdict,
      previousCheckedAt: previous.created_at,
      currentCheckedAt: current.created_at,
      currentCheckId: current.check_id,
      explanation: current.explanation,
    });
  }

  return changes.sort((a, b) => b.currentCheckedAt.localeCompare(a.currentCheckedAt));
}

export type CheckSummaryRow = {
  check_id: string;
  source: string;
  status: string;
  credits_used: number;
  created_at: string;
  finished_at: string | null;
  excerpt: string;
  claim_count: number;
  refuted_count: number;
  misleading_count: number;
  supported_count: number;
  tickers: string[] | null;
};

export function toHistoryPayload(c: CheckSummaryRow) {
  return {
    checkId: c.check_id,
    source: c.source,
    status: c.status,
    creditsUsed: c.credits_used,
    createdAt: c.created_at,
    finishedAt: c.finished_at,
    excerpt: c.excerpt,
    claimCount: Number(c.claim_count),
    counts: {
      supported: Number(c.supported_count),
      refuted: Number(c.refuted_count),
      misleading: Number(c.misleading_count),
    },
    tickers: c.tickers ?? [],
  };
}
