import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export type LlmErrorCode = 'INPUT' | 'CONFIG' | 'SCHEMA' | 'PROVIDER' | 'QUOTA' | 'UNAVAILABLE' | 'TIMEOUT' | 'REFUSED' | 'INCOMPLETE' | 'INVALID_OUTPUT';
export class LlmError extends Error {
  constructor(readonly code: LlmErrorCode, readonly attempts = 0) {
    super(`LLM gagal secara terkontrol: ${code}.`);
    this.name = 'LlmError';
  }
}
/** Teks panjang penuh angka bisa memakan hampir 30 detik di Gemini Flash; beri ruang dua kali lipat. */
export const LLM_TIMEOUT_MS = 60_000;
export type LlmValidationIssue = { path: string; code: string };
export type LlmRequest = {
  model: string;
  prompt: string;
  input: string;
  imageDataUrl?: string;
  videoDataUrl?: string;
  format: { type: 'json_schema'; name: string; strict: true; schema: Record<string, unknown> };
  attempt: number;
  feedback: readonly LlmValidationIssue[];
  signal?: AbortSignal;
};
export interface LlmProvider {
  readonly name: string;
  complete(request: LlmRequest): Promise<unknown>;
}

/** Mock terisolasi: tidak membuat klien HTTP dan tidak membaca key. */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  readonly requests: LlmRequest[] = [];
  constructor(private readonly outputs: readonly unknown[]) {}
  async complete(request: LlmRequest): Promise<unknown> {
    this.requests.push(structuredClone({ ...request, signal: undefined }));
    const output = this.outputs[this.requests.length - 1];
    if (output instanceof Error) throw output;
    return structuredClone(output);
  }
}

class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    this.client = new OpenAI({ apiKey, maxRetries: 0, timeout: LLM_TIMEOUT_MS,
      ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  }
  async complete(request: LlmRequest): Promise<unknown> {
    if (request.videoDataUrl) throw new LlmError('INPUT', request.attempt);
    const response = await this.client.responses.create({
      model: request.model, store: false,
      input: [
        { role: 'system', content: request.prompt },
        { role: 'user', content: request.imageDataUrl ? [
          { type: 'input_text', text: request.input },
          { type: 'input_image', image_url: request.imageDataUrl, detail: 'high' },
        ] : request.input },
        ...(request.feedback.length > 0 ? [{ role: 'user' as const,
          content: `Keluaran sebelumnya tidak valid. Perbaiki JSON sesuai skema; jangan menambah fakta. Kesalahan: ${JSON.stringify(request.feedback)}` }] : []),
      ],
      text: { format: request.format },
    }, { signal: request.signal }).catch((error: unknown) => {
      if (error instanceof OpenAI.APIConnectionTimeoutError) throw new LlmError('TIMEOUT', request.attempt);
      throw error;
    });
    const refused = response.output.some((item) => item.type === 'message'
      && item.content.some((content) => content.type === 'refusal'));
    if (refused) throw new LlmError('REFUSED', request.attempt);
    if (response.status !== 'completed') throw new LlmError('INCOMPLETE', request.attempt);
    return response.output_text;
  }
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
// 429 (kuota/batas laju) tidak dicoba ulang: kuota harian tidak pulih dalam hitungan detik.
const GEMINI_TRANSIENT_STATUS = new Set([500, 503]);
const sleep = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return; }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
  const onAbort = (): void => { clearTimeout(timer); reject(signal?.reason); };
  signal?.addEventListener('abort', onAbort, { once: true });
});
const GEMINI_REFUSAL_REASONS =new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

export type LlmUsage = { stage: string; model: string; attempt: number; inputTokens: number; outputTokens: number; thinkingTokens: number };

type GeminiResponse = {
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

/** Gemini generateContent dengan responseJsonSchema; tanpa SDK, hanya fetch. */
class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch,
    private readonly retryDelaysMs: readonly number[] = [1000, 3000, 6000, 10000],
    private readonly onUsage: (usage: LlmUsage) => void = usage => console.info('[llm/usage]', usage)) {}
  async complete(request: LlmRequest): Promise<unknown> {
    const parts: Record<string, unknown>[] = [{ text: request.input }];
    if (request.imageDataUrl) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(request.imageDataUrl);
      if (!match) throw new LlmError('INPUT', request.attempt);
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    if (request.videoDataUrl) {
      const match = /^data:(video\/(?:mp4|webm));base64,(.+)$/.exec(request.videoDataUrl);
      if (!match) throw new LlmError('INPUT', request.attempt);
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    if (request.feedback.length > 0) parts.push({ text:
      `Keluaran sebelumnya tidak valid. Perbaiki JSON sesuai skema; jangan menambah fakta. Kesalahan: ${JSON.stringify(request.feedback)}` });
    const model = request.model.replace(/^models\//, '');
    // Extraction is literal parsing; bound its reasoning while retaining schema and grounding checks.
    const extraction = request.format.name === 'extracted_claims';
    const simple = ['claim_explanation', 'context_hypotheses', 'ticker_selection'].includes(request.format.name);
    const thinkingConfig = extraction && /^gemini-3[.-]/.test(model) ? { thinkingLevel: 'low' }
      : extraction && /^gemini-2\.5-flash(?:-|$)/.test(model) ? { thinkingBudget: 1024 }
      : simple && /^gemini-3[.-]/.test(model) ? { thinkingLevel: /^gemini-3\.[56]-/.test(model) ? 'minimal' : 'low' }
      : simple && /^gemini-2\.5-flash(?:-|$)/.test(model) ? { thinkingBudget: 0 } : undefined;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: request.prompt }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: request.format.schema,
        ...(thinkingConfig ? { thinkingConfig } : {}),
        // Includes thinking; leave ample space for full multi-claim extraction/transcription.
        ...(simple ? { maxOutputTokens: 4096 } : {}),
        ...(request.videoDataUrl ? { temperature: 0 } : {}) },
    });
    let response: Response | undefined;
    // Batas waktu adapter dilaporkan sebagai TIMEOUT; pembatalan pengguna tetap diteruskan apa adanya.
    const timedOut = (error: unknown): never => {
      if (error instanceof Error && error.name === 'TimeoutError' && !request.signal?.aborted)
        throw new LlmError('TIMEOUT', request.attempt);
      throw error;
    };
    // 429/500/503 dari Gemini umumnya sementara ("high demand"); coba ulang sebentar.
    for (let retry = 0; ; retry += 1) {
      const timeout = AbortSignal.timeout(LLM_TIMEOUT_MS);
      try {
        response = await this.fetchImpl(`${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
          body,
          signal: request.signal ? AbortSignal.any([request.signal, timeout]) : timeout,
        });
      } catch (error) { return timedOut(error); }
      if (response.ok || !GEMINI_TRANSIENT_STATUS.has(response.status) || retry >= this.retryDelaysMs.length) break;
      await sleep(this.retryDelaysMs[retry]!, request.signal);
    }
    // Pesan provider tidak dibawa: adapter mengubah error apa pun menjadi PROVIDER.
    if (response.status === 429) throw new LlmError('QUOTA', request.attempt);
    if (GEMINI_TRANSIENT_STATUS.has(response.status)) throw new LlmError('UNAVAILABLE', request.attempt);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let result: GeminiResponse;
    try { result = await response.json() as GeminiResponse; } catch (error) { return timedOut(error); }
    if (result.usageMetadata) {
      const usage = result.usageMetadata;
      try { this.onUsage({ stage: request.format.name, model, attempt: request.attempt,
        inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0,
        thinkingTokens: usage.thoughtsTokenCount ?? 0 }); } catch { /* Telemetry cannot fail a check. */ }
    }
    if (result.promptFeedback?.blockReason) throw new LlmError('REFUSED', request.attempt);
    const candidate = result.candidates?.[0];
    if (!candidate) throw new LlmError('INCOMPLETE', request.attempt);
    if (candidate.finishReason && GEMINI_REFUSAL_REASONS.has(candidate.finishReason)) throw new LlmError('REFUSED', request.attempt);
    if (candidate.finishReason && candidate.finishReason !== 'STOP') throw new LlmError('INCOMPLETE', request.attempt);
    return (candidate.content?.parts ?? []).filter((part) => !part.thought).map((part) => part.text ?? '').join('');
  }
}

const LIVE_PROVIDERS = new Set(['openai', 'gemini']);

/** Benar bila env cukup untuk provider live; dipakai route untuk pesan konfigurasi. */
export function isLlmConfigured(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return LIVE_PROVIDERS.has(env.LLM_PROVIDER?.trim() ?? '') && Boolean(env.LLM_MODEL?.trim() && env.LLM_API_KEY?.trim());
}

export type LlmAdapterOptions = {
  env?: Readonly<Record<string, string | undefined>>;
  provider?: LlmProvider;
  mockOutputs?: readonly unknown[];
  fetchImpl?: typeof fetch;
  onUsage?: (usage: LlmUsage) => void;
  /** Validated exact responses only, in memory, never persisted. Zero disables caching. */
  cacheTtlMs?: number;
};

/** Subset JSON strict: cegah schema fungsi/transform dilewati konverter SDK. */
function isStructuredSchema(schema: z.ZodTypeAny): boolean {
  if (schema instanceof z.ZodObject) return Object.values(schema.shape)
    .every((field) => isStructuredSchema(field as z.ZodTypeAny));
  if (schema instanceof z.ZodArray) return isStructuredSchema(schema.element);
  if (schema instanceof z.ZodNullable) return isStructuredSchema(schema.unwrap());
  if (schema instanceof z.ZodUnion) return schema.options.every(isStructuredSchema);
  return schema instanceof z.ZodString || schema instanceof z.ZodNumber
    || schema instanceof z.ZodBoolean || schema instanceof z.ZodNull
    || schema instanceof z.ZodEnum || schema instanceof z.ZodNativeEnum
    || (schema instanceof z.ZodLiteral && ['string', 'number', 'boolean'].includes(typeof schema.value));
}

/** Satu jalur structured output dan retry validasi untuk seluruh tahap LLM. */
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const MAX_RESPONSE_CACHE_ENTRIES = 64;

export class LlmAdapter {
  private readonly cacheScope: string;
  private readonly cacheTtlMs: number;
  private readonly provider: LlmProvider;
  private readonly model: string;
  constructor(options: LlmAdapterOptions = {}) {
    const env = options.env ?? process.env;
    const providerName = env.LLM_PROVIDER?.trim();
    const model = env.LLM_MODEL?.trim();
    if (!providerName || !model) throw new LlmError('CONFIG');
    this.model = model;
    this.cacheScope = createHash('sha256').update(JSON.stringify([providerName, model, env.LLM_API_KEY ?? ''])).digest('hex');
    this.cacheTtlMs = options.cacheTtlMs ?? (options.provider || options.fetchImpl || providerName === 'mock' ? 0 : 60_000);
    if (!Number.isFinite(this.cacheTtlMs) || this.cacheTtlMs < 0) throw new LlmError('CONFIG');
    if (options.provider) {
      if (options.provider.name !== providerName) throw new LlmError('CONFIG');
      this.provider = options.provider;
    } else if (providerName === 'mock' && options.mockOutputs) {
      this.provider = new MockLlmProvider(options.mockOutputs);
    } else if (providerName === 'openai' && env.LLM_API_KEY?.trim()) {
      this.provider = new OpenAiProvider(env.LLM_API_KEY, options.fetchImpl);
    } else if (providerName === 'gemini' && env.LLM_API_KEY?.trim()) {
      this.provider = new GeminiProvider(env.LLM_API_KEY.trim(), options.fetchImpl, undefined, options.onUsage);
    } else throw new LlmError('CONFIG');
  }

  async generate<S extends z.ZodTypeAny>(options: {
    schema: S; name: string; prompt: string; input: string; imageDataUrl?: string; videoDataUrl?: string; signal?: AbortSignal;
  }): Promise<z.infer<S>> {
    options.signal?.throwIfAborted();
    let cacheKey: string | undefined;
    if (this.cacheTtlMs > 0) {
      try {
        const schema = zodTextFormat(options.schema, options.name).schema;
        cacheKey = createHash('sha256').update(this.cacheScope).update(JSON.stringify({
          schema, name: options.name, prompt: options.prompt, input: options.input,
          image: options.imageDataUrl, video: options.videoDataUrl })).digest('hex');
      } catch { throw new LlmError('SCHEMA'); }
      const cached = responseCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        const parsed = options.schema.safeParse(structuredClone(cached.value));
        if (parsed.success) {
          console.info('[llm/cache]', { stage: options.name, model: this.model, hit: true });
          return parsed.data;
        }
      }
      responseCache.delete(cacheKey);
    }
    if (options.imageDataUrl !== undefined && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(options.imageDataUrl)
      || options.imageDataUrl.length > 4_200_000)) throw new LlmError('INPUT');
    if (options.videoDataUrl !== undefined && (!/^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+={0,2}$/.test(options.videoDataUrl)
      || options.videoDataUrl.length > 11_300_000)) throw new LlmError('INPUT');
    if (options.imageDataUrl && options.videoDataUrl) throw new LlmError('INPUT');
    let format: LlmRequest['format'];
    try {
      if (!(options.schema instanceof z.ZodObject) || !isStructuredSchema(options.schema)) throw new LlmError('SCHEMA');
      const generated = zodTextFormat(options.schema, options.name);
      format = { type: 'json_schema', name: generated.name, strict: true, schema: generated.schema };
    } catch { throw new LlmError('SCHEMA'); }
    let feedback: LlmValidationIssue[] = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      options.signal?.throwIfAborted();
      let output: unknown;
      try {
        output = await this.provider.complete({ model: this.model, prompt: options.prompt,
          input: options.input, format, attempt, feedback, signal: options.signal,
          ...(options.imageDataUrl ? { imageDataUrl: options.imageDataUrl } : {}),
          ...(options.videoDataUrl ? { videoDataUrl: options.videoDataUrl } : {}) });
      } catch (error) {
        if (error instanceof LlmError) throw error;
        // Jangan membawa pesan provider, raw response, atau key ke error/log produk.
        throw new LlmError('PROVIDER', attempt);
      }
      try {
        if (typeof output === 'string') output = JSON.parse(output);
      } catch {
        feedback = [{ path: '', code: 'invalid_json' }];
        continue;
      }
      const parsed = options.schema.safeParse(output);
      if (parsed.success) {
        options.signal?.throwIfAborted();
        if (cacheKey) {
          for (const [key, entry] of responseCache) if (entry.expiresAt <= Date.now()) responseCache.delete(key);
          if (responseCache.size >= MAX_RESPONSE_CACHE_ENTRIES) responseCache.delete(responseCache.keys().next().value!);
          responseCache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value: structuredClone(parsed.data) });
        }
        return parsed.data;
      }
      feedback = parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
    }
    throw new LlmError('INVALID_OUTPUT', 2);
  }
}
