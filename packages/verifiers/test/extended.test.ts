import { describe, expect, it } from 'vitest';
import { enabledClaimTypes } from '../src/registry.js';
import { windowEndingToday } from '@cek-dulu/sectors';
import {
  computeSemesterGrowth,
  computeGrowth,
  resolveGrowthMetric,
  resolveGrowthMode,
  verifyEarningsGrowth,
} from '../src/earnings-growth.js';
import {
  flowDirection,
  isInflowClaim,
  lastNTradingDays,
  summarizeFlow,
  summarizeStandardWindows,
  verifyForeignFlow,
} from '../src/foreign-flow.js';
import {
  computeBrokerConcentration,
  computeOwnershipChange,
  splitOwnership,
  verifyAccumulation,
} from '../src/accumulation.js';
import { assessRiskSignals, findFreeFloat, toSectorSlug, verifySafety } from '../src/safety.js';
import { TODAY, ctx, makeClaim, seededClient } from './helpers.js';

// ------------------------------------------------- Tipe 4: pertumbuhan laba

const QUARTERS = [
  { symbol: 'ASII.JK', date: '2026-06-30', revenue: 90_000, earnings: 30_000 },
  { symbol: 'ASII.JK', date: '2026-03-31', revenue: 80_000, earnings: 25_000 },
  { symbol: 'ASII.JK', date: '2025-12-31', revenue: 70_000, earnings: 20_000 },
  { symbol: 'ASII.JK', date: '2025-09-30', revenue: 60_000, earnings: 15_000 },
  { symbol: 'ASII.JK', date: '2025-06-30', revenue: 50_000, earnings: 10_000 },
];

describe('computeGrowth (murni)', () => {
  it('menghitung YoY dari kuartal yang sama tahun lalu', () => {
    const g = computeGrowth(QUARTERS, 'yoy', 'earnings');
    expect(g?.baseDate).toBe('2025-06-30');
    expect(g?.growthPct).toBeCloseTo(200);
  });

  it('menghitung QoQ dari kuartal sebelumnya', () => {
    const g = computeGrowth(QUARTERS, 'qoq', 'earnings');
    expect(g?.baseDate).toBe('2026-03-31');
    expect(g?.growthPct).toBeCloseTo(20);
  });

  it('bisa menghitung pendapatan, bukan hanya laba', () => {
    expect(computeGrowth(QUARTERS, 'yoy', 'revenue')?.growthPct).toBeCloseTo(80);
  });

  it('menandai basis nol atau negatif sebagai tidak bermakna', () => {
    const fromLoss = [...QUARTERS.slice(0, 4), { ...QUARTERS[4]!, earnings: -5_000 }];
    const g = computeGrowth(fromLoss, 'yoy', 'earnings');
    expect(g?.baseDegenerate).toBe(true);
  });

  it('mengembalikan null bila kuartal kurang', () => {
    expect(computeGrowth(QUARTERS.slice(0, 2), 'yoy', 'earnings')).toBeNull();
  });
});

describe('resolveGrowthMode / resolveGrowthMetric (murni)', () => {
  it('bawaannya YoY', () => {
    expect(resolveGrowthMode('laba meledak')).toBe('yoy');
    expect(resolveGrowthMode('naik QoQ')).toBe('qoq');
  });

  it('membedakan laba dari pendapatan', () => {
    expect(resolveGrowthMetric('laba meledak')).toBe('earnings');
    expect(resolveGrowthMetric('pendapatan naik')).toBe('revenue');
  });
});

describe('verifyEarningsGrowth', () => {
  const client = seededClient([
    {
      endpoint: 'fetchQuarterlyFinancials',
      params: { symbol: 'ASII', n_quarters: 5 },
      response: QUARTERS,
    },
  ]);

  it('mendukung klaim pertumbuhan yang benar', async () => {
    const out = await verifyEarningsGrowth(
      makeClaim('earnings_growth', 'ASII', {
        metric: 'pertumbuhan laba',
        value: 200,
        unit: '%',
      }),
      ctx(client),
    );
    expect(out.matches).toBe(true);
    expect(out.computed?.value).toBeCloseTo(200);
  });

  it('membantah klaim yang dilebih-lebihkan', async () => {
    const out = await verifyEarningsGrowth(
      makeClaim('earnings_growth', 'ASII', {
        metric: 'pertumbuhan laba',
        value: 500,
        unit: '%',
      }),
      ctx(client),
    );
    expect(out.matches).toBe(false);
  });

  it('pertumbuhan dekat nol memakai batas bawah 0,5 poin persen', async () => {
    const flat = [{ ...QUARTERS[0]!, earnings: 9_986 }, ...QUARTERS.slice(1, 4), { ...QUARTERS[4]!, earnings: 10_000 }];
    const flatClient = seededClient([{ endpoint: 'fetchQuarterlyFinancials', params: { symbol: 'ASII', n_quarters: 5 }, response: flat }]);
    const claim = (value: number) => makeClaim('earnings_growth', 'ASII', { metric: 'pertumbuhan laba', value, unit: '%' });
    expect((await verifyEarningsGrowth(claim(-0.1), ctx(flatClient))).matches).toBe(true);
    expect((await verifyEarningsGrowth(claim(1), ctx(flatClient))).matches).toBe(false);
  });
});

// ----------------------------------------------------- Tipe 5: arus asing

const FLOW_WINDOW = windowEndingToday(20, TODAY);

function flowRows(nets: number[]): Array<{
  date: string;
  net_foreign_inflow: number;
  foreign_buy_idr: number;
  foreign_sell_idr: number;
  foreign_share: number;
}> {
  const start = new Date(`${FLOW_WINDOW.start}T00:00:00.000Z`).getTime();
  return nets.map((net, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    net_foreign_inflow: net,
    foreign_buy_idr: Math.max(net, 0),
    foreign_sell_idr: Math.max(-net, 0),
    foreign_share: 0.5,
  }));
}

describe('summarizeFlow (murni)', () => {
  it('menjumlahkan arus dan menghitung hari beli bersih', () => {
    const s = summarizeFlow(flowRows([100, -50, 200]));
    expect(s.net).toBe(250);
    expect(s.positiveDays).toBe(2);
    expect(s.negativeDays).toBe(1);
  });

  it('mengabaikan hari tanpa nilai', () => {
    const s = summarizeFlow([
      { date: '2026-09-01', net_foreign_inflow: null, foreign_buy_idr: null, foreign_sell_idr: null, foreign_share: null },
    ]);
    expect(s.net).toBe(0);
  });
});

describe('lastNTradingDays / summarizeStandardWindows (murni)', () => {
  it('mengambil hari terakhir, bukan hari pertama', () => {
    const rows = flowRows([1, 2, 3, 4, 5]);
    expect(lastNTradingDays(rows, 2).map((r) => r.net_foreign_inflow)).toEqual([4, 5]);
  });

  it('meringkas jendela 5, 20, dan 60 hari', () => {
    // Jendela pendek positif, jendela panjang negatif: inti hipotesis FGN_WINDOW.
    const rows = flowRows([-1000, -1000, -1000, 100, 100]);
    const w = summarizeStandardWindows(rows);
    expect(w[5]!.net).toBe(-2800);
    expect(w[20]!.net).toBe(-2800);
  });
});

describe('isInflowClaim (murni)', () => {
  it('membedakan borong dari jualan', () => {
    expect(isInflowClaim('asing borong')).toBe(true);
    expect(isInflowClaim('asing jualan terus')).toBe(false);
  });

  it('flowDirection null bila arah tidak disebut atau bertentangan', () => {
    expect(flowDirection('foreign flow (jual bersih)')).toBe('out');
    expect(flowDirection('asing borong')).toBe('in');
    expect(flowDirection('foreign flow')).toBeNull();
    expect(flowDirection('beli lalu jual')).toBeNull();
  });
});

describe('verifyForeignFlow', () => {
  function client(nets: number[]) {
    return seededClient([
      {
        endpoint: 'fetchForeignFlow',
        params: { symbol: 'BBRI', start: FLOW_WINDOW.start, end: FLOW_WINDOW.end },
        response: {
          symbol: 'BBRI.JK',
          start: FLOW_WINDOW.start,
          end: FLOW_WINDOW.end,
          data: flowRows(nets),
        },
      },
    ]);
  }

  it('mendukung klaim borong bila arus bersihnya positif', async () => {
    const out = await verifyForeignFlow(
      makeClaim('foreign_flow', 'BBRI', { metric: 'asing borong' }),
      ctx(client([1e9, 2e9, -5e8])),
    );
    expect(out.matches).toBe(true);
    expect(out.note).toContain('beli bersih');
  });

  it('klaim jual bersih dinilai dari arah keluar', async () => {
    const out = await verifyForeignFlow(
      makeClaim('foreign_flow', 'BBRI', { metric: 'foreign flow (jual bersih)' }),
      ctx(client([-1e9, -2e9, 5e8])),
    );
    expect(out.matches).toBe(true);
  });

  it('tanpa arah tidak dianggap beli', async () => {
    const out = await verifyForeignFlow(
      makeClaim('foreign_flow', 'BBRI', { metric: 'foreign flow' }),
      ctx(client([-1e9, -2e9, 5e8])),
    );
    expect(out.matches).toBeNull();
  });

  it('membantah klaim borong bila asing justru keluar', async () => {
    const out = await verifyForeignFlow(
      makeClaim('foreign_flow', 'BBRI', { metric: 'asing borong' }),
      ctx(client([-4e9, -1e9, 5e8])),
    );
    expect(out.matches).toBe(false);
    expect(out.note).toContain('jual bersih');
  });

  it('memberi evidence untuk beberapa jendela sekaligus', async () => {
    const out = await verifyForeignFlow(
      makeClaim('foreign_flow', 'BBRI', { metric: 'asing borong' }),
      ctx(client([1e9, 2e9, -5e8, 3e8, 1e8])),
    );
    const labels = out.evidence.map((e) => e.label);
    expect(labels.some((l) => l.includes('5 hari'))).toBe(true);
    expect(labels.some((l) => l.includes('20 hari'))).toBe(true);
  });
});

// ------------------------------------------- Tipe 6: akumulasi institusi

const SNAPSHOT_A = {
  date: '2026-01-31',
  shares_number: 1000,
  insurance_l: 100,
  corporate_l: 0,
  pension_fund_l: 0,
  financial_institutions_l: 0,
  individual_l: 400,
  mutual_fund_l: 0,
  securities_companies_l: 0,
  foundation_l: 0,
  other_l: 0,
  total_l: 500,
  insurance_f: 0,
  corporate_f: 0,
  pension_fund_f: 0,
  financial_institutions_f: 0,
  individual_f: 0,
  mutual_fund_f: 0,
  securities_companies_f: 0,
  foundation_f: 0,
  other_f: 0,
  total_f: 0,
};

describe('splitOwnership (murni)', () => {
  it('memisahkan institusi dari individu', () => {
    const s = splitOwnership(SNAPSHOT_A);
    expect(s.institutional).toBe(100);
    expect(s.individual).toBe(400);
    expect(s.institutionalShare).toBeCloseTo(0.2);
  });
});

describe('computeOwnershipChange (murni)', () => {
  it('menghitung perubahan porsi institusi antar snapshot', () => {
    const later = { ...SNAPSHOT_A, date: '2026-08-31', insurance_l: 300, individual_l: 200 };
    const change = computeOwnershipChange({
      symbol: 'BBRI.JK',
      year: 2026,
      data: [SNAPSHOT_A, later],
    });
    expect(change?.institutionalSharePp).toBeCloseTo(40);
  });

  it('mengembalikan null bila hanya ada satu snapshot', () => {
    expect(
      computeOwnershipChange({ symbol: 'BBRI.JK', year: 2026, data: [SNAPSHOT_A] }),
    ).toBeNull();
  });
});

describe('computeBrokerConcentration (murni)', () => {
  it('menjumlahkan nilai bersih per broker lintas hari', () => {
    const c = computeBrokerConcentration({
      symbol: 'BBRI.JK',
      start: '2026-09-01',
      end: '2026-09-02',
      data: [
        {
          date: '2026-09-01',
          summary: [
            { broker_code: 'AK', bval: 0, sval: 0, nval: 100, blot: 0, slot: 0, nlot: 0 },
            { broker_code: 'BK', bval: 0, sval: 0, nval: 50, blot: 0, slot: 0, nlot: 0 },
          ],
        },
        {
          date: '2026-09-02',
          // AK menjual balik: bersihnya jadi 40, bukan tetap 100.
          summary: [{ broker_code: 'AK', bval: 0, sval: 0, nval: -60, blot: 0, slot: 0, nlot: 0 }],
        },
      ],
    });
    expect(c.totalNetBuy).toBe(90);
    expect(c.topBrokers[0]?.broker).toBe('BK');
    expect(c.top2Share).toBeCloseTo(1);
  });
});

describe('verifyAccumulation', () => {
  it('membantah klaim akumulasi institusi bila yang bertambah individu', async () => {
    const later = { ...SNAPSHOT_A, date: '2026-08-31', insurance_l: 50, individual_l: 600 };
    const brokerWindow = windowEndingToday(14, TODAY);
    const client = seededClient([
      {
        endpoint: 'fetchBrokerSummary',
        params: { symbol: 'BBRI', start: brokerWindow.start, end: brokerWindow.end },
        response: {
          symbol: 'BBRI.JK',
          start: brokerWindow.start,
          end: brokerWindow.end,
          data: [
            {
              date: brokerWindow.end,
              summary: [
                { broker_code: 'AK', bval: 0, sval: 0, nval: 900, blot: 0, slot: 0, nlot: 0 },
              ],
            },
          ],
        },
      },
      {
        endpoint: 'fetchShareholdersComposition',
        params: { symbol: 'BBRI', year: 2026 },
        response: { symbol: 'BBRI.JK', year: 2026, data: [SNAPSHOT_A, later] },
      },
    ]);

    const out = await verifyAccumulation(
      makeClaim('accumulation', 'BBRI', { metric: 'akumulasi institusi' }),
      ctx(client),
    );
    expect(out.matches).toBe(false);
    expect(out.note).toContain('individu');
  });
});

// -------------------------------------------------------- Tipe 7: keamanan

describe('toSectorSlug / findFreeFloat (murni)', () => {
  it('membuat slug kebab-case', () => {
    expect(toSectorSlug('Banks')).toBe('banks');
    expect(toSectorSlug('Transportation & Logistic')).toBe('transportation-logistic');
  });

  it('menemukan free float dengan atau tanpa akhiran .JK', () => {
    const list = [{ symbol: 'AMAR.JK', company_name: 'Bank Amar', free_float: 0.11 }];
    expect(findFreeFloat(list, 'AMAR')).toBeCloseTo(0.11);
  });
});

describe('assessRiskSignals (murni)', () => {
  const overview = {
    listing_board: 'Main',
    industry: 'Banks',
    sector: 'Financials',
    sub_sector: 'Banks',
    market_cap: 1e12,
    market_cap_rank: 240,
    listing_date: '2014-01-09',
    last_close_price: 200,
    latest_close_date: TODAY,
    daily_close_change: 0,
    all_time_price: null,
    esg_score: null,
    tags: [],
    indices: [],
  };

  it('menandai suspensi terbaru, dilusi, free float tipis, dan kapitalisasi kecil', () => {
    const a = assessRiskSignals({
      suspensions: [{ symbol: 'AMAR.JK', suspension_date: '2026-03-01', reason: 'x', pdf_url: null }],
      actions: {
        symbol: 'AMAR.JK',
        corporate_actions: {
          dividend: null,
          upcoming_dividend: null,
          stock_split: null,
          right_issue: [{}],
          warrant: [{}],
          bonus: null,
          agm: null,
        },
      },
      freeFloat: 0.11,
      overview,
      today: TODAY,
    });
    expect(a.signals.map((s) => s.id).sort()).toEqual([
      'DILUTION',
      'LOW_FREE_FLOAT',
      'SMALL_CAP',
      'SUSPENSION',
    ]);
  });

  it('mengabaikan suspensi yang sudah lewat dua tahun', () => {
    const a = assessRiskSignals({
      suspensions: [{ symbol: 'AMAR.JK', suspension_date: '2019-01-01', reason: 'x', pdf_url: null }],
      actions: null,
      freeFloat: 0.4,
      overview: { ...overview, market_cap_rank: 12 },
      today: TODAY,
    });
    expect(a.signals).toHaveLength(0);
  });
});

describe('verifySafety', () => {
  it('membantah klaim "aman" bila ada sinyal risiko terukur', async () => {
    const client = seededClient([
      {
        endpoint: 'fetchCompanyReport',
        params: { symbol: 'AMAR', sections: ['overview'] },
        response: {
          symbol: 'AMAR.JK',
          company_name: 'Bank Amar',
          overview: { sub_sector: 'Banks', market_cap: 1e12, market_cap_rank: 240, tags: [], indices: [] },
        },
      },
      {
        endpoint: 'fetchSuspensions',
        params: { symbol: 'AMAR', limit: 30 },
        response: {
          results: [
            { symbol: 'AMAR.JK', suspension_date: '2026-03-01', reason: 'penurunan harga', pdf_url: null },
          ],
          pagination: { total_count: 1, showing: 1, limit: 30, offset: 0, has_next: false, next_offset: null },
        },
      },
      {
        endpoint: 'fetchCorporateActions',
        params: { symbol: 'AMAR' },
        response: {
          symbol: 'AMAR.JK',
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
      },
      {
        endpoint: 'fetchFreeFloat',
        params: { sub_sector: 'banks' },
        response: [{ symbol: 'AMAR.JK', company_name: 'Bank Amar', free_float: 0.11 }],
      },
    ]);

    const out = await verifySafety(
      makeClaim('safety', 'AMAR', { metric: 'keamanan' }),
      ctx(client),
    );
    expect(out.matches).toBe(false);
    expect(out.note).toContain('disuspensi');
    expect(out.note.toLowerCase()).toContain('free float 11,0%');
    expect(out.evidence.map((e) => e.label)).toContain('Free float AMAR');
  });
});

describe('period and metric safety', () => {
  it('does not use a different year when the matching quarter is missing', () => {
    const rows = [QUARTERS[0]!, QUARTERS[1]!, QUARTERS[2]!, QUARTERS[3]!, { ...QUARTERS[4]!, date: '2024-06-30' }];
    expect(computeGrowth(rows, 'yoy', 'earnings')).toBeNull();
    expect(computeGrowth(QUARTERS, 'yoy', 'earnings', '2025-03-31')).toBeNull();
  });
  it('does not route NIM or interest income to earnings or total revenue', async () => {
    for (const metric of ['portofolio kredit', 'jumlah nasabah']) {
      const out = await verifyEarningsGrowth(makeClaim('earnings_growth', 'BBTN', { metric, value: 3.5, unit: '%' }), ctx(seededClient([])));
      expect(out.matches).toBeNull(); expect(out.evidence).toEqual([]); expect(out.note).toContain('definisi yang sama');
    }
  });
  const half = { year: 2026, q: 2, kind: 'semester' as const, reportDate: '2026-06-30' };
  it('sums only explicitly quarterly data, without substituting Q2 for H1', () => {
    const rows = [
      { symbol: 'BBTN', date: '2026-03-31', earnings: 100, revenue: 200, period_basis: 'quarterly' },
      { symbol: 'BBTN', date: '2026-06-30', earnings: 140, revenue: 300, period_basis: 'quarterly' },
      { symbol: 'BBTN', date: '2025-03-31', earnings: 60, revenue: 100, period_basis: 'quarterly' },
      { symbol: 'BBTN', date: '2025-06-30', earnings: 100, revenue: 200, period_basis: 'quarterly' },
    ];
    expect(computeSemesterGrowth(rows, 'earnings', half)?.growthPct).toBeCloseTo(50);
    expect(computeSemesterGrowth(rows.slice(1), 'earnings', half)).toBeNull();
    expect(computeSemesterGrowth(rows.map(({ period_basis, ...row }) => row), 'earnings', half)).toBeNull();
  });
  it('compares H1 cumulative data directly without adding Q1 again', () => {
    const rows = [{ symbol: 'BBTN', date: '2026-06-30', earnings: 240, revenue: 500, period_basis: 'cumulative' },
      { symbol: 'BBTN', date: '2025-06-30', earnings: 160, revenue: 300, period_basis: 'cumulative' }];
    expect(computeSemesterGrowth(rows, 'earnings', half)?.growthPct).toBeCloseTo(50);
  });
});


describe('BBTN semester regression', () => {
  it('verifies H1 profit growth by summing standalone quarters from both years', async () => {
    const rows = [
      { symbol: 'BBTN', date: '2026-06-30', earnings: 1294233000000 },
      { symbol: 'BBTN', date: '2026-03-31', earnings: 1107979000000 },
      { symbol: 'BBTN', date: '2025-12-31', earnings: 1198474000000 },
      { symbol: 'BBTN', date: '2025-09-30', earnings: 596291000000 },
      { symbol: 'BBTN', date: '2025-06-30', earnings: 802679000000 },
      { symbol: 'BBTN', date: '2025-03-31', earnings: 903710000000 },
    ];
    const client = seededClient([{ endpoint: 'fetchQuarterlyFinancials', params: { symbol: 'BBTN', n_quarters: 6, report_date: '2026-06-30' }, response: rows }]);
    const claim = makeClaim('earnings_growth', 'BBTN', { metric: 'pertumbuhan laba bersih yoy', value: 40.8, unit: '%', period: 'Semester satu 2026' });
    const out = await verifyEarningsGrowth(claim, ctx(client));
    expect(out.matches).toBe(true);
    expect(out.computed?.value).toBeCloseTo(40.78);
    expect(out.evidence).toHaveLength(3);
    expect(out.evidence.map(item => item.value)).toContain(2402212000000);
    expect(out.evidence.map(item => item.value)).toContain(1706389000000);
  });
  it('preserves explicit cumulative provider metadata instead of summing it again', async () => {
    const client = seededClient([{ endpoint: 'fetchQuarterlyFinancials', params: { symbol: 'BBTN', n_quarters: 6, report_date: '2026-06-30' }, response: [
      { symbol: 'BBTN', date: '2026-06-30', earnings: 240, period_basis: 'cumulative' },
      { symbol: 'BBTN', date: '2025-06-30', earnings: 160, period_basis: 'cumulative' },
    ] }]);
    const out = await verifyEarningsGrowth(makeClaim('earnings_growth', 'BBTN', { metric: 'pertumbuhan laba', value: 50, unit: '%', period: 'Semester I 2026' }), ctx(client));
    expect(out.matches).toBe(true);
    expect(out.computed?.value).toBe(50);
  });
});

it('enables profit growth independently of other extended claim types', () => {
  expect(enabledClaimTypes({ earnings_growth: true, claim_types_ext: false })).toEqual(['valuation', 'dividend', 'price_move', 'earnings_growth']);
  expect(enabledClaimTypes({})).toEqual(['valuation', 'dividend', 'price_move']);
  expect(enabledClaimTypes({ claim_types_ext: true })).toContain('foreign_flow');
});
