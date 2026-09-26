import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { AssertedUnitSchema, ClaimSchema, ClaimTypeSchema, EntitySchema, extractNumbers,
  type Claim, type Entity } from '@cek-dulu/shared';
import { LlmAdapter } from './llm.js';

/** Payload LLM lokal, bukan pengganti kontrak Claim. Field absen memakai null. */
export const ExtractedClaimSchema = z.object({
  span: z.object({ start: z.number().int(), end: z.number().int() }).strict(),
  quote: z.string(),
  tickers: z.array(z.string()),
  type: ClaimTypeSchema,
  asserted: z.object({
    metric: z.string(), value: z.number().nullable(), unit: AssertedUnitSchema.nullable(),
    window: z.string().nullable(), period: z.string().nullable(),
  }).strict(),
  inScope: z.boolean(),
}).strict();
export const ExtractionOutputSchema = z.object({ claims: z.array(ExtractedClaimSchema) }).strict();
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;
export type ExtractionRejection = {
  candidateIndex: number;
  reason: 'INVALID_SPAN' | 'INVALID_QUOTE' | 'UNKNOWN_TICKER' | 'LOW_CONFIDENCE_ENTITY'
    | 'NO_TICKER' | 'VALUE_NOT_WRITTEN' | 'UNIT_NOT_WRITTEN' | 'PERIOD_NOT_WRITTEN' | 'DUPLICATE_CLAIM';
  ticker?: string;
};
export type ExtractionResult = { claims: Claim[]; rejected: ExtractionRejection[] };
export type ExtractionOptions = {
  checkId: string;
  llm: Pick<LlmAdapter, 'generate'>;
  signal?: AbortSignal;
  onRejected?: (rejection: ExtractionRejection) => void;
};

const PREDICTION = /\b(?:bakal|akan|pasti|prediksi|target harga|to the moon|auto cuan)\b/i;
const OPINION = /\b(?:menurut saya|saya rasa|saya yakin|bagus banget|jelek banget)\b/i;
const VALUELESS_OPINION = /\b(?:murah|mahal|aman|bagus|jelek|cuan)\b/i;

/** Validasi deterministik sesudah LLM; angka harus ada persis, bukan toleransi. */
export function validateExtractedClaims(
  text: string, entities: readonly Entity[], candidates: readonly ExtractedClaim[], checkId: string,
): ExtractionResult {
  const claims: Claim[] = [];
  const rejected: ExtractionRejection[] = [];
  const known = new Map<string, Entity>();
  for (const entity of entities) {
    const previous = known.get(entity.ticker);
    if (!previous || previous.confidence < entity.confidence) known.set(entity.ticker, entity);
  }
  const seen = new Set<string>();
  const originalNumbers = extractNumbers(text);
  for (const [candidateIndex, candidate] of candidates.entries()) {
    const reject = (reason: ExtractionRejection['reason'], ticker?: string) => {
      rejected.push({ candidateIndex, reason, ...(ticker ? { ticker } : {}) });
    };
    const { start, end } = candidate.span;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) {
      reject('INVALID_SPAN'); continue;
    }
    const quote = text.slice(start, end);
    if (quote !== candidate.quote || quote.trim() === '') { reject('INVALID_QUOTE'); continue; }
    if (candidate.tickers.length === 0) { reject('NO_TICKER'); continue; }
    const asserted = candidate.asserted;
    if ([asserted.window, asserted.period].some((period) => period !== null && (period.trim() === '' || !quote.includes(period)))) {
      reject('PERIOD_NOT_WRITTEN'); continue;
    }
    const numbers = extractNumbers(quote);
    const matching = asserted.value === null ? undefined : numbers.find((number) => !number.ambiguous
      && number.value === asserted.value && number.unit === asserted.unit);
    if (asserted.value !== null && !matching) {
      const literalValue = numbers.some((number) => !number.ambiguous && number.value === asserted.value);
      reject(literalValue ? 'UNIT_NOT_WRITTEN' : 'VALUE_NOT_WRITTEN'); continue;
    }
    if (matching && !originalNumbers.some((number) => number.span[0] === start + matching.span[0]
      && number.span[1] === start + matching.span[1])) {
      reject('INVALID_SPAN'); continue;
    }
    if (asserted.value === null && asserted.unit !== null) { reject('UNIT_NOT_WRITTEN'); continue; }
    const inScope = candidate.inScope && !PREDICTION.test(quote) && !OPINION.test(quote)
      && !(asserted.value === null && VALUELESS_OPINION.test(quote));
    for (const ticker of new Set(candidate.tickers)) {
      const entity = known.get(ticker);
      if (!entity) { reject('UNKNOWN_TICKER', ticker); continue; }
      if (entity.confidence < 0.7) { reject('LOW_CONFIDENCE_ENTITY', ticker); continue; }
      const claim = ClaimSchema.parse({
        claimId: `${checkId}-c${claims.length + 1}`, checkId, span: [start, end],
        ticker, type: candidate.type, inScope,
        asserted: { metric: asserted.metric,
          ...(matching && !matching.ambiguous ? { value: matching.unit === '%'
            ? matching.value : matching.normalized } : {}),
          ...(asserted.unit !== null ? { unit: asserted.unit } : {}),
          ...(asserted.window !== null ? { window: asserted.window } : {}),
          ...(asserted.period !== null ? { period: asserted.period } : {}),
        },
      });
      const fingerprint = JSON.stringify([claim.span, claim.ticker, claim.type, claim.asserted, claim.inScope]);
      if (seen.has(fingerprint)) { reject('DUPLICATE_CLAIM', ticker); continue; }
      seen.add(fingerprint);
      claims.push(claim);
    }
  }
  return { claims, rejected };
}

/** Membaca prompt repo; koordinat selalu menunjuk teks bersih yang diberikan. */
export async function extractClaimsWithDiagnostics(
  text: string, entities: readonly Entity[], options: ExtractionOptions,
): Promise<ExtractionResult> {
  const checkedEntities = z.array(EntitySchema).parse(entities);
  if (text.trim() === '' || checkedEntities.length === 0) return { claims: [], rejected: [] };
  const prompt = await readFile(new URL('../prompts/extractor.md', import.meta.url), 'utf8');
  const output = await options.llm.generate({ schema: ExtractionOutputSchema, name: 'extracted_claims',
    prompt, input: JSON.stringify({ text, entities: checkedEntities }), signal: options.signal });
  const result = validateExtractedClaims(text, checkedEntities, output.claims, options.checkId);
  for (const rejection of result.rejected) options.onRejected?.(rejection);
  return result;
}

/** Bentuk pipeline Claim[]; gunakan diagnostics atau callback untuk alasan penolakan. */
export async function extractClaims(
  text: string, entities: readonly Entity[], options: ExtractionOptions,
): Promise<Claim[]> {
  return (await extractClaimsWithDiagnostics(text, entities, options)).claims;
}
