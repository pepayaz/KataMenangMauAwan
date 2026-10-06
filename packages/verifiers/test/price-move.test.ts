import { describe, expect, it } from 'vitest';
import { sampledWindows, windowEndingToday } from '@cek-dulu/sectors';
import { computePriceChange, splitsInWindow, verifyPriceMove } from '../src/price-move.js';
import { TODAY, ctx, dailySeries, makeClaim, seededClient } from './helpers.js';

const WINDOW = windowEndingToday(30, TODAY);

function client(opts: { from: number; to: number; splits?: Array<{ date: string; split_ratio: number }> }) {
  return seededClient([
    {
      endpoint: 'fetchDailyPrice',
      params: { symbol: 'BREN', start: WINDOW.start, end: WINDOW.end },
      response: dailySeries({
        symbol: 'BREN',
        start: WINDOW.start,
        days: 30,
        from: opts.from,
        to: opts.to,
      }),
    },
    {
      endpoint: 'fetchCorporateActions',
      params: { symbol: 'BREN' },
      response: {
        symbol: 'BREN.JK',
        corporate_actions: {
          dividend: null,
          upcoming_dividend: null,
          stock_split: opts.splits ?? null,
          right_issue: null,
          warrant: null,
          bonus: null,
          agm: null,
        },
      },
    },
  ]);
}

describe('computePriceChange (murni)', () => {
  it('menghitung perubahan dari penutupan pertama ke terakhir', () => {
    const rows = dailySeries({ symbol: 'BREN', start: '2026-09-01', days: 10, from: 100, to: 180 });
    const change = computePriceChange(rows);
    expect(change?.changePct).toBeCloseTo(80, 1);
    expect(change?.startClose).toBe(100);
    expect(change?.endClose).toBe(180);
  });

  it('melaporkan titik terendah dan tertinggi di jendela', () => {
    const rows = [
      { symbol: 'BREN.JK', date: '2026-09-01', close: 100, volume: 10 },
      { symbol: 'BREN.JK', date: '2026-09-02', close: 50, volume: 10 },
      { symbol: 'BREN.JK', date: '2026-09-03', close: 140, volume: 10 },
    ];
    const change = computePriceChange(rows);
    expect(change?.lowClose).toBe(50);
    expect(change?.highClose).toBe(140);
  });

  it('mengabaikan hari tanpa harga penutupan', () => {
    const rows = [
      { symbol: 'BREN.JK', date: '2026-09-01', close: 100, volume: 10 },
      { symbol: 'BREN.JK', date: '2026-09-02', close: null, volume: null },
      { symbol: 'BREN.JK', date: '2026-09-03', close: 120, volume: 10 },
    ];
    expect(computePriceChange(rows)?.tradingDays).toBe(2);
  });

  it('mengembalikan null bila hari perdagangan kurang dari dua', () => {
    expect(computePriceChange([])).toBeNull();
    expect(
      computePriceChange([{ symbol: 'B.JK', date: '2026-09-01', close: 1, volume: 1 }]),
    ).toBeNull();
  });
});

describe('splitsInWindow (murni)', () => {
  it('hanya mengambil split di dalam jendela', () => {
    const actions = {
      symbol: 'BREN.JK',
      corporate_actions: {
        dividend: null,
        upcoming_dividend: null,
        stock_split: [
          { date: '2020-01-01', split_ratio: 5 },
          { date: '2026-09-10', split_ratio: 2 },
        ],
        right_issue: null,
        warrant: null,
        bonus: null,
        agm: null,
      },
    };
    expect(splitsInWindow(actions, WINDOW)).toHaveLength(1);
  });
});

describe('verifyPriceMove', () => {
  it('mendukung klaim kenaikan dalam toleransi 3 poin persen', async () => {
    const out = await verifyPriceMove(
      makeClaim('price_move', 'BREN', {
        metric: 'perubahan harga',
        value: 80,
        unit: '%',
        window: 'sebulan',
      }),
      ctx(client({ from: 100, to: 180 })),
    );
    expect(out.matches).toBe(true);
    expect(out.computed?.value).toBeCloseTo(80, 0);
  });

  it('membantah kenaikan yang dibesar-besarkan', async () => {
    const out = await verifyPriceMove(
      makeClaim('price_move', 'BREN', {
        metric: 'perubahan harga',
        value: 80,
        unit: '%',
        window: 'sebulan',
      }),
      ctx(client({ from: 100, to: 120 })),
    );
    expect(out.matches).toBe(false);
    expect(out.computed?.value).toBeCloseTo(20, 0);
  });

  it('menandai stock split di dalam jendela', async () => {
    const out = await verifyPriceMove(
      makeClaim('price_move', 'BREN', {
        metric: 'perubahan harga',
        value: 80,
        unit: '%',
        window: 'sebulan',
      }),
      ctx(client({ from: 100, to: 180, splits: [{ date: WINDOW.end, split_ratio: 2 }] })),
    );
    expect((out.details?.splits as unknown[]).length).toBe(1);
    expect(out.note).toContain('stock split');
  });

  it('tetap berjalan meski aksi korporasi tidak tersedia', async () => {
    const partial = seededClient([
      {
        endpoint: 'fetchDailyPrice',
        params: { symbol: 'BREN', start: WINDOW.start, end: WINDOW.end },
        response: dailySeries({
          symbol: 'BREN',
          start: WINDOW.start,
          days: 30,
          from: 100,
          to: 180,
        }),
      },
    ]);
    const out = await verifyPriceMove(
      makeClaim('price_move', 'BREN', {
        metric: 'perubahan harga',
        value: 80,
        unit: '%',
        window: 'sebulan',
      }),
      ctx(partial),
    );
    expect(out.matches).toBe(true);
  });
});

describe('verifyPriceMove — jendela dari router dan jendela panjang', () => {
  const longWindow = { start: '2021-09-25', end: TODAY };
  const [head, tail] = sampledWindows(longWindow)!;
  const seeds = (from: number, to: number) => seededClient([
    { endpoint: 'fetchDailyPrice', params: { symbol: 'BBRI', ...head },
      response: dailySeries({ symbol: 'BBRI', start: head.start, days: 21, from, to: from }) },
    { endpoint: 'fetchDailyPrice', params: { symbol: 'BBRI', ...tail },
      response: dailySeries({ symbol: 'BBRI', start: tail.start, days: 21, from: to, to }) },
    { endpoint: 'fetchCorporateActions', params: { symbol: 'BBRI' }, response: { symbol: 'BBRI.JK', corporate_actions: {} } },
  ]);
  const claim = makeClaim('price_move', 'BBRI', { metric: 'perubahan harga', value: -25.29, unit: '%', window: 'past 5 years' });

  it('lima tahun dihitung dari cuplikan awal dan akhir tanpa memuat seluruh deret', async () => {
    const out = await verifyPriceMove(claim, { ...ctx(seeds(3815, 2850)), window: longWindow });
    expect(out.matches).toBe(true);
    expect(out.computed?.value).toBeCloseTo(-25.3, 1);
    expect(out.evidence.map((e) => e.label)).not.toContain('Harga terendah BBRI di jendela');
    expect(out.details).toMatchObject({ sampled: [head, tail] });
    expect(out.details).not.toHaveProperty('lowClose');
  });

  it('angka harga tanpa persen tidak dibandingkan', async () => {
    const out = await verifyPriceMove(makeClaim('price_move', 'BBRI', { metric: 'harga', value: 6400 }),
      { ...ctx(seeds(1, 1)), window: longWindow });
    expect(out).toMatchObject({ matches: null, evidence: [] });
  });
});
