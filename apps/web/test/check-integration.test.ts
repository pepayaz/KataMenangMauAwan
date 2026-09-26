import { resolve } from 'node:path';
import { loadWebPrompts } from '../lib/pipeline/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckResultSchema, TraceEventSchema, type TraceEvent } from '@cek-dulu/shared';
import { checkFixtures } from '../../../packages/shared/fixtures/index.js';
import { POST, GET } from '../app/api/check/route.js';
import { readCheckStream, type CheckStreamEvent } from '../lib/check-stream.js';
import { createTraceEmitter, encodeSse } from '../lib/sse.js';

const request = (body: unknown) => new Request('http://localhost/api/check', { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
afterEach(() => vi.unstubAllEnvs());
function enableDemo(): void {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('CHECK_FIXTURE_DEMO', '1');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  vi.stubEnv('LLM_PROVIDER', ''); vi.stubEnv('LLM_MODEL', '');
}
describe('route agent - SSE - UI', () => {
  it.each(checkFixtures)('mengalirkan $input.rawText sampai rapor', async fixture => {
    enableDemo(); const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Jaringan dilarang'));
    try {
      const events: CheckStreamEvent[] = [];
      await readCheckStream(await POST(request({ text: fixture.input.rawText, demo: true })), event => events.push(event));
      const traces = events.filter(event => event.kind === 'trace');
      traces.forEach(event => expect(TraceEventSchema.safeParse(event.value).success).toBe(true));
      expect(traces.map(event => event.value.stage)).toEqual(expect.arrayContaining(['normalize', 'extract', 'route', 'verify', 'hunt', 'adjudicate', 'done']));
      expect(events.at(-1)?.kind).toBe('result');
      const results = events.filter(event => event.kind === 'result'); expect(results).toHaveLength(1);
      const result = CheckResultSchema.parse(results[0]!.value);
      expect(result.verdicts[0]!.verdict).toBe(fixture.result.verdicts[0]!.verdict);
      expect(result.creditsUsed).toBe(0); expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
  it('health melaporkan agent dan cache_only meski env live', async () => {
    enableDemo(); vi.stubEnv('SECTORS_MODE', 'live');
    expect(await (await GET()).json()).toMatchObject({ mode: 'cache_only', pipeline: 'agent', fixtureDemo: true });
  });
  it('LLM belum dikonfigurasi mengirim error tanpa fixture otomatis', async () => {
    enableDemo(); const events: CheckStreamEvent[] = [];
    await readCheckStream(await POST(request({ text: checkFixtures[0]!.input.rawText })), event => events.push(event));
    expect(events).toHaveLength(1); expect(events[0]?.kind).toBe('error');
  });
  it('demo tidak aktif di produksi', async () => {
    enableDemo(); vi.stubEnv('NODE_ENV', 'production');
    expect((await POST(request({ text: checkFixtures[0]!.input.rawText, demo: true }))).status).toBe(403);
  });
  it('ticker pilihan tidak diabaikan', async () => {
    expect((await POST(request({ text: 'Adaro yield 25%', ticker: 'ADRO' }))).status).toBe(400);
  });
  it('menolak demo teks lain dan body kosong', async () => {
    enableDemo(); expect((await POST(request({ text: 'ADRO berbeda', demo: true }))).status).toBe(400);
    expect((await POST(request({ text: '' }))).status).toBe(400);
  });
  it('timestamp agen sama di stream dan persistensi', async () => {
    const saved: TraceEvent[] = [];
    const event: TraceEvent = { checkId: 'c', ts: '2026-09-23T00:00:00.000Z', stage: 'normalize', message: 'Saham dikenali.', credits: 0 };
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      const emitter = createTraceEmitter(controller, 'c', e => saved.push(e));
      emitter.emit(event); emitter.close(); controller.close();
    } });
    expect(await new Response(stream).text()).toContain(event.ts); expect(saved).toEqual([event]);
  });
});
function responseFor(text: string): Response {
  return new Response(new ReadableStream({ start(controller) {
    for (const byte of new TextEncoder().encode(text)) controller.enqueue(Uint8Array.of(byte)); controller.close();
  } }), { headers: { 'content-type': 'text/event-stream', 'x-check-id': 'c' } });
}
const encoded = (name: 'trace' | 'result' | 'error', data: unknown) => new TextDecoder().decode(encodeSse(name, data));
describe('kontrak parser UI', () => {
  it('done tetap menunggu result; ping, CRLF, dan byte UTF-8 ditangani', async () => {
    const text = 'event: ping\r\ndata: {}\r\n\r\n' + encoded('trace', {
      checkId: 'c', ts: 't', stage: 'done', message: 'Selesai — sah.' }) + encoded('result', { ...checkFixtures[0]!.result, checkId: 'c' });
    const events: CheckStreamEvent[] = []; await readCheckStream(responseFor(text), event => events.push(event));
    expect(events.map(event => event.kind)).toEqual(['trace', 'result']);
    expect(events[0]?.value).toMatchObject({ message: 'Selesai — sah.' });
  });
  it.each([
    ['tanpa terminal', encoded('trace', { checkId: 'c', ts: 't', stage: 'done', message: 'Selesai' })],
    ['id salah', encoded('error', { checkId: 'lain', message: 'Gagal' })],
    ['skema salah', encoded('trace', { checkId: 'c', stage: 'tidak_ada' })],
    ['JSON rusak', 'event: result\ndata: {\n\n'],
    ['terpotong', 'event: result\ndata: {}'],
    ['terminal ganda', encoded('error', { checkId: 'c', message: 'Gagal' }).repeat(2)],
  ])('menolak %s', async (_, text) => {
    await expect(readCheckStream(responseFor(text), () => undefined)).rejects.toThrow();
  });
});

describe('prompt di server Next', () => {
  it.each([process.cwd(), resolve(process.cwd(), 'apps/web')])('memuat file sumber dari cwd %s', async cwd => {
    const prompts = await loadWebPrompts(cwd);
    expect(prompts.extractor.length).toBeGreaterThan(100);
    expect(prompts.explainer.length).toBeGreaterThan(100);
  });
  it('gagal terkontrol jika file prompt tidak tersedia', async () => {
    await expect(loadWebPrompts(resolve(process.cwd(), 'missing/deep/directory'))).rejects.toThrow('Prompt agen tidak tersedia.');
  });
});
