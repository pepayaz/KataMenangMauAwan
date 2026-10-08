import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { parseFinancialPeriod, lastFinancialPeriod, AssertedUnitSchema, ClaimSchema, ClaimTypeSchema, EntitySchema, extractNumbers,
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
  prompt?: string;
  llm: Pick<LlmAdapter, 'generate'>;
  signal?: AbortSignal;
  onRejected?: (rejection: ExtractionRejection) => void;
};

// Arah perubahan sering ditulis dengan kata kerja, bukan tanda: "turun 7,4%" berarti -7,4%.
const DECLINE = /(?:^|[^\p{L}])(?:turun|penurunan|anjlok|ambrol|ambruk|merosot|jatuh|longsor|terjun|terkoreksi|koreksi|melemah|pelemahan|susut|menyusut|minus|down|drop(?:ped)?|fell|fall(?:en)?|plunge[sd]?|decline[sd]?)(?![\p{L}])/giu;
const RISE = /(?:^|[^\p{L}])(?:naik|kenaikan|melonjak|lonjakan|terbang|melesat|meroket|tumbuh|pertumbuhan|menguat|penguatan|up|rise|rose|gain(?:ed)?|surge[sd]?|jump(?:ed)?)(?![\p{L}])/giu;
const SIGNED_TYPES = new Set(['price_move', 'earnings_growth']);
const FLOW_OUT = /(?:^|[^\p{L}])(?:jual|jualan|menjual|kabur|keluar|outflow|buang|distribusi|lepas|guyur|net sell)(?![\p{L}])/iu;
const FLOW_IN = /(?:^|[^\p{L}])(?:beli|membeli|borong|memborong|masuk|inflow|akumulasi|serok|koleksi|tampung|net buy)(?![\p{L}])/iu;

/**
 * Arah arus asing ditulis di kalimat ("asing buang BBRI"), tetapi metric dari LLM
 * sering netral ("foreign flow"). Kode menempelkan arah literal dari kutipan.
 */
export function flowMetric(metric: string, quote: string): string {
  const metricOut = FLOW_OUT.test(metric), metricIn = FLOW_IN.test(metric);
  if (metricOut !== metricIn) return metric;
  const out = FLOW_OUT.test(quote), inflow = FLOW_IN.test(quote);
  if (out === inflow) return metric;
  return `${metric} (${out ? 'jual bersih' : 'beli bersih'})`;
}

/**
 * Tanda angka perubahan yang ditetapkan kode: kata arah terdekat sebelum angka
 * menentukan; angka bertanda eksplisit (+/-) tidak diubah.
 */
export function directionSign(quote: string, numberStart: number, raw: string): 1 | -1 {
  if (/^[+\-−]/.test(raw.trim())) return 1;
  const before = quote.slice(0, numberStart);
  const last = (pattern: RegExp) => Math.max(-1, ...[...before.matchAll(pattern)].map((m) => m.index));
  const decline = last(DECLINE), rise = last(RISE);
  if (decline < 0 && rise < 0) {
    const after = quote.slice(numberStart);
    const firstDecline = after.search(DECLINE), firstRise = after.search(RISE);
    return firstDecline >= 0 && (firstRise < 0 || firstDecline < firstRise) ? -1 : 1;
  }
  return decline > rise ? -1 : 1;
}

const PREDICTION = /\b(?:bakal|akan|pasti|prediksi|target harga|to the moon|auto cuan)\b/i;
const OPINION = /\b(?:menurut saya|saya rasa|saya yakin|bagus banget|jelek banget)\b/i;
const VALUELESS_OPINION = /\b(?:murah|mahal|aman|bagus|jelek|cuan)\b/i;

/**
 * LLM sering meleset beberapa karakter saat menghitung offset pada teks panjang.
 * Kutipan tetap wajib ada persis di teks; koordinatnya ditetapkan kode, yaitu
 * kemunculan terdekat dari tebakan LLM. Tanpa kemunculan persis: null.
 */
export function anchorQuote(text: string, quote: string, hintStart: number): { start: number; end: number } | null {
  if (quote.trim() === '') return null;
  let best = -1;
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    if (best === -1 || Math.abs(at - hintStart) < Math.abs(best - hintStart)) best = at;
  }
  return best === -1 ? null : { start: best, end: best + quote.length };
}

/** Awal kalimat yang memuat posisi `at`: sesudah tanda akhir kalimat + spasi, atau baris baru. */
export function sentenceStart(text: string, at: number): number {
  let start = 0;
  for (const match of text.slice(0, at).matchAll(/[.!?](?=\s)|\n/g)) start = match.index + 1;
  return start;
}

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
    const hint = candidate.span;
    // Offsets are hints. A unique literal quote safely repairs even an out-of-range hint.
    const validHint = Number.isInteger(hint.start) && Number.isInteger(hint.end) && hint.start >= 0 && hint.end > hint.start && hint.end <= text.length;
    const uniqueQuote = candidate.quote.length > 0 && text.indexOf(candidate.quote) >= 0 && text.indexOf(candidate.quote) === text.lastIndexOf(candidate.quote);
    if (!validHint && !uniqueQuote) { reject('INVALID_SPAN'); continue; }
    const anchored = anchorQuote(text, candidate.quote, validHint ? hint.start : 0);
    if (!anchored) { reject('INVALID_QUOTE'); continue; }
    const { start, end } = anchored;
    const quote = text.slice(start, end);
    if (candidate.tickers.length === 0) { reject('NO_TICKER'); continue; }
    const asserted = candidate.asserted;
    const transition = /(?:dari|from)\s+[^\n;]+?\s+(?:ke|to|menjadi)\s+/i.test(quote);
    // A single report label also applies to its preceding summary in the same paragraph.
    const paragraphBoundary = text.lastIndexOf('\n\n', start);
    const paragraphStart = paragraphBoundary < 0 ? 0 : paragraphBoundary + 2;
    const nextBoundary = text.indexOf('\n\n', end);
    const paragraph = text.slice(paragraphStart, nextBoundary < 0 ? text.length : nextBoundary);
    const lastLabel = lastFinancialPeriod(paragraph);
    const uniqueLabel = lastLabel && !lastFinancialPeriod(paragraph.slice(0, paragraph.lastIndexOf(lastLabel))) ? lastLabel : undefined;
    const inheritedPeriod = new Set(entities.map(entity => entity.ticker)).size === 1 && candidate.type === 'earnings_growth'
      ? lastFinancialPeriod(text.slice(paragraphStart, end)) ?? uniqueLabel : undefined;
    const context = text.slice(sentenceStart(text, start), end);
    const normalizedPeriod = asserted.period && parseFinancialPeriod(asserted.period);
    const literalPeriod = inheritedPeriod && parseFinancialPeriod(inheritedPeriod);
    const period = normalizedPeriod && literalPeriod && normalizedPeriod.reportDate === literalPeriod.reportDate
      && normalizedPeriod.kind === literalPeriod.kind ? inheritedPeriod : asserted.period ?? inheritedPeriod;
    const periodContext = inheritedPeriod ? paragraph : context;
    if ((asserted.window !== null && (asserted.window.trim() === '' || !periodContext.includes(asserted.window)))
      || (period !== undefined && period !== null && (period.trim() === '' || !periodContext.includes(period)))) {
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
        asserted: { metric: candidate.type === 'foreign_flow' ? flowMetric(asserted.metric, quote) : transition && !/\(level\)/i.test(asserted.metric) ? `${asserted.metric} (level)` : asserted.metric,
          ...(matching && !matching.ambiguous ? { value: (matching.unit === '%' ? matching.value : matching.normalized)
            * (SIGNED_TYPES.has(candidate.type) && !transition ? directionSign(quote, matching.span[0], matching.raw) : 1) } : {}),
          ...(asserted.unit !== null ? { unit: asserted.unit } : {}),
          ...(asserted.window !== null ? { window: asserted.window } : {}),
          ...(period ? { period } : {}),
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
  const prompt = options.prompt ?? await readFile(new URL('../prompts/extractor.md', import.meta.url), 'utf8');
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
