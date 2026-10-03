import { restoreStoredCheck, storedTimestamp } from '@/lib/stored-check';
import { getServiceClient } from '@cek-dulu/sectors';
import { getUser } from '@/lib/auth';

/**
 * GET /api/history/:checkId — merakit ulang satu rapor dari riwayat.
 *
 * UI (C) memakai endpoint ini untuk membuka cek lama tanpa menjalankan ulang
 * pipeline, jadi membuka riwayat tidak memakan satu kredit pun.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ checkId: string }> },
): Promise<Response> {
  const { checkId } = await params;

  const user = await getUser(req);
  if (!user) {
    return Response.json({ error: 'Perlu masuk untuk melihat riwayat.' }, { status: 401 });
  }

  const db = getServiceClient();
  if (!db) return Response.json({ error: 'Basis data tidak tersambung.' }, { status: 503 });

  const { data: check, error } = await db
    .from('checks')
    .select('id, user_id, source, raw_text, url, status, credits_used, created_at, finished_at')
    .eq('id', checkId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  // Cek milik orang lain dan cek yang tidak ada diperlakukan sama, supaya
  // keberadaan sebuah checkId tidak bisa ditebak dari kode status.
  if (!check || check.user_id !== user.id) {
    return Response.json({ error: 'Cek tidak ditemukan.' }, { status: 404 });
  }

  const { data: claims, error: claimsError } = await db
    .from('claims')
    .select('id, type, ticker, asserted, in_scope, claim_hash, span')
    .eq('check_id', checkId);

  if (claimsError) return Response.json({ error: 'Klaim tersimpan belum dapat dimuat.' }, { status: 503 });
  const claimIds = (claims ?? []).map((c) => c.id as string);

  const [evidenceRes, verdictsRes, hypothesesRes, traceRes] = await Promise.all([
    claimIds.length > 0
      ? db
          .from('evidence')
          .select('id, claim_id, tool, params, value, label, unit, credits, cached, fetched_at')
          .in('claim_id', claimIds)
      : { data: [] as unknown[] },
    claimIds.length > 0
      ? db
          .from('verdicts')
          .select('claim_id, verdict, computed, missing_context, explanation, evidence_ids')
          .in('claim_id', claimIds)
      : { data: [] as unknown[] },
    claimIds.length > 0
      ? db
          .from('hypothesis_runs')
          .select('claim_id, hyp_id, triggered, strength, evidence_ids, note')
          .in('claim_id', claimIds)
      : { data: [] as unknown[] },
    db
      .from('trace_events')
      .select('ts, stage, message, data, credits')
      .eq('check_id', checkId)
      .order('ts', { ascending: true }),
  ]);

  if (evidenceRes && 'error' in evidenceRes && evidenceRes.error
    || verdictsRes && 'error' in verdictsRes && verdictsRes.error
    || hypothesesRes && 'error' in hypothesesRes && hypothesesRes.error || traceRes.error) {
    return Response.json({ error: 'Rapor tersimpan belum dapat dimuat lengkap.' }, { status: 503 });
  }
  try {
    const restored = restoreStoredCheck({ check, claims: claims ?? [], evidence: evidenceRes.data ?? [],
      verdicts: verdictsRes.data ?? [], hypotheses: hypothesesRes.data ?? [], trace: traceRes.data ?? [] });
    return Response.json({ check: { checkId: check.id, rawText: check.raw_text, createdAt: storedTimestamp(check.created_at),
      source: check.source, url: check.url, status: check.status, creditsUsed: check.credits_used, finishedAt: restored.result.finishedAt },
      claims: claims ?? [], evidence: evidenceRes.data ?? [], verdicts: verdictsRes.data ?? [],
      hypothesisRuns: hypothesesRes.data ?? [], result: restored.result, trace: restored.trace });
  } catch {
    return Response.json({ error: 'Kontrak rapor tersimpan tidak valid atau pemeriksaan belum selesai.' }, { status: 503 });
  }
}
