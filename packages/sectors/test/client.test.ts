import { describe, expect, it, vi } from 'vitest';
import { SectorsClient } from '../src/client.js';
import { MemoryCacheStore } from '../src/cache/memory.js';
import { MemoryLedgerStore } from '../src/ledger/memory.js';
import { cacheKey } from '../src/cache/types.js';
import { TTL } from '../src/endpoints.js';
import { SectorsError } from '../src/errors.js';
import { Recorder } from '../src/recorder.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(opts: {
  mode?: 'live' | 'cache_only' | 'replay';
  fetchImpl?: typeof fetch;
  budgetPerCheck?: number;
  cache?: MemoryCacheStore;
  ledger?: MemoryLedgerStore;
  today?: string;
}) {
  const cache = opts.cache ?? new MemoryCacheStore();
  const ledger = opts.ledger ?? new MemoryLedgerStore();
  const client = new SectorsClient({
    cache,
    ledger,
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    // Perekam dimatikan: tanpa ini klien mode live akan menulis berkas rekaman
    // ke direktori kerja setiap kali uji dijalankan.
    recorder: new Recorder('', 'off'),
    ...(opts.today ? { today: () => opts.today! } : {}),
    config: {
      mode: opts.mode ?? 'live',
      apiKey: 'kunci-uji',
      baseUrl: 'https://api.sectors.app',
      budgetPerCheck: opts.budgetPerCheck ?? 40,
      member: 'B',
      maxRetries: 0,
    },
  });
  return { client, cache, ledger };
}

describe('SectorsClient — cache lebih dulu', () => {
  it('tidak memanggil jaringan bila cache masih segar', async () => {
    const cache = new MemoryCacheStore();
    cache.seed({
      key: cacheKey('fetchListingPerformance', { symbol: 'ADRO' }),
      endpoint: 'fetchListingPerformance',
      params: { symbol: 'ADRO' },
      response: { symbol: 'ADRO.JK', chg_30d: 4.2 },
      fetchedAt: new Date().toISOString(),
      ttlSeconds: TTL.profile,
    });
    const fetchImpl = vi.fn();
    const { client, ledger } = makeClient({ cache, fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.fetchListingPerformance('ADRO');

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.credits).toBe(0);
    // Bab 6.1: setiap panggilan dicatat, termasuk yang dilayani cache.
    expect(ledger.all()).toHaveLength(1);
    expect(ledger.all()[0]?.cached).toBe(true);
  });

  it('memanggil jaringan lagi bila cache sudah lewat TTL', async () => {
    const cache = new MemoryCacheStore();
    cache.seed({
      key: cacheKey('fetchListingPerformance', { symbol: 'ADRO' }),
      endpoint: 'fetchListingPerformance',
      params: { symbol: 'ADRO' },
      response: { stale: true },
      fetchedAt: new Date(Date.now() - 999 * 1000).toISOString(),
      ttlSeconds: 10,
    });
    const fetchImpl = vi.fn(async () => jsonResponse({ symbol: 'ADRO.JK', chg_30d: 9 }));
    const { client } = makeClient({ cache, fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.fetchListingPerformance('ADRO');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
    expect(result.data.chg_30d).toBe(9);
  });
});

describe('SectorsClient — mode', () => {
  it('mode cache_only tidak pernah menyentuh jaringan', async () => {
    const fetchImpl = vi.fn();
    const { client } = makeClient({
      mode: 'cache_only',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.fetchListingPerformance('ADRO')).rejects.toThrowError(SectorsError);
    await expect(client.fetchListingPerformance('ADRO')).rejects.toMatchObject({
      code: 'CACHE_MISS',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('mode replay memutar rekaman tanpa kredit', async () => {
    const key = cacheKey('fetchListingPerformance', { symbol: 'ADRO' });
    const recorder = new Recorder('', 'replay');
    recorder.seed([
      {
        key,
        endpoint: 'fetchListingPerformance',
        params: { symbol: 'ADRO' },
        response: { symbol: 'ADRO.JK', chg_30d: 1.5 },
        ts: '2026-09-24T00:00:00.000Z',
      },
    ]);

    const fetchImpl = vi.fn();
    const client = new SectorsClient({
      cache: new MemoryCacheStore(),
      ledger: new MemoryLedgerStore(),
      recorder,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      config: { mode: 'replay', apiKey: 'kunci-uji', member: 'B' },
    });

    const result = await client.fetchListingPerformance('ADRO');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.credits).toBe(0);
    expect(result.cached).toBe(true);
    expect(result.data.chg_30d).toBe(1.5);
  });

  it('mode replay menolak panggilan yang tidak ada di rekaman', async () => {
    const recorder = new Recorder('', 'replay');
    recorder.seed([]);
    const client = new SectorsClient({
      cache: new MemoryCacheStore(),
      ledger: new MemoryLedgerStore(),
      recorder,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      config: { mode: 'replay', apiKey: 'kunci-uji', member: 'B' },
    });

    await expect(client.fetchListingPerformance('BBRI')).rejects.toMatchObject({
      code: 'REPLAY_MISS',
    });
  });
});

describe('SectorsClient — kredit dan anggaran', () => {
  it('menagih satu kredit per section laporan', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ symbol: 'ADRO.JK', dividend: {} }));
    const { client, ledger } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.fetchCompanyReport('ADRO', ['dividend', 'valuation']);

    expect(result.credits).toBe(2);
    expect(ledger.all()[0]?.credits).toBe(2);
  });

  it('menagih per kuartal yang benar-benar kembali', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([{ date: '2026-03-31' }, { date: '2025-12-31' }, { date: '2025-09-30' }]),
    );
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.fetchQuarterlyFinancials('ADRO', { n_quarters: 5 });
    expect(result.credits).toBe(3);
  });

  it('menolak panggilan yang melewati anggaran cek sebelum menyentuh jaringan', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const { client } = makeClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      budgetPerCheck: 3,
    });

    await client.fetchCompanyReport('ADRO', ['dividend', 'valuation'], { checkId: 'cek-1' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(
      client.fetchCompanyReport('BBRI', ['dividend', 'valuation'], { checkId: 'cek-1' }),
    ).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
    // Panggilan kedua ditolak sebelum jaringan dipakai: kredit tidak terbakar.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('anggaran dihitung per cek, bukan global', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const { client } = makeClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      budgetPerCheck: 3,
    });

    await client.fetchCompanyReport('ADRO', ['dividend', 'valuation'], { checkId: 'cek-1' });
    await client.fetchCompanyReport('ADRO', ['dividend', 'overview'], { checkId: 'cek-2' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('SectorsClient — pemecahan jendela', () => {
  it('memecah 180 hari menjadi dua panggilan dan menggabungkan hasilnya', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      const start = u.searchParams.get('start')!;
      return jsonResponse([{ symbol: 'ADRO.JK', date: start, close: 100, volume: 1 }]);
    });
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.fetchDailyPrice('ADRO', { start: '2026-01-01', end: '2026-06-29' });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.credits).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data.map((r) => r.date)).toEqual(['2026-01-01', '2026-04-01']);
  });

  it('memecah broker summary pada batas 14 hari', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      const start = u.searchParams.get('start')!;
      return jsonResponse({
        symbol: 'ADRO.JK',
        start,
        end: start,
        data: [{ date: start, summary: [] }],
      });
    });
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.fetchBrokerSummary('ADRO', { start: '2026-01-01', end: '2026-01-31' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('membuang hari yang muncul dua kali di batas potongan', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { symbol: 'ADRO.JK', date: '2026-01-05', close: 1, volume: 1 },
        { symbol: 'ADRO.JK', date: '2026-01-05', close: 1, volume: 1 },
      ]),
    );
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.fetchDailyPrice('ADRO', { start: '2026-01-01', end: '2026-01-10' });
    expect(result.data).toHaveLength(1);
  });
});

describe('SectorsClient — galat', () => {
  it('menandai 404 sebagai data tidak ditemukan dan tetap menagih satu kredit', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'tidak ada' }, 404));
    const { client, ledger } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.fetchListingPerformance('ZZZZ')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(ledger.all()[0]?.credits).toBe(1);
  });

  it('tidak menagih kredit untuk galat server', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'aduh' }, 500));
    const { client, ledger } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.fetchListingPerformance('ADRO')).rejects.toMatchObject({
      code: 'SERVER_ERROR',
    });
    expect(ledger.all()[0]?.credits).toBe(0);
  });

  it('mengirim kunci API di header Authorization', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('kunci-uji');
      return jsonResponse({});
    });
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.fetchListingPerformance('ADRO');
    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe('SectorsClient — cache company-report per section', () => {
  it('kombinasi section lain memakai ulang section yang sudah ditarik', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const sections = new URL(String(url)).searchParams.get('sections')!.split(',');
      return jsonResponse({ symbol: 'ADRO.JK', company_name: 'Alamtri',
        ...Object.fromEntries(sections.map((s) => [s, { asal: s }])) });
    });
    const { client, cache } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.fetchCompanyReport('ADRO', ['overview', 'valuation', 'dividend']);
    const only = await client.fetchCompanyReport('ADRO', ['dividend']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(only).toMatchObject({ credits: 0, cached: true, params: { symbol: 'ADRO', sections: ['dividend'] } });
    expect(only.data).toEqual({ symbol: 'ADRO.JK', company_name: 'Alamtri', dividend: { asal: 'dividend' } });
    expect(await cache.get(cacheKey('fetchCompanyReport', { symbol: 'ADRO', sections: ['valuation'] }))).toBeTruthy();

    // Hanya section yang belum ada yang ditarik dan ditagih.
    const mixed = await client.fetchCompanyReport('ADRO', ['valuation', 'peers']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchImpl.mock.calls[1]![0])).searchParams.get('sections')).toBe('peers');
    expect(mixed.credits).toBe(1);
    expect(mixed.cached).toBe(false);
    expect(Object.keys(mixed.data).sort()).toEqual(['company_name', 'peers', 'symbol', 'valuation']);
  });

  it('cache_only membaca section terpisah dan melempar CACHE_MISS bila satu kurang', async () => {
    const cache = new MemoryCacheStore();
    cache.seed({ key: cacheKey('fetchCompanyReport', { symbol: 'ADRO', sections: ['dividend'] }), endpoint: 'fetchCompanyReport',
      params: { symbol: 'ADRO', sections: ['dividend'] }, response: { symbol: 'ADRO.JK', company_name: 'A', dividend: { yield_ttm: 0.05 } },
      fetchedAt: new Date().toISOString(), ttlSeconds: TTL.profile });
    const { client } = makeClient({ mode: 'cache_only', cache });
    expect((await client.fetchCompanyReport('ADRO', ['dividend'])).data.dividend).toEqual({ yield_ttm: 0.05 });
    await expect(client.fetchCompanyReport('ADRO', ['dividend', 'valuation'])).rejects.toMatchObject({ code: 'CACHE_MISS' });
  });
});

describe('SectorsClient — jendela kanonik 90 hari', () => {
  const rows = (start: string, n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
    return { symbol: 'ADRO.JK', date: d.toISOString().slice(0, 10), close: 100 + i, volume: 1 };
  });

  it('jendela pendek di dalam 90 hari terakhir memakai satu entri cache yang sama', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      expect([u.searchParams.get('start'), u.searchParams.get('end')]).toEqual(['2026-07-01', '2026-09-28']);
      return jsonResponse(rows('2026-07-01', 90));
    });
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch, today: '2026-09-28' });

    const month = await client.fetchDailyPrice('ADRO', { start: '2026-08-30', end: '2026-09-28' });
    const week = await client.fetchDailyPrice('ADRO', { start: '2026-09-22', end: '2026-09-28' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(month.data).toHaveLength(30);
    expect(month.params).toEqual({ symbol: 'ADRO', start: '2026-08-30', end: '2026-09-28' });
    expect(week.data.map((r) => r.date)).toEqual(rows('2026-09-22', 7).map((r) => r.date));
    expect(week).toMatchObject({ credits: 0, cached: true });
  });

  it('jendela historis di luar 90 hari tetap memakai jendela persis', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request) => jsonResponse([]));
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch, today: '2026-09-28' });
    await client.fetchDailyPrice('ADRO', { start: '2026-01-01', end: '2026-01-31' });
    const u = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect([u.searchParams.get('start'), u.searchParams.get('end')]).toEqual(['2026-01-01', '2026-01-31']);
  });

  it('arus asing disaring ke jendela yang diminta', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ symbol: 'BBRI.JK', start: '2026-07-01', end: '2026-09-28',
      data: rows('2026-07-01', 90).map((r) => ({ date: r.date, net_foreign_inflow: 1, foreign_buy_idr: 1, foreign_sell_idr: 0, foreign_share: 0 })) }));
    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch, today: '2026-09-28' });
    const flow = await client.fetchForeignFlow('BBRI', { start: '2026-09-09', end: '2026-09-28' });
    expect(flow.data).toMatchObject({ start: '2026-09-09', end: '2026-09-28' });
    expect(flow.data.data).toHaveLength(20);
  });
});

describe('official company list response',()=>{
 it('normalizes results and uses the supported 200 limit',async()=>{
  const network=vi.fn(async(_url: Parameters<typeof fetch>[0])=>jsonResponse({results:[{symbol:'ULTJ.JK',company_name:'Ultrajaya'}],pagination:{next_offset:null}}));
  const {client}=makeClient({fetchImpl:network});
  const result=await client.fetchCompanies();
  expect(result.data.companies[0]?.symbol).toBe('ULTJ.JK');
  expect(String(network.mock.calls[0]?.[0])).toContain('limit=200');
 });
});


describe('explicit historical financial windows', () => {
 it('requests exact quarters without the latest-quarter parameter, and reuses the aggregate cache', async () => {
  const fetchImpl = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
   const query = new URL(String(url)).searchParams;
   expect(query.has('n_quarters')).toBe(false);
   expect(query.get('approx')).toBe('false');
   return jsonResponse([{ date: query.get('report_date'), earnings: 100 }]);
  });
  const { client, ledger } = makeClient({ fetchImpl: fetchImpl as typeof fetch });
  const params = { n_quarters: 3, report_date: '2025-09-30' };
  const first = await client.fetchQuarterlyFinancials('UNVR', params);
  expect(first.data.map(row => row.date)).toEqual(['2025-09-30','2025-06-30','2025-03-31']);
  expect(first.credits).toBe(3); expect(ledger.all().reduce((sum,row)=>sum+row.credits,0)).toBe(3);
  expect((await client.fetchQuarterlyFinancials('UNVR', params)).credits).toBe(0);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
 });
 it('fills an older missing quarter instead of accepting unrelated newer cached data', async () => {
  const cache = new MemoryCacheStore();
  const params = { symbol: 'UNVR', n_quarters: 2, report_date: '2025-09-30' };
  cache.seed({key:cacheKey('fetchQuarterlyFinancials',params),endpoint:'fetchQuarterlyFinancials',params,response:[{date:'2026-06-30',earnings:999},{date:'2025-09-30',earnings:100}],fetchedAt:new Date().toISOString(),ttlSeconds:TTL.filings});
  const fetchImpl = vi.fn(async () => jsonResponse([{date:'2025-06-30',earnings:90}]));
  const { client } = makeClient({ cache, fetchImpl: fetchImpl as typeof fetch });
  const result = await client.fetchQuarterlyFinancials('UNVR',params);
  expect(result.data.map(row=>row.date)).toEqual(['2025-09-30','2025-06-30']);
  expect(result.credits).toBe(1); expect(fetchImpl).toHaveBeenCalledTimes(1);
 });
});
