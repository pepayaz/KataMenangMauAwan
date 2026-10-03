import { CheckResultSchema, TraceEventSchema, EntitySchema, type CheckResult, type TraceEvent } from '@cek-dulu/shared';
import { z } from 'zod';

const rowSchema = z.record(z.unknown());
const rows = z.array(rowSchema);
/** Postgres timestamps include an offset; shared timestamps use UTC ISO. */
export function storedTimestamp(value: unknown): string {
  return new Date(z.string().datetime({ offset: true }).parse(value)).toISOString();
}
/** Konversi SQL snake_case ke kontrak shared; span disimpan sebagai int4range. */
export function restoreStoredCheck(input: { check: Record<string, unknown>; claims: unknown; evidence: unknown;
  verdicts: unknown; hypotheses: unknown; trace: unknown }): { result: CheckResult; trace: TraceEvent[] } {
  const checkId = z.string().parse(input.check.id);
  const trace = rows.parse(input.trace).map(row => TraceEventSchema.parse({ ...row, checkId, ts: storedTimestamp(row.ts), credits: row.credits ?? undefined }));
  const claims = rows.parse(input.claims).map(row => {
    const span = z.string().parse(row.span).match(/^\[(\d+),(\d+)\)$/);
    if (!span) throw new Error('Span klaim tersimpan tidak valid.');
    return { claimId: row.id, checkId, type: row.type, ticker: row.ticker, asserted: row.asserted,
      inScope: row.in_scope, span: [Number(span[1]), Number(span[2])] };
  });
  const entities = trace.flatMap(event => {
    if (event.stage !== 'normalize') return [];
    const parsed = z.object({ entities: z.array(EntitySchema) }).safeParse(event.data);
    return parsed.success ? parsed.data.entities : [];
  });
  const result = CheckResultSchema.parse({ checkId, entities, claims,
    evidence: rows.parse(input.evidence).map(row => ({ evidenceId: row.id, claimId: row.claim_id, tool: row.tool,
      params: row.params, credits: row.credits, cached: row.cached, fetchedAt: storedTimestamp(row.fetched_at), label: row.label, value: row.value, unit: row.unit ?? undefined })),
    verdicts: rows.parse(input.verdicts).map(row => ({ claimId: row.claim_id, verdict: row.verdict, computed: row.computed ?? undefined,
      missingContext: row.missing_context, explanation: row.explanation, evidenceIds: row.evidence_ids })),
    hypothesisRuns: rows.parse(input.hypotheses).map(row => ({ claimId: row.claim_id, hypId: row.hyp_id, triggered: row.triggered,
      strength: row.strength, evidenceIds: row.evidence_ids, note: row.note })),
    creditsUsed: input.check.credits_used, finishedAt: storedTimestamp(input.check.finished_at),
  });
  return { result, trace };
}
