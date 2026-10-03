import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LlmAdapter, LlmError, MockLlmProvider, isLlmConfigured } from '../src/llm.js';

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

describe('structured output dengan input gambar', () => {
  it('mock menyimpan gambar yang sama pada retry validasi', async () => {
    const provider = new MockLlmProvider([{}, { value: 3 }]);
    const imageDataUrl = 'data:image/png;base64,aGVsbG8=';
    expect(await new LlmAdapter({ env, provider }).generate({ ...request, imageDataUrl })).toEqual({ value: 3 });
    expect(provider.requests.map(request => request.imageDataUrl)).toEqual([imageDataUrl,imageDataUrl]);
  });
  it.each(['https://private.invalid/image.png', 'data:image/svg+xml;base64,aA==', 'data:image/png;base64,', 'data:image/png;base64,' + 'A'.repeat(4_200_000)])('menolak input gambar invalid sebelum provider %#', async imageDataUrl => {
    const provider = new MockLlmProvider([]);
    await expect(new LlmAdapter({ env, provider }).generate({ ...request, imageDataUrl })).rejects.toMatchObject({ code: 'INPUT' });
    expect(provider.requests).toHaveLength(0);
  });
  it('mengirim input_image dan input_text ke Responses tanpa jaringan', async () => {
    const network = vi.fn(async () => Response.json({ id: 'r', object: 'response', status: 'completed', output: [
      { type: 'message', id: 'm', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"value":3}', annotations: [] }] }] }));
    await new LlmAdapter({ env: { LLM_PROVIDER:'openai', LLM_MODEL:'test-model', LLM_API_KEY:'dummy-unit-test' }, fetchImpl: network })
      .generate({ ...request, imageDataUrl:'data:image/png;base64,aA==' });
    const call = network.mock.calls[0] as unknown as [RequestInfo, RequestInit];
    expect(JSON.parse(String(call[1].body)).input[1].content).toEqual([
      { type:'input_text', text:request.input }, { type:'input_image', image_url:'data:image/png;base64,aA==', detail:'high' }]);
  });
});

describe('provider gemini', () => {
  const geminiEnv = { LLM_PROVIDER: 'gemini', LLM_MODEL: 'gemini-uji', LLM_API_KEY: 'dummy-unit-test' };
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  const ok = (text: string, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });

  it('mengirim schema JSON, prompt sistem, dan key lewat header', async () => {
    const fetchImpl = reply(ok('{"value":3}'));
    expect(await new LlmAdapter({ env: geminiEnv, fetchImpl }).generate(request)).toEqual({ value: 3 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-uji:generateContent');
    expect(url).not.toContain('dummy-unit-test');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('dummy-unit-test');
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toBe(request.prompt);
    expect(body.contents[0].parts).toEqual([{ text: request.input }]);
    expect(body.generationConfig).toMatchObject({ responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object', required: ['value'], additionalProperties: false } });
  });

  it('gambar dikirim sebagai inlineData dan feedback retry ikut terkirim', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(ok('bukan json'))))
      .mockResolvedValueOnce(new Response(JSON.stringify(ok('{"value":3}'))));
    const imageDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    expect(await new LlmAdapter({ env: geminiEnv, fetchImpl }).generate({ ...request, imageDataUrl })).toEqual({ value: 3 });
    const second = JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body));
    expect(second.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } });
    expect(second.contents[0].parts[2].text).toContain('invalid_json');
  });
  it('video dikirim sebagai inlineData ke Gemini dengan schema JSON', async () => {
    const fetchImpl = reply(ok('{"value":3}'));
    const videoDataUrl = 'data:video/mp4;base64,AAAAFGZ0eXBpc29t';
    expect(await new LlmAdapter({ env: geminiEnv, fetchImpl }).generate({ ...request, videoDataUrl })).toEqual({ value: 3 });
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'video/mp4', data: 'AAAAFGZ0eXBpc29t' } });
    expect(body.generationConfig.responseJsonSchema.type).toBe('object');
    expect(body.generationConfig.temperature).toBe(0);
  });
  it('provider lain dan format video tidak valid ditolak terkontrol', async () => {
    await expect(new LlmAdapter({ env: geminiEnv, fetchImpl: reply(ok('{"value":3}')) }).generate({ ...request,
      videoDataUrl:'data:video/avi;base64,AAAA' })).rejects.toMatchObject({ code:'INPUT' });
    await expect(new LlmAdapter({ env:{LLM_PROVIDER:'openai',LLM_MODEL:'x',LLM_API_KEY:'dummy-unit-test'} }).generate({ ...request,
      videoDataUrl:'data:video/mp4;base64,AAAA' })).rejects.toMatchObject({ code:'INPUT' });
  });

  it('bagian thought diabaikan', async () => {
    const fetchImpl = reply({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { text: 'menimbang...', thought: true }, { text: '{"value":3}' }] } }] });
    expect(await new LlmAdapter({ env: geminiEnv, fetchImpl }).generate(request)).toEqual({ value: 3 });
  });

  it.each([
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 'REFUSED'],
    [ok('', 'SAFETY'), 'REFUSED'],
    [ok('{"val', 'MAX_TOKENS'), 'INCOMPLETE'],
    [{ candidates: [] }, 'INCOMPLETE'],
  ])('respons %# dipetakan ke error terkontrol', async (body, code) => {
    await expect(new LlmAdapter({ env: geminiEnv, fetchImpl: reply(body) }).generate(request)).rejects.toMatchObject({ code });
  });

  it('HTTP 503 sementara dicoba ulang lalu berhasil', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn()
        .mockResolvedValueOnce(new Response('{}', { status: 503 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(ok('{"value":3}'))));
      const pending = new LlmAdapter({ env: geminiEnv, fetchImpl }).generate(request);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await pending).toEqual({ value: 3 });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it('503 terus-menerus menjadi UNAVAILABLE sesudah retry tanpa membocorkan isi respons', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = reply({ error: { message: 'pesan privat provider' } }, 503);
      const pending = new LlmAdapter({ env: geminiEnv, fetchImpl }).generate(request).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(20000);
      const error = await pending;
      expect(error).toMatchObject({ code: 'UNAVAILABLE' });
      expect(String((error as Error).message)).not.toContain('privat');
      expect(fetchImpl).toHaveBeenCalledTimes(5);
    } finally { vi.useRealTimers(); }
  });

  it('batas waktu adapter menjadi TIMEOUT tanpa retry', async () => {
    const fetchImpl = vi.fn(async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); });
    const error = await new LlmAdapter({ env: geminiEnv, fetchImpl }).generate(request).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'TIMEOUT' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('pembatalan pengguna tidak dilaporkan sebagai TIMEOUT', async () => {
    const abort = new AbortController(); abort.abort();
    const fetchImpl = vi.fn(async () => { throw new DOMException('aborted', 'TimeoutError'); });
    const error = await new LlmAdapter({ env: geminiEnv, fetchImpl }).generate({ ...request, signal: abort.signal }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'PROVIDER' });
  });

  it('429 kuota habis langsung QUOTA tanpa retry', async () => {
    const fetchImpl = reply({ error: { message: 'You exceeded your current quota' } }, 429);
    const error = await new LlmAdapter({ env: geminiEnv, fetchImpl }).generate(request).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'QUOTA' });
    expect(String((error as Error).message)).not.toContain('exceeded');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('HTTP 400 tidak dicoba ulang', async () => {
    const fetchImpl = reply({ error: { message: 'schema salah' } }, 400);
    await expect(new LlmAdapter({ env: geminiEnv, fetchImpl }).generate(request)).rejects.toMatchObject({ code: 'PROVIDER' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gemini tanpa key ditolak sebagai CONFIG dan isLlmConfigured mengenali provider live', () => {
    expect(() => new LlmAdapter({ env: { LLM_PROVIDER: 'gemini', LLM_MODEL: 'x' } })).toThrow(LlmError);
    expect(isLlmConfigured(geminiEnv)).toBe(true);
    expect(isLlmConfigured({ ...geminiEnv, LLM_PROVIDER: 'openai' })).toBe(true);
    expect(isLlmConfigured({ ...geminiEnv, LLM_PROVIDER: 'mock' })).toBe(false);
    expect(isLlmConfigured({ LLM_PROVIDER: 'gemini', LLM_MODEL: 'x' })).toBe(false);
  });
});
