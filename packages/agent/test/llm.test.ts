import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LlmAdapter, LlmError, MockLlmProvider } from '../src/llm.js';

const env = { LLM_PROVIDER: 'mock', LLM_MODEL: 'model-pengujian' };
const schema = z.object({ value: z.number() }).strict();
const request = { schema, name: 'test_result', prompt: 'Ekstrak angka.', input: 'Angka 3.' };

describe('adapter structured output', () => {
  it.each([{ value: 3 }, '{"value":3}'])('memvalidasi respons object atau JSON: %s', async (output) => {
    const provider = new MockLlmProvider([output]);
    const adapter = new LlmAdapter({ env, provider });
    expect(await adapter.generate(request)).toEqual({ value: 3 });
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]).toMatchObject({ model: env.LLM_MODEL, attempt: 1, feedback: [],
      format: { type: 'json_schema', strict: true, schema: { type: 'object',
        properties: { value: { type: 'number' } }, required: ['value'], additionalProperties: false } } });
  });

  it.each(['not json', { value: 'salah' }, {}, { value: 3, extra: true }])
  ('retry sekali sesudah respons invalid %s', async (output) => {
    const provider = new MockLlmProvider([output, { value: 3 }]);
    expect(await new LlmAdapter({ env, provider }).generate(request)).toEqual({ value: 3 });
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.feedback.length).toBeGreaterThan(0);
  });

  it('berhenti dengan error terkontrol sesudah dua kegagalan', async () => {
    const provider = new MockLlmProvider(['{', { value: null }, { value: 3 }]);
    await expect(new LlmAdapter({ env, provider }).generate(request)).rejects.toMatchObject({ code: 'INVALID_OUTPUT', attempts: 2 });
    expect(provider.requests).toHaveLength(2);
  });

  it('kesalahan provider tidak bocor atau di-retry sebagai kesalahan validasi', async () => {
    const provider = new MockLlmProvider([new Error('pesan privat provider')]);
    const adapter = new LlmAdapter({ env, provider });
    await expect(adapter.generate(request)).rejects.toThrow('LLM gagal secara terkontrol: PROVIDER.');
    expect(provider.requests).toHaveLength(1);
  });

  it('schema non-JSON ditolak sebelum memanggil provider', async () => {
    const provider = new MockLlmProvider([]);
    await expect(new LlmAdapter({ env, provider }).generate({ ...request,
      schema: z.object({ test: z.function() }) })).rejects.toMatchObject({ code: 'SCHEMA', attempts: 0 });
    expect(provider.requests).toHaveLength(0);
  });

  it.each([z.array(z.string()), z.object({ date: z.date() })])
  ('schema di luar subset strict %# ditolak sebelum provider', async (unsupported) => {
    const provider = new MockLlmProvider([]);
    await expect(new LlmAdapter({ env, provider }).generate({ ...request,
      schema: unsupported })).rejects.toMatchObject({ code: 'SCHEMA' });
    expect(provider.requests).toHaveLength(0);
  });

  it.each([{}, { LLM_PROVIDER: 'mock' }, { LLM_MODEL: 'test' },
    { LLM_PROVIDER: 'openai', LLM_MODEL: 'test' }, { LLM_PROVIDER: 'unknown', LLM_MODEL: 'test' }])
  ('env invalid %# menghasilkan CONFIG', (invalidEnv) => {
    expect(() => new LlmAdapter({ env: invalidEnv })).toThrow(LlmError);
  });

  it('provider suntikan harus sesuai env', () => {
    expect(() => new LlmAdapter({ env: { ...env, LLM_PROVIDER: 'other' }, provider: new MockLlmProvider([]) })).toThrow(LlmError);
  });

  it('mock env dan mockOutputs bekerja tanpa key atau jaringan', async () => {
    const network = vi.fn(() => { throw new Error('Jaringan dilarang.'); });
    expect(await new LlmAdapter({ env, mockOutputs: [{ value: 3 }], fetchImpl: network }).generate(request)).toEqual({ value: 3 });
    expect(network).not.toHaveBeenCalled();
  });

  it('mock menyalin respons dan record request tanpa berbagi objek mutable', async () => {
    const output = { value: 3 };
    const provider = new MockLlmProvider([output]);
    const result = await new LlmAdapter({ env, provider }).generate(request);
    result.value = 99;
    expect(output.value).toBe(3);
    expect(provider.requests[0]).not.toHaveProperty('apiKey');
  });
});

describe('provider OpenAI dengan HTTP stub, nol jaringan', () => {
  const liveEnv = { LLM_PROVIDER: 'openai', LLM_MODEL: 'model-dari-env', LLM_API_KEY: 'dummy-unit-test' };
  const response = (output: unknown, status = 'completed') => new Response(JSON.stringify({
    id: 'test-response', object: 'response', status, output,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  it('mengirim JSON schema dari Zod, model env, dan tidak menyimpan respons', async () => {
    const fetchImpl = vi.fn(async () => response([{ type: 'message', id: 'm1', role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text: '{"value":3}', annotations: [] }] }]));
    expect(await new LlmAdapter({ env: liveEnv, fetchImpl }).generate(request)).toEqual({ value: 3 });
    const outgoing = fetchImpl.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    const body = JSON.parse(outgoing[1].body as string);
    expect(body).toMatchObject({ model: liveEnv.LLM_MODEL, store: false, text: { format: { type: 'json_schema', strict: true } } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('refusal menjadi error terkontrol tanpa retry', async () => {
    const fetchImpl = vi.fn(async () => response([{ type: 'message', id: 'm1', role: 'assistant', status: 'completed',
      content: [{ type: 'refusal', refusal: 'Pesan tidak disalin ke error.' }] }]));
    await expect(new LlmAdapter({ env: liveEnv, fetchImpl }).generate(request)).rejects.toMatchObject({ code: 'REFUSED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('respons incomplete tidak dianggap JSON valid', async () => {
    const fetchImpl = vi.fn(async () => response([], 'incomplete'));
    await expect(new LlmAdapter({ env: liveEnv, fetchImpl }).generate(request)).rejects.toMatchObject({ code: 'INCOMPLETE' });
  });
  it('retry validasi mengirim feedback pada panggilan kedua', async () => {
    const message = (text: string) => [{ type: 'message', id: 'm1', role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text, annotations: [] }] }];
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(message('{}')))
      .mockResolvedValueOnce(response(message('{"value":3}')));
    expect(await new LlmAdapter({ env: liveEnv, fetchImpl }).generate(request)).toEqual({ value: 3 });
    const body = JSON.parse(fetchImpl.mock.calls[1]![1].body as string);
    expect(body.input.at(-1).content).toContain('invalid_type');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
