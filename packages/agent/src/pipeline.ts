import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { CheckInputSchema, CheckResultSchema, ClaimVerdictSchema, EvidenceSchema, TraceEventSchema,
  type CheckInput, type CheckResult, type Claim, type ClaimVerdict, type Evidence, type TraceEvent } from '@cek-dulu/shared';
import { SectorsError, estimateCredits, type EndpointName, type SectorsClient } from '@cek-dulu/sectors';
import { VERIFIERS, enabledClaimTypes, type VerifierRegistry, type VerifierOutput } from '@cek-dulu/verifiers';
import { normalizeText, UserTickerSelectionError, type UserTickerSelection, type TickerDirectory } from './normalizer.js';
import { extractClaimsWithDiagnostics } from './extractor.js';
import { routeClaim, type RoutePlan } from './router.js';
import { adjudicate, type AdjudicatedVerdict } from './adjudicator.js';
import { withGrounding, validateGrounding } from './grounding.js';
import { isOutputAllowed } from './output-policy.js';
import { createHypothesisRegistry, createSectorsHunterGateway, huntContext,
  type HunterToolGateway, type HypothesisRegistry } from './hunter/index.js';
import { HunterToolError } from './hunter/index.js';
import { LlmError, type LlmAdapter } from './llm.js';

export type PipelineDeps = {
  client: SectorsClient; llm: Pick<LlmAdapter, 'generate'>; verifiers?: Partial<VerifierRegistry>;
  userSelections?: readonly UserTickerSelection[];
  prompts?: { extractor: string; explainer: string };
  directory?: TickerDirectory; concurrency?: number; now?: () => Date;
  flags?: Record<string, boolean>;
  hunterGateway?: (claim: Claim) => HunterToolGateway;
  registry?: (claim: Claim, today: string) => HypothesisRegistry;
};
export type TraceEmitter = (event: TraceEvent) => void | Promise<void>;
const explanationSchema = z.object({ explanation: z.string().min(1) }).strict();
const verifierSchema = z.object({ evidence: z.array(EvidenceSchema), computed: z.object({
  value: z.number().finite(), unit: z.string(), evidenceId: z.string() }).optional(),
  matches: z.boolean().nullable(), tolerance: z.string(), note: z.string(), details: z.record(z.unknown()).optional() });
function hasPercentagePoints(claim: Claim, unit: string | undefined): boolean {
  return unit === '%' && ['price_move', 'earnings_growth', 'accumulation', 'safety'].includes(claim.type);
}

/** B: dividend % sudah pecahan; price/earnings memakai poin persen. Unit kosong tidak ditebak. */
export function normalizeVerifierEvidence(claim: Claim, evidence: readonly Evidence[]): Evidence[] {
  return evidence.filter((e) => e.claimId === claim.claimId).map((e) => ({ ...e,
    value: typeof e.value === 'number' && hasPercentagePoints(claim, e.unit)
      ? e.value / 100 : e.value }));
}
export function deterministicExplanation(verdict: AdjudicatedVerdict): string {
  const templates = {
    supported: 'Angka dalam klaim sesuai dengan data yang tersedia. Status ini menilai kesesuaian angka saja.',
    refuted: 'Angka dalam klaim berbeda dari data pembanding di luar toleransi pemeriksaan.',
    misleading: 'Angka dalam klaim sesuai dengan data, tetapi ada konteks penting yang mengubah maknanya.',
    unverifiable: 'Data atau konteks yang tersedia belum cukup untuk memeriksa klaim ini secara lengkap.',
    out_of_scope: 'Klaim ini merupakan prediksi atau opini. Data historis tidak membuktikan hasil di masa depan.',
  };
  return templates[verdict.verdict];
}
export function displayEvidenceValues(evidence: readonly Evidence[]): Array<{ evidenceId: string; label: string; text: string }> {
  const formatter = new Intl.NumberFormat('id-ID', { useGrouping: false, maximumFractionDigits: 12 });
  const format = (value: number): string => {
    const text = formatter.format(value);
    // Tiga digit desimal tunggal ambigu bagi parser; nol akhir memperjelas desimal.
    return /,\d{3}$/.test(text) ? `${text}0` : text;
  };
  return evidence.filter((e) => typeof e.value === 'number').map((e) => ({ evidenceId: e.evidenceId, label: e.label,
    text: e.unit === '%' ? `${format((e.value as number) * 100)}%`
      : e.unit === 'IDR' ? `Rp${format(e.value as number)}`
      : e.unit === 'x' ? `${format(e.value as number)}x`
      : e.unit === 'shares' ? `${format(e.value as number)} saham` : format(e.value as number) }));
}

/** Wrapper B: hormati rencana tanggal router dan hitung per panggilan, bukan per Evidence. */
function verifierClient(client: SectorsClient, plan: RoutePlan, onCredit: (credits: number) => void): SectorsClient {
  return new Proxy(client, { get(target, property) {
    const value: unknown = Reflect.get(target, property, target);
    if (typeof value !== 'function') return value;
    if (typeof property !== 'string' || !property.startsWith('fetch')) return value.bind(target);
    return async (...originalArgs: unknown[]) => {
      const args = [...originalArgs], calls = plan.tools.filter((t) => t.tool === property);
      if (['fetchDailyPrice', 'fetchForeignFlow', 'fetchBrokerSummary'].includes(property) && calls.length) {
        args[1] = { start: calls[0]!.params.start, end: calls.at(-1)!.params.end };
      }
      if (property === 'fetchQuarterlyFinancials' && calls.length) {
        const { symbol: _symbol, ...params } = calls[0]!.params; args[1] = params;
      }
      try {
        const output: unknown = await Reflect.apply(value, target, args);
        const result = z.object({ credits: z.number().int().nonnegative(), cached: z.boolean() }).parse(output);
        onCredit(result.credits);
        return output;
      } catch (error) {
        if (error instanceof SectorsError && error.code === 'NOT_FOUND') onCredit(1);
        throw error;
      }
    };
  } });
}

/** Concurrency dihitung pada seluruh siklus klaim, termasuk hunter dan penjelasan. */
export async function runCheck(rawInput: CheckInput, deps: PipelineDeps, emit: TraceEmitter): Promise<CheckResult> {
  const input = CheckInputSchema.parse(rawInput), now = deps.now ?? (() => new Date());
  const concurrency = deps.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Batas konkurensi harus antara satu dan enam belas.');
  const today = now().toISOString().slice(0, 10);
  // Satu antrean emitter menjaga urutan event walau worker klaim berjalan paralel.
  let emission = Promise.resolve();
  const trace = (stage: TraceEvent['stage'], message: string, data?: unknown, credits = 0): Promise<void> => {
    const event = TraceEventSchema.parse({ checkId: input.checkId, ts: now().toISOString(), stage, message, data, credits });
    emission = emission.then(() => emit(event)); return emission;
  };
  const output: CheckResult = { checkId: input.checkId, entities: [], claims: [], evidence: [], hypothesisRuns: [],
    verdicts: [], creditsUsed: 0, finishedAt: now().toISOString() };
  let normalized: Awaited<ReturnType<typeof normalizeText>>;
  try {
    normalized = await normalizeText(input.rawText, { directory: deps.directory, llm: deps.llm, userSelections: deps.userSelections });
    output.entities = normalized.entities;
    await trace('normalize', 'Resolusi saham selesai.', { status: normalized.status, entities: normalized.entities, choices: normalized.choices });
    if (normalized.status !== 'ready') {
      await trace('done', 'Pilihan saham pengguna diperlukan.', { status: 'needs_user_choice' });
      output.finishedAt = now().toISOString(); return CheckResultSchema.parse(output);
    }
    const extracted = await extractClaimsWithDiagnostics(normalized.text, output.entities, { checkId: input.checkId, llm: deps.llm, prompt: deps.prompts?.extractor });
    output.claims = extracted.claims;
    await trace('extract', 'Ekstraksi klaim selesai.', { claimIds: output.claims.map((c) => c.claimId), rejected: extracted.rejected });
  } catch (error) {
    await trace('error', error instanceof UserTickerSelectionError ? error.message : extractionFailureMessage(error), {
      code: error instanceof UserTickerSelectionError ? 'INVALID_USER_SELECTION' : 'EXTRACTION_FAILED',
      ...(error instanceof LlmError ? { llmCode: error.code } : {}) });
    await trace('done', 'Pemeriksaan berhenti sebelum verifikasi.', { status: 'error' });
    output.finishedAt = now().toISOString(); return CheckResultSchema.parse(output);
  }
  const prompt = deps.prompts?.explainer ?? await readFile(new URL('../prompts/explainer.md', import.meta.url), 'utf8');
  const enabled = new Set(enabledClaimTypes(deps.flags ?? {}));
  const results: Array<{ verdict: ClaimVerdict; evidence: Evidence[]; hypotheses: CheckResult['hypothesisRuns']; credits: number }> = [];
  const processClaim = async (claim: Claim) => {
    let credits = 0, reportedCredits = 0, evidence: Evidence[] = [], hypotheses: CheckResult['hypothesisRuns'] = [];
    let verdict: AdjudicatedVerdict;
    try {
      const plan = routeClaim(claim, { today });
      await trace('route', 'Rencana verifikasi selesai.', plan);
      let verified: VerifierOutput = { evidence: [], matches: null, tolerance: '-', note: '' };
      // B valuation selalu memakai tahun terbaru; composition B hanya tahun kini.
      const unsupportedPeriod = claim.type === 'valuation' && !!claim.asserted.period
        || claim.type === 'accumulation' && plan.tools.filter((t) => t.tool === 'fetchShareholdersComposition').length > 1;
      const canVerify = claim.inScope && plan.status === 'ready' && enabled.has(claim.type) && !unsupportedPeriod;
      if (canVerify) {
        const verifier = deps.verifiers?.[claim.type] ?? VERIFIERS[claim.type];
        verified = verifierSchema.parse(await verifier(claim, { client: verifierClient(deps.client, plan, (cost) => { credits += cost; }),
          checkId: input.checkId, today }));
        evidence = normalizeVerifierEvidence(claim, verified.evidence);
        if (verified.computed && hasPercentagePoints(claim, verified.computed.unit))
          verified.computed = { ...verified.computed, value: verified.computed.value / 100 };
      }
      await trace('verify', 'Verifikasi angka selesai.', { claimId: claim.claimId,
        status: canVerify ? 'verified' : claim.inScope ? 'needs_data_or_flag' : 'out_of_scope', unsupportedPeriod,
        ...(canVerify && !evidence.length ? { pendingTools: plan.tools.map((call) => ({ call,
          estimatedCredits: estimateCredits(call.tool as EndpointName, call.params) })) } : {}),
        evidenceIds: evidence.map((e) => e.evidenceId) }, credits);
      reportedCredits = credits;
      let hunterCredits = 0;
      if (canVerify && typeof verified.matches === 'boolean') {
        try {
          const registry = deps.registry?.(claim, today) ?? createHypothesisRegistry(claim, { today });
          const gateway = deps.hunterGateway?.(claim) ?? createSectorsHunterGateway(deps.client, today);
          const beforeHunter = credits;
          const hunted = await huntContext(claim, evidence, { registry, llm: deps.llm,
            gateway: { quote: (call) => gateway.quote(call), execute: async (call, options) => {
              try { const response = await gateway.execute(call, options); credits += response.credits; return response; }
              catch (error) { credits += error instanceof HunterToolError ? error.credits : options.maxCredits; throw error; }
            } } });
          hunterCredits = hunted.creditsUsed; credits = beforeHunter + hunterCredits;
          evidence = [...new Map(hunted.evidence.map((e) => [e.evidenceId, e])).values()];
          hypotheses = hunted.results;
          if (verified.matches === true && hunted.skipped.length && !hypotheses.some((h) => h.triggered && h.strength === 'strong')) verified.matches = null;
          await trace('hunt', 'Pemeriksaan konteks selesai.', { claimId: claim.claimId, results: hypotheses,
            skipped: hunted.skipped, pendingTools: hunted.pendingTools, selectionSource: hunted.selectionSource }, hunterCredits);
          reportedCredits = credits;
        } catch {
          if (verified.matches === true) verified.matches = null;
          await trace('error', 'Konteks klaim belum dapat diperiksa.', { claimId: claim.claimId, code: 'HUNTER_FAILED' }, credits - reportedCredits);
          reportedCredits = credits;
          await trace('hunt', 'Pemeriksaan konteks belum lengkap.', { claimId: claim.claimId });
        }
      } else await trace('hunt', 'Pemeriksaan konteks tidak memerlukan panggilan.', { claimId: claim.claimId });
      verdict = adjudicate(claim, { ...verified, evidence }, hypotheses);
    } catch {
      await trace('error', 'Klaim ini tidak dapat diselesaikan; klaim lain tetap diproses.', { claimId: claim.claimId, code: 'CLAIM_FAILED' }, credits - reportedCredits);
      verdict = adjudicate(claim, { evidence, matches: null, tolerance: '-' }, []);
    }
    verdict.missingContext = verdict.missingContext.map((context) => ({ ...context, summary: isOutputAllowed(context.summary)
      && validateGrounding(context.summary, evidence.filter((e) => context.evidenceIds.includes(e.evidenceId))).ok
      ? context.summary : 'Ada konteks penting yang didukung data pembanding.' }));
    await trace('adjudicate', 'Status klaim ditentukan oleh aturan.', { claimId: claim.claimId, verdict: verdict.verdict });
    const template = deterministicExplanation(verdict);
    const displayEvidence = displayEvidenceValues(evidence);
    let usedTemplate = false;
    const explanation = await withGrounding(async (feedback) => {
      try {
        const written = await deps.llm.generate({ schema: explanationSchema, name: 'claim_explanation', prompt,
          input: JSON.stringify({ claimType: claim.type, verdict, displayEvidence, feedback }) });
        return written.explanation;
      } catch { usedTemplate = true; return template; }
    }, evidence, () => { usedTemplate = true; return template; }, isOutputAllowed);
    // Kontrak trace belum memiliki stage grounding: dicatat sebagai sub-tahap adjudicate.
    await trace('adjudicate', 'Penjelasan lolos pemeriksaan angka dan kata terlarang.', { claimId: claim.claimId, step: 'grounding', usedTemplate });
    return { verdict: ClaimVerdictSchema.parse({ ...verdict, explanation }), evidence, hypotheses, credits };
  };
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, output.claims.length) }, async () => {
    while (cursor < output.claims.length) {
      const index = cursor++; results[index] = await processClaim(output.claims[index]!);
    }
  }));
  output.verdicts = results.map((r) => r.verdict);
  output.evidence = results.flatMap((r) => r.evidence);
  output.hypothesisRuns = results.flatMap((r) => r.hypotheses);
  output.creditsUsed = results.reduce((sum, r) => sum + r.credits, 0);
  output.finishedAt = now().toISOString();
  await trace('done', 'Pemeriksaan selesai.', { claimCount: output.claims.length, creditsUsed: output.creditsUsed });
  return CheckResultSchema.parse(output);
}

/** Pesan kegagalan ekstraksi per penyebab LLM; pesan mentah provider tidak pernah dibawa. */
export function extractionFailureMessage(error: unknown): string {
  if (error instanceof LlmError && error.code === 'QUOTA')
    return 'Kuota layanan LLM sedang habis, jadi klaim belum dapat diekstrak. Coba lagi nanti.';
  if (error instanceof LlmError && error.code === 'UNAVAILABLE')
    return 'Layanan LLM sedang sibuk, jadi klaim belum dapat diekstrak. Coba lagi sebentar lagi.';
  return 'Input atau ekstraksi tidak dapat diselesaikan.';
}
