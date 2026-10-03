import { describe, expect, it } from 'vitest';
import type { DividendSection } from '@cek-dulu/sectors';
import { dividendBases, isDividendAmountClaim, matchDividendYield, verifyDividend } from '../src/dividend.js';
import { ctx, makeClaim, seededClient } from './helpers.js';

/**
 * Kasus ADRO adalah alasan produk ini ada (bab 1, "Nilai jual utama"):
 * rata-rata yield dividen 5 tahun memang 25,5%, tetapi satu pembayaran luar
 * biasa Rp1.358,18 pada 28 November 2024 menyumbang yield 45,2% sendirian.
 * Yield TTM hanya 5,6% dan cash payout ratio negatif.
 */
const ADRO_DIVIDEND: DividendSection = {
  historical_dividends: {
    '2022': {
      breakdown: [{ date: '2022-05-20', total: 700, yield: 0.24 }],
      total_yield: 0.24,
      total_dividend: 700,
    },
    '2023': {
      breakdown: [{ date: '2023-05-19', total: 450, yield: 0.18 }],
      total_yield: 0.18,
      total_dividend: 450,
    },
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

function adroClient() {
  return seededClient([
    {
      endpoint: 'fetchCompanyReport',
      params: { symbol: 'ADRO', sections: ['dividend'] },
      response: { symbol: 'ADRO.JK', company_name: 'PT Adaro', dividend: ADRO_DIVIDEND },
    },
  ]);
}

describe('dividendBases (murni)', () => {
  it('mengumpulkan yield TTM, rata-rata, dan per tahun', () => {
    const bases = dividendBases(ADRO_DIVIDEND);
    expect(bases.some((b) => b.kind === 'ttm')).toBe(true);
    expect(bases.some((b) => b.kind === 'avg')).toBe(true);
    expect(bases.filter((b) => b.kind === 'year')).toHaveLength(4);
  });
});

describe('matchDividendYield (murni)', () => {
  it('mengenali klaim 25% sebagai rata-rata 5 tahun, bukan TTM', () => {
    const m = matchDividendYield(ADRO_DIVIDEND, 0.255);
    expect(m.matches).toBe(true);
    expect(m.matched?.kind).toBe('avg');
    expect(m.ttm).toBeCloseTo(0.056);
  });

  it('mengenali klaim yang memang mengacu ke TTM', () => {
    const m = matchDividendYield(ADRO_DIVIDEND, 0.056);
    expect(m.matched?.kind).toBe('ttm');
  });

  it('membatasi pencocokan ke tahun yang disebut', () => {
    // 25,5% adalah rata-rata lima tahun, bukan yield 2025 yang 4,8%.
    const m = matchDividendYield(ADRO_DIVIDEND, 0.255, '2025');
    expect(m.matches).toBe(false);
  });

  it('menolak angka yang tidak punya dasar sama sekali', () => {
    expect(matchDividendYield(ADRO_DIVIDEND, 0.9).matches).toBe(false);
  });
});

describe('verifyDividend', () => {
  it('menyatakan angka cocok tetapi menandai dasarnya bukan TTM', async () => {
    const client = adroClient();
    const claim = makeClaim('dividend', 'ADRO', {
      metric: 'yield dividen',
      value: 25.5,
      unit: '%',
    });

    const out = await verifyDividend(claim, ctx(client));

    expect(out.matches).toBe(true);
    expect(out.details?.matchedBasis).toBe('avg');
    expect(out.details?.yieldTtm).toBeCloseTo(0.056);
    expect(out.note).toContain('rata-rata yield 5 tahun');
    expect(out.note).toContain('5,6%');
  });

  it('membangun evidence untuk setiap dasar yield', async () => {
    const out = await verifyDividend(
      makeClaim('dividend', 'ADRO', { metric: 'yield dividen', value: 25.5, unit: '%' }),
      ctx(adroClient()),
    );

    const labels = out.evidence.map((e) => e.label);
    expect(labels).toContain('Yield TTM ADRO');
    expect(labels).toContain('Rata-rata yield 5 tahun ADRO');
    expect(labels).toContain('Cash payout ratio ADRO');
    // evidenceId deterministik: sama untuk klaim dan data yang sama.
    expect(out.evidence[0]?.evidenceId).toMatch(/^cek-uji-c1:/);
  });

  it('membantah angka yang tidak punya dasar', async () => {
    const out = await verifyDividend(
      makeClaim('dividend', 'ADRO', { metric: 'yield dividen', value: 90, unit: '%' }),
      ctx(adroClient()),
    );
    expect(out.matches).toBe(false);
  });

  it('menandai tidak bisa diverifikasi bila data dividen tidak ada', async () => {
    const client = seededClient([
      {
        endpoint: 'fetchCompanyReport',
        params: { symbol: 'AMAR', sections: ['dividend'] },
        response: { symbol: 'AMAR.JK', company_name: 'Bank Amar' },
      },
    ]);
    const out = await verifyDividend(
      makeClaim('dividend', 'AMAR', { metric: 'yield dividen', value: 10, unit: '%' }),
      ctx(client),
    );
    expect(out.matches).toBeNull();
    expect(out.evidence).toHaveLength(0);
  });

  it('menandai tidak bisa diverifikasi bila cache kosong, tanpa memanggil API', async () => {
    const out = await verifyDividend(
      makeClaim('dividend', 'BBRI', { metric: 'yield dividen', value: 5, unit: '%' }),
      ctx(seededClient([])),
    );
    expect(out.matches).toBeNull();
    expect(out.note).toContain('cache_only');
  });
});

/** Data UNVR di cache Sectors (28 Sep 2026): interim tahun buku 2025 Rp87 dibayar 2025-12-15. */
const UNVR_DIVIDEND: DividendSection = {
  historical_dividends: {
    // Nominal sama (Rp87) juga dibayar 2020; periode klaim harus memilih 2025.
    '2020': { breakdown: [{ date: '2020-12-01', total: 87, yield: 0.0105 }], total_yield: 0.0105, total_dividend: 87 },
    '2025': {
      breakdown: [{ date: '2025-12-15', total: 87, yield: 0.0483 }, { date: '2025-06-16', total: 47, yield: 0.0261 }],
      total_yield: 0.0744,
      total_dividend: 134,
    },
    '2026': { breakdown: [{ date: '2026-06-15', total: 114, yield: 0.0699 }], total_yield: 0.0699, total_dividend: 114 },
  },
  upcoming_dividends: null,
  yield_ttm: 0.1233,
  dividend_yield_avg: { period: 5, avg_yield: 0.0488 },
  dividend_ttm: 201,
  payout_ratio: 1.0,
  cash_payout_ratio: 2.26,
  last_ex_dividend_date: '2026-06-15',
};
const unvrClient = () => seededClient([{ endpoint: 'fetchCompanyReport', params: { symbol: 'UNVR', sections: ['dividend'] },
  response: { symbol: 'UNVR.JK', company_name: 'Unilever Indonesia', dividend: UNVR_DIVIDEND } }]);

describe('dividen nominal per saham', () => {
  it('Rp87 per saham tahun buku 2025 cocok dengan pembayaran interim, bukan dibandingkan ke yield', async () => {
    const out = await verifyDividend(makeClaim('dividend', 'UNVR',
      { metric: 'dividen interim per saham', value: 87, unit: 'IDR', period: 'tahun buku 2025' }), ctx(unvrClient()));
    expect(out.matches).toBe(true);
    expect(out.details).toMatchObject({ matchedBasis: 'payment', claimKind: 'per_share_amount',
      matchedLabel: 'Dividen per saham UNVR 2025-12-15' });
    expect(out.evidence.map((e) => e.label).some((l) => l.includes('2020'))).toBe(false);
    expect(out.computed).toMatchObject({ value: 87, unit: 'IDR' });
    expect(out.evidence.every((e) => e.unit === 'IDR')).toBe(true);
    expect(out.evidence.map((e) => e.label)).not.toContain('Yield TTM UNVR');
  });

  it('nominal yang tidak pernah dibayar dibantah', async () => {
    const out = await verifyDividend(makeClaim('dividend', 'UNVR',
      { metric: 'dividen per saham', value: 150, unit: 'IDR', period: '2025' }), ctx(unvrClient()));
    expect(out.matches).toBe(false);
  });

  it('total nilai dividen perusahaan (Rp3,3 triliun) tidak bisa diverifikasi', async () => {
    const out = await verifyDividend(makeClaim('dividend', 'UNVR',
      { metric: 'total dividen', value: 3.3e12, unit: 'IDR' }), ctx(unvrClient()));
    expect(out.matches).toBeNull();
    expect(out.note).toContain('per saham');
  });

  it('tanpa periode, dividen TTM juga menjadi dasar', async () => {
    const out = await verifyDividend(makeClaim('dividend', 'UNVR',
      { metric: 'dividen per saham', value: 201, unit: 'IDR' }), ctx(unvrClient()));
    expect(out.details).toMatchObject({ matchedBasis: 'ttm' });
  });

  it('isDividendAmountClaim membedakan yield dan nominal', () => {
    expect(isDividendAmountClaim({ asserted: { metric: 'yield', value: 5, unit: '%' } })).toBe(false);
    expect(isDividendAmountClaim({ asserted: { metric: 'dividen', value: 87, unit: 'IDR' } })).toBe(true);
    expect(isDividendAmountClaim({ asserted: { metric: 'dividend_per_share', value: 87 } })).toBe(true);
  });
});
