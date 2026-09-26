import { describe, expect, it, vi } from 'vitest';
import { EntitySchema } from '@cek-dulu/shared';
import { cleanText, createFixtureTickerDirectory, fuzzySimilarity, normalizeText,
  type TickerDirectory } from '../src/normalizer.js';
import { LlmAdapter, MockLlmProvider } from '../src/llm.js';

function mock(outputs: unknown[]) {
  const provider = new MockLlmProvider(outputs);
  const llm = new LlmAdapter({ env: { LLM_PROVIDER: 'mock', LLM_MODEL: 'uji' }, provider });
  return { provider, llm };
}

describe('normalizer: eksplisit lalu alias B', () => {
  it('membersihkan teks tanpa merusak angka atau tanda saham', () => {
    expect(cleanText(' \uFEFF$ADRO\u200B\t Rp1.358,18\r\n−0,90\u00A0% ')).toBe('$ADRO Rp1.358,18\n−0,90 %');
  });
  it.each(['$ADRO', '#BBRI', '$adro', 'ADRO'])('mengenali %s tanpa LLM', async (text) => {
    const opts = mock([]), result = await normalizeText(text, opts);
    expect(result.status).toBe('ready');
    expect(result.entities[0]?.method).toBe('explicit');
    expect(result.entities.every((e) => EntitySchema.safeParse(e).success)).toBe(true);
    expect(opts.provider.requests).toHaveLength(0);
  });
  it.each([['Adaro', 'ADRO'], ['bank mandiri', 'BMRI'], ['bank central asia', 'BBCA']])('alias %s', async (text, ticker) => {
    const opts = mock([]), result = await normalizeText(text!, opts);
    expect(result.entities).toEqual([expect.objectContaining({ ticker, method: 'alias' })]);
    expect(opts.provider.requests).toHaveLength(0);
  });
  it('eksplisit mengungguli alias ticker yang sama dan tetap menemukan saham kedua', async () => {
    const result = await normalizeText('$ADRO Adaro dan bank bri');
    expect(result.entities).toEqual([expect.objectContaining({ ticker: 'ADRO', method: 'explicit' }),
      expect.objectContaining({ ticker: 'BBRI', method: 'alias' })]);
  });
  it('kode kapital biasa bukan emiten', async () => {
    expect((await normalizeText('SAYA JUGA')).entities).toEqual([]);
  });
  it('kode bertanda tidak dikenal memerlukan pilihan, tidak menjadi entitas', async () => {
    const result = await normalizeText('$ZZZZ');
    expect(result.status).toBe('needs_user_choice');
    expect(result.entities).toEqual([]);
    expect(result.choices[0]?.reason).toBe('unknown_ticker');
  });
  it('alias berbobot lemah tetap meminta pilihan walau saham lain pasti', async () => {
    const directory = createFixtureTickerDirectory({ tickers: ['ADRO', 'BREN'], aliases: [
      { alias: 'prajogo', ticker: 'BREN', weight: 0.6 }] });
    const result = await normalizeText('$ADRO prajogo', { directory });
    expect(result.status).toBe('needs_user_choice');
    expect(result.entities.map((e) => e.ticker)).toEqual(['ADRO']);
    expect(result.choices[0]?.candidates[0]?.ticker).toBe('BREN');
  });
  it('alias bentrok tidak memilih entri pertama secara diam-diam', async () => {
    const directory = createFixtureTickerDirectory({ tickers: ['ADRO', 'PTBA'], aliases: [
      { alias: 'bara', ticker: 'ADRO', weight: 1 }, { alias: 'bara', ticker: 'PTBA', weight: 1 }] });
    const result = await normalizeText('bara', { directory });
    expect(result.entities).toEqual([]);
    expect(result.choices[0]?.reason).toBe('ambiguous_alias');
    expect(result.choices[0]?.candidates).toHaveLength(2);
  });
  it('daftar B dan loadAliases dapat disuntikkan', async () => {
    const search = vi.fn(async () => []);
    const directory: TickerDirectory = { tickers: new Set(['ZZZZ']),
      aliases: [{ alias: 'perusahaan zeta', ticker: 'ZZZZ', weight: 1 }], search };
    const result = await normalizeText('perusahaan zeta', { directory });
    expect(result.entities[0]?.ticker).toBe('ZZZZ');
    expect(search).not.toHaveBeenCalled();
  });
  it('alias panjang tidak dikalahkan bentrok alias pendek di dalamnya', async () => {
    const directory = createFixtureTickerDirectory({ tickers: ['BBRI', 'BMRI'], aliases: [
      { alias: 'bank', ticker: 'BBRI', weight: 1 }, { alias: 'bank', ticker: 'BMRI', weight: 1 },
      { alias: 'bank mandiri', ticker: 'BMRI', weight: 1 }] });
    const result = await normalizeText('bank mandiri', { directory });
    expect(result.status).toBe('ready');
    expect(result.entities[0]?.ticker).toBe('BMRI');
  });
});

describe('fuzzy sementara dan LLM terbatas', () => {
  it('similaritas deterministik dan empty tidak cocok', () => {
    expect(fuzzySimilarity('', '')).toBe(0);
    expect(fuzzySimilarity('Adaro', 'adaro')).toBe(1);
    expect(fuzzySimilarity('Adarro', 'adaro')).toBeCloseTo(5 / 6);
  });
  it('fixture search mengurutkan, membatasi, dan menolak yang tidak relevan', async () => {
    const directory = createFixtureTickerDirectory();
    expect((await directory.search('Adarro', 1))[0]?.ticker).toBe('ADRO');
    expect(await directory.search('xyzxyzxyz', 10)).toEqual([]);
    expect(await directory.search('Adarro', 0)).toEqual([]);
  });
  it('typo memakai LLM memilih kandidat yang ada', async () => {
    const opts = mock([{ ticker: 'ADRO', confidence: 0.8 }]);
    const result = await normalizeText('Adarro', opts);
    expect(result.status).toBe('ready');
    expect(result.entities[0]).toMatchObject({ surface: 'Adarro', ticker: 'ADRO', method: 'llm', confidence: 0.8 });
    expect(JSON.parse(opts.provider.requests[0]!.input).candidates[0].ticker).toBe('ADRO');
  });
  it('tanpa LLM, kandidat tersedia untuk pengguna', async () => {
    const result = await normalizeText('Adarro');
    expect(result.status).toBe('needs_user_choice');
    expect(result.choices[0]?.reason).toBe('no_llm');
  });
  it.each([0, 0.69, 0.7])('threshold confidence %s', async (confidence) => {
    const opts = mock([{ ticker: 'ADRO', confidence }]);
    const result = await normalizeText('Adarro', opts);
    expect(result.status).toBe(confidence < 0.7 ? 'needs_user_choice' : 'ready');
    expect(result.entities).toHaveLength(confidence < 0.7 ? 0 : 1);
  });
  it.each(['PTBA', null])('pilihan %s tidak boleh keluar dari daftar', async (ticker) => {
    const opts = mock([{ ticker, confidence: 1 }]);
    const result = await normalizeText('Adarro', opts);
    expect(result.entities).toEqual([]);
    expect(result.choices[0]?.reason).toBe('invalid_selection');
  });
  it('failure adapter menjadi pilihan pengguna', async () => {
    const opts = mock([new Error('provider unavailable')]);
    const result = await normalizeText('Adarro', opts);
    expect(result.choices[0]?.reason).toBe('llm_error');
  });
  it('memotong kandidat B menjadi maksimal sepuluh dan menghapus duplikasi/unknown', async () => {
    const tickers = Array.from({ length: 12 }, (_, i) => `AA${String.fromCharCode(65 + i)}A`);
    const directory: TickerDirectory = { tickers: new Set(tickers), aliases: [], search: vi.fn(async () => [
      { ticker: 'ZZZZ', label: 'invalid', score: 1 },
      ...tickers.map((ticker) => ({ ticker, label: ticker, score: 0.8 })),
      { ticker: tickers[0]!, label: 'duplicate', score: 1 }]) };
    const opts = mock([{ ticker: tickers[0], confidence: 1 }]);
    await normalizeText('misteri', { ...opts, directory });
    const candidates = JSON.parse(opts.provider.requests[0]!.input).candidates;
    expect(candidates).toHaveLength(10);
    expect(new Set(candidates.map((c: { ticker: string }) => c.ticker)).size).toBe(10);
    expect(directory.search).toHaveBeenCalledWith('misteri', 10);
  });
  it('surface multi-kata disuntikkan dan tidak dihasilkan dari teks yang tidak ada', async () => {
    const opts = mock([{ ticker: 'BBRI', confidence: 1 }]);
    const result = await normalizeText('Bank rakya indonesia', { ...opts, unresolvedSurfaces: ['Bank rakya indonesia', 'palsu'] });
    expect(result.entities[0]?.ticker).toBe('BBRI');
    expect(opts.provider.requests).toHaveLength(1);
  });
});
