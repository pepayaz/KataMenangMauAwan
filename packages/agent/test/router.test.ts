import { describe, expect, it, vi } from 'vitest';
import { ToolCallSchema, type Claim, type ClaimType } from '@cek-dulu/shared';
import { addDays, estimateCredits, windowLengthDays, type EndpointName } from '@cek-dulu/sectors';
import { parseQuarter, routeClaim } from '../src/router.js';

const today = '2026-09-26';
function claim(type: ClaimType, asserted: Partial<Claim['asserted']> = {}): Claim {
  return { claimId: 'c1', checkId: 'check1', span: [0, 10], type, ticker: 'ADRO',
    asserted: { metric: 'metric', ...(type === 'safety' ? {} : { value: 3 }),
      ...(type === 'price_move' || type === 'earnings_growth' ? { unit: '%' as const } : {}), ...asserted }, inScope: true };
}

describe('router setiap tipe, tanpa LLM/I/O', () => {
  it.each([
    ['valuation', ['fetchCompanyReport'], 1], ['dividend', ['fetchCompanyReport'], 1],
    ['price_move', ['fetchDailyPrice'], 1], ['earnings_growth', ['fetchQuarterlyFinancials'], 5],
    ['foreign_flow', ['fetchForeignFlow'], 1],
    ['accumulation', ['fetchBrokerSummary', 'fetchShareholdersComposition'], 2],
    ['safety', ['fetchCompanyReport', 'fetchSuspensions', 'fetchCorporateActions', 'fetchFreeFloat'], 13],
  ] as const)('tipe %s', (type, tools, credits) => {
    const result = routeClaim(claim(type, type === 'price_move' ? { window: 'sebulan' } : {}), { today });
    expect(result.status).toBe('ready');
    expect(result.tools.map((t) => t.tool)).toEqual(tools);
    expect(result.estimatedCredits).toBe(credits);
    expect(result.tools.every((t) => ToolCallSchema.safeParse(t).success)).toBe(true);
  });
  it.each([['valuation', 'valuation'], ['dividend', 'dividend'], ['safety', 'overview']] as const)(
    '%s hanya section %s', (type, section) => {
      expect(routeClaim(claim(type), { today }).tools.find((t) => t.tool === 'fetchCompanyReport')?.params.sections).toEqual([section]);
    });
  it('prediksi tidak menghabiskan kredit atau membaca cache', () => {
    const isCached = vi.fn();
    expect(routeClaim({ ...claim('price_move'), inScope: false }, { today, isCached })).toMatchObject({
      status: 'out_of_scope', tools: [], estimatedCredits: 0 });
    expect(isCached).not.toHaveBeenCalled();
  });
  it('menghitung hit cache nol kredit dan miss lewat B', () => {
    const result = routeClaim(claim('safety'), { today, subSector: 'banks',
      isCached: (t) => t.tool === 'fetchCompanyReport' });
    expect(result.estimatedCredits).toBe(4);
    expect(result.tools.at(-1)?.params).toEqual({ sub_sector: 'banks' });
  });
  it('seluruh hit cache gratis', () => {
    expect(routeClaim(claim('safety'), { today, isCached: () => true }).estimatedCredits).toBe(0);
  });
});

describe('price_move tidak menebak jendela', () => {
  it('tanpa jendela tidak memakai bawaan 30 hari', () => {
    expect(routeClaim(claim('price_move'), { today })).toMatchObject({ status: 'needs_user_choice', tools: [], estimatedCredits: 0,
      notes: ['Klaim tidak menyebut jangka waktu; pilih tanggal awal dan akhir.'] });
  });
  it('angka harga bukan persen tidak dibandingkan dengan perubahan harga', () => {
    expect(routeClaim(claim('price_move', { value: 6400, unit: undefined, window: 'sebulan' }), { today }))
      .toMatchObject({ status: 'unsupported', tools: [] });
  });
  it.each(['ATH vs Juni 2026', 'sejak IPO'])('rentang yang tidak bisa dipastikan (%s) meminta tanggal', (window) => {
    expect(routeClaim(claim('price_move', { window }), { today }).status).toBe('needs_user_choice');
  });
  it.each([['past 5 years', 1825], ['last 3 months', 90], ['1Y', 365], ['5 tahun terakhir', 1825]] as const)(
    'frasa %s dikenali', (window, days) => {
      const result = routeClaim(claim('price_move', { window }), { today });
      expect(result.status).toBe('ready');
      expect(windowLengthDays({ start: result.tools[0]!.params.start as string, end: result.tools.at(-1)!.params.end as string })).toBe(days);
    });
  it('jendela panjang diambil dua cuplikan di awal dan akhir, bukan dipecah semua', () => {
    const result = routeClaim(claim('price_move', { window: 'past 5 years' }), { today });
    expect(result.tools).toHaveLength(2);
    expect(result.estimatedCredits).toBe(2);
    expect(result.tools.map((t) => windowLengthDays({ start: t.params.start as string, end: t.params.end as string }))).toEqual([21, 21]);
    expect(result.tools.at(-1)?.params.end).toBe(today);
  });
  it.each(['sebulan ini', 'seminggu ini', '3 bulan ini'])('akhiran "ini" (%s) dikenali', (window) => {
    expect(routeClaim(claim('price_move', { window }), { today }).status).toBe('ready');
  });
  it('jendela 90 hari tetap satu panggilan utuh', () => {
    const result = routeClaim(claim('price_move', { window: '90 hari' }), { today });
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]?.params).toMatchObject({ start: addDays(today, -89), end: today });
  });
});

describe('klaim yang tidak bisa dinilai tidak memakai kredit', () => {
  it.each([
    ['laba dalam rupiah', claim('earnings_growth', { metric: 'laba bersih', value: 15.5e12, unit: 'IDR' }), 'nilai laba'],
    ['pertumbuhan MoM', claim('earnings_growth', { metric: 'pertumbuhan laba', window: 'MoM' }), 'bulanan'],
    ['rasio angka di tipe safety', claim('safety', { metric: 'CASA', value: 85.2, unit: '%' }), 'pernyataan umum'],
  ] as const)('%s', (_label, input, note) => {
    const result = routeClaim(input, { today });
    expect(result).toMatchObject({ status: 'unsupported', tools: [], estimatedCredits: 0 });
    expect(result.notes[0]).toContain(note);
  });
  it('pertumbuhan YoY dalam persen tetap diperiksa', () => {
    expect(routeClaim(claim('earnings_growth', { metric: 'pertumbuhan laba', value: 12, window: 'YoY' }), { today }).status).toBe('ready');
  });
});

describe('periode kuartal', () => {
  it.each([['Q1 2026', 1, 2026], ['KUARTAL I - 2026', 1, 2026], ['Triwulan III 2025', 3, 2025], ['1Q26', 1, 2026], ['kuartal 4/2025', 4, 2025]] as const)(
    '%s', (period, q, year) => expect(parseQuarter(period)).toEqual({ q, year }));
  it.each(['Kuartal V 2026', 'semester I 2026', '2026'])('%s bukan kuartal', (period) => expect(parseQuarter(period)).toBeNull());
  it.each(['YoY', 'QoQ', 'tahunan'])('mode pertumbuhan %s di period bukan periode laporan', (period) => {
    const result = routeClaim(claim('earnings_growth', { period }), { today });
    expect(result.status).toBe('ready');
    expect(result.tools[0]?.params).not.toHaveProperty('report_date');
  });
  it('periode kuartal Indonesia memilih report_date akhir kuartal', () => {
    expect(routeClaim(claim('earnings_growth', { period: 'KUARTAL I - 2026' }), { today }).tools[0]?.params)
      .toMatchObject({ report_date: '2026-03-31' });
  });
});

describe('jendela inklusif dan batas endpoint', () => {
  it.each(['foreign_flow'] as const)('memecah %s 181 hari tanpa gap/overlap', (type) => {
    const window = { start: '2026-03-30', end: today };
    const result = routeClaim(claim(type), { today, window });
    expect(result.tools).toHaveLength(3);
    expect(result.estimatedCredits).toBe(3);
    const chunks = result.tools.map((t) => ({ start: t.params.start as string, end: t.params.end as string }));
    expect(chunks.map(windowLengthDays)).toEqual([90, 90, 1]);
    expect(chunks[0]?.start).toBe(window.start);
    expect(chunks.at(-1)?.end).toBe(window.end);
    expect(chunks[1]?.start).toBe(addDays(chunks[0]!.end, 1));
    expect(chunks[2]?.start).toBe(addDays(chunks[1]!.end, 1));
  });
  it.each([1, 5, 20, 60, 90, 91, 180, 181])('foreign flow %s hari', (days) => {
    const result = routeClaim(claim('foreign_flow', { window: `${days} hari` }), { today });
    expect(result.tools).toHaveLength(Math.ceil(days / 90));
    expect(result.estimatedCredits).toBe(result.tools.reduce((sum, t) => sum + estimateCredits(t.tool as EndpointName, t.params), 0));
  });
  it('broker dipecah pada 14 hari dan komposisi meliputi pergantian tahun', () => {
    const result = routeClaim(claim('accumulation'), { today, window: { start: '2025-12-20', end: '2026-01-20' } });
    expect(result.tools.filter((t) => t.tool === 'fetchBrokerSummary')).toHaveLength(3);
    expect(result.tools.filter((t) => t.tool === 'fetchShareholdersComposition').map((t) => t.params.year)).toEqual([2025, 2026]);
    expect(result.estimatedCredits).toBe(5);
  });
  it('YTD dimulai 1 Januari, bukan 365 hari mundur', () => {
    const result = routeClaim(claim('price_move', { window: 'YTD' }), { today });
    expect(result.tools[0]?.params.start).toBe('2026-01-01');
    expect(result.tools.at(-1)?.params.end).toBe(today);
  });
  it('rentang tanggal dari klaim', () => {
    expect(routeClaim(claim('price_move', { window: '2026-09-01 sampai 2026-09-20' }), { today }).tools[0]?.params)
      .toEqual({ symbol: 'ADRO', start: '2026-09-01', end: '2026-09-20' });
  });
  it.each(['kemarin sore', '-5 hari', '0 hari', '1,5 bulan', '2026-02-30 sampai 2026-03-01',
    '2026-09-27 sampai 2026-09-28', '2026-09-20 sampai 2026-09-01'])(
    'tidak menebak jendela %s', (window) => {
      expect(routeClaim(claim('price_move', { window }), { today })).toMatchObject({
        status: 'needs_user_choice', tools: [], estimatedCredits: 0 });
    });
  it('tanggal today harus valid kalender', () => {
    expect(() => routeClaim(claim('dividend'), { today: '2026-02-30' })).toThrow();
  });
});

describe('periode pertumbuhan laba', () => {
  it('lima kuartal dan tanggal akhir Q2', () => {
    expect(routeClaim(claim('earnings_growth', { period: 'Q2 2026' }), { today }).tools[0]?.params)
      .toEqual({ symbol: 'ADRO', n_quarters: 5, report_date: '2026-06-30' });
  });
  it('tanggal laporan eksplisit', () => {
    expect(routeClaim(claim('earnings_growth', { period: '2025-12-31' }), { today }).tools[0]?.params.report_date).toBe('2025-12-31');
  });
  it.each(['Q4 2026', 'Q5 2026', 'tahun lalu'])('periode %s harus diklarifikasi', (period) => {
    expect(routeClaim(claim('earnings_growth', { period }), { today })).toMatchObject({
      status: 'needs_user_choice', tools: [], estimatedCredits: 0 });
  });
});
