import { describe, expect, it } from 'vitest';
import {
  MemoryCacheStore,
  MemoryLedgerStore,
  SectorsClient,
  cacheKey,
  windowEndingToday,
} from '@cek-dulu/sectors';
import { MANUAL_ALIASES, type CheckInput, type TraceEvent } from '@cek-dulu/shared';
import { BaselinePipeline, normalize } from '../lib/pipeline/baseline.js';
import { extractClaims } from '../lib/pipeline/extract.js';
import { deriveMissingContext } from '../lib/pipeline/adjudicate.js';

const TODAY = '2026-09-24';

const ADRO_DIVIDEND = {
  historical_dividends: {
    '2024': {
      breakdown: [
        { date: '2024-05-17', total: 120, yield: 0.042 },
        { date: '2024-11-28', total: 1358.18, yield: 0.452 },
      ],
      total_yield: 0.494,
      total_dividend: 1478.18,
    },
    '2025': {
      breakdown: [{ date: '2025-06-10', total: 90, yield: 0.048 }],
      total_yield: 0.048,
      total_dividend: 90,
    },
  },
  upcoming_dividends: null,
  yield_ttm: 0.056,
  dividend_yield_avg: { period: 5, avg_yield: 0.255 },
  dividend_ttm: 95,
  payout_ratio: 0.31,
  cash_payout_ratio: -0.9,
  last_ex_dividend_date: '2025-06-10',
};

function seededClient(): SectorsClient {
  const cache = new MemoryCacheStore();
  const seed = (endpoint: string, params: Record<string, unknown>, response: unknown): void => {
    cache.seed({
      key: cacheKey(endpoint, params),
      endpoint,
      params,
      response,
      fetchedAt: new Date().toISOString(),
      ttlSeconds: 86_400,
    });
  };

  seed(
    'fetchCompanyReport',
    { symbol: 'ADRO', sections: ['dividend'] },
    { symbol: 'ADRO.JK', company_name: 'PT Adaro', dividend: ADRO_DIVIDEND },
  );

  const w = windowEndingToday(30, TODAY);
  seed('fetchDailyPrice', { symbol: 'ADRO', start: w.start, end: w.end }, [
    { symbol: 'ADRO.JK', date: w.start, close: 1000, volume: 1_000_000 },
    { symbol: 'ADRO.JK', date: w.end, close: 1800, volume: 1_000_000 },
  ]);
  seed(
    'fetchCorporateActions',
    { symbol: 'ADRO' },
    {
      symbol: 'ADRO.JK',
      corporate_actions: {
        dividend: null,
        upcoming_dividend: null,
        stock_split: null,
        right_issue: null,
        warrant: null,
        bonus: null,
        agm: null,
      },
    },
  );

  return new SectorsClient({
    cache,
    ledger: new MemoryLedgerStore(),
    config: { mode: 'cache_only', member: 'B', apiKey: '' },
  });
}

function run(text: string, flags: Record<string, boolean> = {}) {
  const events: TraceEvent[] = [];
  const input: CheckInput = {
    checkId: 'cek-uji',
    source: 'paste',
    rawText: text,
    createdAt: `${TODAY}T00:00:00.000Z`,
  };
  const pipeline = new BaselinePipeline(MANUAL_ALIASES);
  return pipeline
    .run(input, {
      client: seededClient(),
      emit: (e) => events.push({ ...e, checkId: 'cek-uji', ts: new Date().toISOString() }),
      today: TODAY,
      flags,
    })
    .then((result) => ({ result, events }));
}

describe('normalize', () => {
  it('membuang tautan dan merapikan spasi', () => {
    expect(normalize('ADRO  mantap https://x.com/a/b  cek')).toBe('ADRO mantap cek');
  });

  it('menyeragamkan tanda kutip melengkung', () => {
    expect(normalize('“ADRO” mantap')).toBe('"ADRO" mantap');
  });
});

describe('extractClaims', () => {
  const entities = [{ surface: 'ADRO', ticker: 'ADRO', confidence: 0.99, method: 'explicit' as const }];

  it('menemukan klaim dividen berangka', () => {
    const claims = extractClaims('ADRO yield dividennya 25,5% setahun', {
      checkId: 'c',
      entities,
      enabledTypes: ['dividend'],
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]?.type).toBe('dividend');
    expect(claims[0]?.asserted.value).toBe(25.5);
    expect(claims[0]?.asserted.unit).toBe('%');
  });

  it('menandai prediksi sebagai di luar cakupan', () => {
    const claims = extractClaims('ADRO bakal naik 80% bulan depan', {
      checkId: 'c',
      entities,
      enabledTypes: ['price_move'],
    });
    expect(claims[0]?.inScope).toBe(false);
  });

  it('menghormati feature flag tipe klaim', () => {
    // Bab 2.1: tipe 4-7 di balik flag claim_types_ext.
    const claims = extractClaims('ADRO labanya naik 200%', {
      checkId: 'c',
      entities,
      enabledTypes: ['valuation', 'dividend', 'price_move'],
    });
    expect(claims.filter((c) => c.type === 'earnings_growth')).toHaveLength(0);
  });

  it('mencatat jendela waktu yang disebut', () => {
    const claims = extractClaims('ADRO sebulan naik 80%', {
      checkId: 'c',
      entities,
      enabledTypes: ['price_move'],
    });
    expect(claims[0]?.asserted.window).toBe('sebulan');
  });
});

describe('BaselinePipeline', () => {
  it('menandai klaim ADRO 25% sebagai menyesatkan, bukan didukung', async () => {
    const { result } = await run('$ADRO yield dividennya 25,5% setahun, mantap!');

    expect(result.claims).toHaveLength(1);
    const verdict = result.verdicts[0];
    expect(verdict?.verdict).toBe('misleading');
    expect(verdict?.missingContext.map((c) => c.hypId)).toContain('DIV_TTM_GAP');
    expect(verdict?.explanation).toContain('5,6%');
  });

  it('setiap verdict membawa evidence', async () => {
    const { result } = await run('$ADRO yield dividennya 25,5% setahun');
    for (const v of result.verdicts) {
      if (v.verdict === 'supported' || v.verdict === 'refuted' || v.verdict === 'misleading') {
        expect(v.evidenceIds.length).toBeGreaterThan(0);
      }
    }
  });

  it('mengalirkan event jejak untuk setiap tahap', async () => {
    const { events } = await run('$ADRO yield dividennya 25,5% setahun');
    const stages = new Set(events.map((e) => e.stage));
    expect(stages).toContain('normalize');
    expect(stages).toContain('extract');
    expect(stages).toContain('verify');
    expect(stages).toContain('adjudicate');
    expect(stages).toContain('done');
  });

  it('menandai prediksi sebagai di luar cakupan tanpa memanggil data', async () => {
    const { result } = await run('$ADRO bakal naik 80% bulan depan, pasti cuan');
    expect(result.verdicts[0]?.verdict).toBe('out_of_scope');
    expect(result.evidence).toHaveLength(0);
  });

  it('tidak menghasilkan klaim bila emiten tidak dikenali', async () => {
    const { result } = await run('saham ini bagus banget');
    expect(result.claims).toHaveLength(0);
    expect(result.verdicts).toHaveLength(0);
  });

  it('menandai tidak bisa diverifikasi bila data tidak ada di cache', async () => {
    const { result } = await run('$BBRI yield dividennya 7% setahun');
    expect(result.verdicts[0]?.verdict).toBe('unverifiable');
  });
});

describe('deriveMissingContext', () => {
  it('menemukan FGN_WINDOW bila jendela lain berlawanan arah', () => {
    const context = deriveMissingContext(
      {
        claimId: 'c1',
        checkId: 'cek',
        span: [0, 5],
        type: 'foreign_flow',
        ticker: 'BBRI',
        asserted: { metric: 'asing borong' },
        inScope: true,
      },
      {
        evidence: [],
        matches: true,
        tolerance: '-',
        note: '',
        details: {
          summary: { net: 100 },
          byWindow: { 5: { net: 100 }, 20: { net: -500 }, 60: { net: -900 } },
        },
      },
    );
    expect(context.map((c) => c.hypId)).toContain('FGN_WINDOW');
  });

  it('tidak menemukan apa-apa bila semua jendela searah', () => {
    const context = deriveMissingContext(
      {
        claimId: 'c1',
        checkId: 'cek',
        span: [0, 5],
        type: 'foreign_flow',
        ticker: 'BBRI',
        asserted: { metric: 'asing borong' },
        inScope: true,
      },
      {
        evidence: [],
        matches: true,
        tolerance: '-',
        note: '',
        details: {
          summary: { net: 100 },
          byWindow: { 5: { net: 100 }, 20: { net: 500 }, 60: { net: 900 } },
        },
      },
    );
    expect(context).toHaveLength(0);
  });
});
