import type { SupabaseClient } from '@supabase/supabase-js';
import { claimHash, type CheckInput, type CheckResult, type TraceEvent } from '@cek-dulu/shared';

/**
 * Penyimpanan hasil cek ke Supabase (bab 8.1 B nomor 4). Pemilik: B.
 *
 * Dua sifat yang dijaga di sini:
 *
 *  - **Persistensi tidak pernah menjatuhkan cek.** Pengguna sudah menunggu
 *    15-40 detik; gagal menulis riwayat bukan alasan membuang rapor yang sudah
 *    jadi. Setiap kesalahan dicatat ke log dan cek tetap lanjut.
 *  - **Cek anonim tidak masuk riwayat siapa pun** (bab 15). Bila tidak ada
 *    user_id, teks mentah tetap disimpan sebentar untuk menjalankan cek, tetapi
 *    baris itu tidak terbaca lewat kunci anon karena RLS menuntut user_id cocok.
 */

export type PersistenceResult = { ok: boolean; error?: string };

export async function createCheckRow(
  db: SupabaseClient,
  input: CheckInput,
): Promise<PersistenceResult> {
  const { error } = await db.from('checks').insert({
    id: input.checkId,
    user_id: input.userId ?? null,
    source: input.source,
    raw_text: input.rawText,
    url: input.url ?? null,
    status: 'running',
    created_at: input.createdAt,
  });
  return toResult(error, 'checks.insert');
}

export async function saveTraceEvent(
  db: SupabaseClient,
  event: TraceEvent,
): Promise<PersistenceResult> {
  const { error } = await db.from('trace_events').insert({
    check_id: event.checkId,
    ts: event.ts,
    stage: event.stage,
    message: event.message,
    data: event.data ?? null,
    credits: event.credits ?? null,
  });
  return toResult(error, 'trace_events.insert');
}

/**
 * Menyimpan seluruh hasil cek dalam urutan yang menghormati foreign key:
 * claims, lalu evidence dan hypothesis_runs, lalu verdicts, lalu menutup checks.
 */
export async function saveCheckResult(
  db: SupabaseClient,
  result: CheckResult,
  status: 'done' | 'error' = 'done',
): Promise<PersistenceResult> {
  if (result.claims.length > 0) {
    const { error } = await db.from('claims').insert(
      result.claims.map((c) => ({
        id: c.claimId,
        check_id: c.checkId,
        type: c.type,
        ticker: c.ticker,
        asserted: c.asserted,
        span: `[${c.span[0]},${c.span[1]})`,
        in_scope: c.inScope,
        claim_hash: claimHash(c),
      })),
    );
    const r = toResult(error, 'claims.insert');
    if (!r.ok) return r;
  }

  if (result.evidence.length > 0) {
    // Satu klaim bisa menghasilkan label evidence yang sama dua kali bila
    // verifier dipanggil ulang; upsert membuat penyimpanan idempoten.
    const { error } = await db.from('evidence').upsert(
      result.evidence.map((e) => ({
        id: e.evidenceId,
        claim_id: e.claimId,
        tool: e.tool,
        params: e.params,
        value: e.value,
        label: e.label,
        unit: e.unit ?? null,
        credits: e.credits,
        cached: e.cached,
        fetched_at: e.fetchedAt,
      })),
      { onConflict: 'id' },
    );
    const r = toResult(error, 'evidence.upsert');
    if (!r.ok) return r;
  }

  if (result.hypothesisRuns.length > 0) {
    const { error } = await db.from('hypothesis_runs').insert(
      result.hypothesisRuns.map((h) => ({
        claim_id: h.claimId,
        hyp_id: h.hypId,
        triggered: h.triggered,
        strength: h.strength,
        evidence_ids: h.evidenceIds,
        note: h.note,
      })),
    );
    const r = toResult(error, 'hypothesis_runs.insert');
    if (!r.ok) return r;
  }

  if (result.verdicts.length > 0) {
    const { error } = await db.from('verdicts').upsert(
      result.verdicts.map((v) => ({
        claim_id: v.claimId,
        verdict: v.verdict,
        computed: v.computed ?? null,
        missing_context: v.missingContext,
        explanation: v.explanation,
        evidence_ids: v.evidenceIds,
      })),
      { onConflict: 'claim_id' },
    );
    const r = toResult(error, 'verdicts.upsert');
    if (!r.ok) return r;
  }

  const { error } = await db
    .from('checks')
    .update({
      status,
      credits_used: result.creditsUsed,
      finished_at: result.finishedAt,
    })
    .eq('id', result.checkId);
  return toResult(error, 'checks.update');
}

export async function markCheckFailed(
  db: SupabaseClient,
  checkId: string,
): Promise<PersistenceResult> {
  const { error } = await db
    .from('checks')
    .update({ status: 'error', finished_at: new Date().toISOString() })
    .eq('id', checkId);
  return toResult(error, 'checks.update.error');
}

function toResult(error: { message: string } | null, where: string): PersistenceResult {
  if (!error) return { ok: true };
  console.error(`[persistence] ${where}: ${error.message}`);
  return { ok: false, error: error.message };
}
