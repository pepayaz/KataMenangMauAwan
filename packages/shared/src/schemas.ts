import { z } from 'zod';

/**
 * Kontrak data Cek Dulu — AGENTS.md bagian 5 dan 7.
 * Perubahan disertai fixture, AGENTS.md, dan packages/shared/CLAUDE.md.
 */

export const ClaimTypeSchema = z.enum([
  'valuation',
  'dividend',
  'price_move',
  'earnings_growth',
  'foreign_flow',
  'accumulation',
  'safety',
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const VerdictSchema = z.enum([
  'supported',
  'refuted',
  'misleading',
  'unverifiable',
  'out_of_scope',
]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const CheckSourceSchema = z.enum(['paste', 'share_target', 'screenshot', 'extension']);
export type CheckSource = z.infer<typeof CheckSourceSchema>;

export const CheckInputSchema = z.object({
  checkId: z.string(),
  userId: z.string().optional(),
  source: CheckSourceSchema,
  rawText: z.string().min(1),
  url: z.string().optional(),
  createdAt: z.string(),
});
export type CheckInput = z.infer<typeof CheckInputSchema>;

export const EntitySchema = z.object({
  surface: z.string(),
  ticker: z.string(),
  confidence: z.number().min(0).max(1),
  method: z.enum(['explicit', 'alias', 'llm', 'user']),
});
export type Entity = z.infer<typeof EntitySchema>;

export const AssertedUnitSchema = z.enum(['%', 'x', 'IDR', 'shares']);
export type AssertedUnit = z.infer<typeof AssertedUnitSchema>;

export const AssertedSchema = z.object({
  metric: z.string(),
  value: z.number().optional(),
  unit: AssertedUnitSchema.optional(),
  window: z.string().optional(),
  period: z.string().optional(),
});
export type Asserted = z.infer<typeof AssertedSchema>;

export const ClaimSchema = z.object({
  claimId: z.string(),
  checkId: z.string(),
  span: z.tuple([z.number().int(), z.number().int()]),
  type: ClaimTypeSchema,
  ticker: z.string(),
  asserted: AssertedSchema,
  inScope: z.boolean(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const EvidenceSchema = z.object({
  evidenceId: z.string(),
  claimId: z.string(),
  tool: z.string(),
  params: z.record(z.unknown()),
  credits: z.number().int().min(0),
  cached: z.boolean(),
  fetchedAt: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const HypothesisResultSchema = z.object({
  hypId: z.string(),
  claimId: z.string(),
  triggered: z.boolean(),
  strength: z.enum(['weak', 'strong']),
  evidenceIds: z.array(z.string()),
  note: z.string(),
});
export type HypothesisResult = z.infer<typeof HypothesisResultSchema>;

/** Rencana alat; nama metode klien Sectors, bukan URL atau endpoint baru. */
export const ToolCallSchema = z.object({
  tool: z.string().min(1),
  params: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

/** Definisi lokal: fungsi test deterministik tidak dikirim sebagai JSON ke LLM. */
export const HypothesisSchema = z.object({
  id: z.string().min(1),
  claimType: ClaimTypeSchema,
  description: z.string().min(1),
  requiredTools: z.array(ToolCallSchema),
  estCredits: z.number().int().nonnegative(),
  test: z.function().args(ClaimSchema, z.array(EvidenceSchema)).returns(HypothesisResultSchema),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const MissingContextSchema = z.object({
  hypId: z.string(),
  summary: z.string(),
  evidenceIds: z.array(z.string()),
});
export type MissingContext = z.infer<typeof MissingContextSchema>;

export const ComputedSchema = z.object({
  value: z.number(),
  unit: z.string(),
  evidenceId: z.string(),
});
export type Computed = z.infer<typeof ComputedSchema>;

export const ClaimVerdictSchema = z.object({
  claimId: z.string(),
  verdict: VerdictSchema,
  computed: ComputedSchema.optional(),
  missingContext: z.array(MissingContextSchema),
  /** Sudah lolos grounding validator (bab 3.6). */
  explanation: z.string(),
  evidenceIds: z.array(z.string()),
});
export type ClaimVerdict = z.infer<typeof ClaimVerdictSchema>;

export const TraceStageSchema = z.enum([
  'normalize',
  'extract',
  'route',
  'verify',
  'hunt',
  'adjudicate',
  'done',
  'error',
]);
export type TraceStage = z.infer<typeof TraceStageSchema>;

export const TraceEventSchema = z.object({
  checkId: z.string(),
  ts: z.string(),
  stage: TraceStageSchema,
  message: z.string(),
  data: z.unknown().optional(),
  credits: z.number().optional(),
});
export type TraceEvent = z.infer<typeof TraceEventSchema>;

/** Hasil akhir satu cek, dikirim sebagai event `done` dan disimpan ke riwayat. */
export const CheckResultSchema = z.object({
  checkId: z.string(),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
  evidence: z.array(EvidenceSchema),
  hypothesisRuns: z.array(HypothesisResultSchema),
  verdicts: z.array(ClaimVerdictSchema),
  creditsUsed: z.number().int().min(0),
  finishedAt: z.string(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;
