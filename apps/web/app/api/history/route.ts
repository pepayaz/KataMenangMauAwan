import { getServiceClient } from '@cek-dulu/sectors';
import { getUser } from '@/lib/auth';
import {
  detectStatusChanges,
  toHistoryPayload,
  type CheckSummaryRow,
  type HistoryRow,
} from '@/lib/history';

/**
 * GET /api/history — riwayat cek pengguna dan deteksi perubahan status
 * (bab 8.1 B nomor 5, bab 1.3 nomor 5).
 *
 * Kueri memakai service role lalu menyaring dengan user_id dari token. RLS tetap
 * menjadi jaring pengaman untuk akses langsung dari browser; di sini
 * penyaringannya eksplisit supaya tidak bergantung pada satu lapis saja.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const user = await getUser(req);
  if (!user) {
    return Response.json({ error: 'Perlu masuk untuk melihat riwayat.' }, { status: 401 });
  }

  const db = getServiceClient();
  if (!db) {
    return Response.json({ error: 'Basis data tidak tersambung.' }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = clamp(Number(url.searchParams.get('limit') ?? '25'), 1, 100);

  const [checksRes, claimsRes] = await Promise.all([
    db
      .from('check_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    db
      .from('claim_verdict_history')
      .select(
        'claim_hash, claim_id, check_id, ticker, type, asserted, verdict, explanation, created_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (checksRes.error) {
    return Response.json({ error: checksRes.error.message }, { status: 500 });
  }

  const checks = (checksRes.data ?? []) as CheckSummaryRow[];
  const claims = (claimsRes.data ?? []) as HistoryRow[];

  return Response.json({
    checks: checks.map(toHistoryPayload),
    changes: detectStatusChanges(claims),
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}
