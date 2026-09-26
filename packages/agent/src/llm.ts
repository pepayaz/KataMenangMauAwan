import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export type LlmErrorCode = 'CONFIG' | 'SCHEMA' | 'PROVIDER' | 'REFUSED' | 'INCOMPLETE' | 'INVALID_OUTPUT';
export class LlmError extends Error {
  constructor(readonly code: LlmErrorCode, readonly attempts = 0) {
    super(`LLM gagal secara terkontrol: ${code}.`);
    this.name = 'LlmError';
  }
}
export type LlmValidationIssue = { path: string; code: string };
export type LlmRequest = {
  model: string;
  prompt: string;
  input: string;
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
    this.client = new OpenAI({ apiKey, maxRetries: 0, timeout: 30000,
      ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  }
  async complete(request: LlmRequest): Promise<unknown> {
    const response = await this.client.responses.create({
      model: request.model, store: false,
      input: [
        { role: 'system', content: request.prompt },
        { role: 'user', content: request.input },
        ...(request.feedback.length > 0 ? [{ role: 'user' as const,
          content: `Keluaran sebelumnya tidak valid. Perbaiki JSON sesuai skema; jangan menambah fakta. Kesalahan: ${JSON.stringify(request.feedback)}` }] : []),
      ],
      text: { format: request.format },
    }, { signal: request.signal });
    const refused = response.output.some((item) => item.type === 'message'
      && item.content.some((content) => content.type === 'refusal'));
    if (refused) throw new LlmError('REFUSED', request.attempt);
    if (response.status !== 'completed') throw new LlmError('INCOMPLETE', request.attempt);
    return response.output_text;
  }
}

export type LlmAdapterOptions = {
  env?: Readonly<Record<string, string | undefined>>;
  provider?: LlmProvider;
  mockOutputs?: readonly unknown[];
  fetchImpl?: typeof fetch;
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
export class LlmAdapter {
  private readonly provider: LlmProvider;
  private readonly model: string;
  constructor(options: LlmAdapterOptions = {}) {
    const env = options.env ?? process.env;
    const providerName = env.LLM_PROVIDER?.trim();
    const model = env.LLM_MODEL?.trim();
    if (!providerName || !model) throw new LlmError('CONFIG');
    this.model = model;
    if (options.provider) {
      if (options.provider.name !== providerName) throw new LlmError('CONFIG');
      this.provider = options.provider;
    } else if (providerName === 'mock' && options.mockOutputs) {
      this.provider = new MockLlmProvider(options.mockOutputs);
    } else if (providerName === 'openai' && env.LLM_API_KEY?.trim()) {
      this.provider = new OpenAiProvider(env.LLM_API_KEY, options.fetchImpl);
    } else throw new LlmError('CONFIG');
  }

  async generate<S extends z.ZodTypeAny>(options: {
    schema: S; name: string; prompt: string; input: string; signal?: AbortSignal;
  }): Promise<z.infer<S>> {
    let format: LlmRequest['format'];
    try {
      if (!(options.schema instanceof z.ZodObject) || !isStructuredSchema(options.schema)) throw new LlmError('SCHEMA');
      const generated = zodTextFormat(options.schema, options.name);
      format = { type: 'json_schema', name: generated.name, strict: true, schema: generated.schema };
    } catch { throw new LlmError('SCHEMA'); }
    let feedback: LlmValidationIssue[] = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let output: unknown;
      try {
        output = await this.provider.complete({ model: this.model, prompt: options.prompt,
          input: options.input, format, attempt, feedback, signal: options.signal });
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
      if (parsed.success) return parsed.data;
      feedback = parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
    }
    throw new LlmError('INVALID_OUTPUT', 2);
  }
}
