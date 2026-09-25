import { describe, expect, it } from 'vitest';
import type { HistoricalValuation } from '@cek-dulu/sectors';
import {
  compareValuation,
  latestWithMetric,
  resolveValuationMetric,
  verifyValuation,
} from '../src/valuation.js';
import { ctx, makeClaim, seededClient } from './helpers.js';

const HISTORY: HistoricalValuation[] = [
  {
    year: 2021,
    pe: 3.1,
    pb: 0.7,
    ps: 0.9,
    pcf: 2.2,
    peg: 0.3,
    pe_peer_avg: 8.0,
    pb_peer_avg: 1.1,
    ps_peer_avg: 1.4,
  },
  {
    year: 2024,
    pe: 9.4,
    pb: 1.2,
    ps: 1.6,
    pcf: 6.1,
    peg: 1.2,
    pe_peer_avg: 11.2,
    pb_peer_avg: 1.4,
    ps_peer_avg: 1.9,
  },
  {
    year: 2025,
    pe: 12.5,
    pb: 1.4,
    ps: 1.8,
    pcf: 7.0,
    peg: 1.5,
    pe_peer_avg: 13.0,
    pb_peer_avg: 1.5,
    ps_peer_avg: 2.0,
  },
];

function client(history = HISTORY) {
  return seededClient([
    {
      endpoint: 'fetchCompanyReport',
      params: { symbol: 'ADRO', sections: ['valuation'] },
      response: {
        symbol: 'ADRO.JK',
        company_name: 'PT Adaro',
        valuation: {
          last_close_price: 2400,
          latest_close_date: '2026-09-23',
          daily_close_change: 0.01,
          forward_pe: 11.1,
          intrinsic_value: 3000,
          historical_valuation: history,
        },
      },
    },
  ]);
}

describe('resolveValuationMetric (murni)', () => {
  it('mengenali sebutan yang lazim', () => {
    expect(resolveValuationMetric('PER')).toBe('pe');
    expect(resolveValuationMetric('P/E')).toBe('pe');
    expect(resolveValuationMetric('PBV')).toBe('pb');
    expect(resolveValuationMetric('PEG')).toBe('peg');
  });

  it('mengembalikan null untuk metrik asing', () => {
    expect(resolveValuationMetric('EV/EBITDA')).toBeNull();
  });
});

describe('latestWithMetric (murni)', () => {
  it('memilih tahun terbaru yang punya nilai', () => {
    expect(latestWithMetric(HISTORY, 'pe')?.year).toBe(2025);
  });

  it('melewati tahun yang nilainya kosong', () => {
    const withGap = [...HISTORY, { ...HISTORY[2]!, year: 2026, pe: null }];
    expect(latestWithMetric(withGap, 'pe')?.year).toBe(2025);
  });
});

describe('compareValuation (murni)', () => {
  it('menerima angka dalam toleransi 10%', () => {
    expect(compareValuation(HISTORY, 'pe', 12.5)?.matches).toBe(true);
    expect(compareValuation(HISTORY, 'pe', 13.5)?.matches).toBe(true);
  });

  it('menolak angka di luar toleransi', () => {
    expect(compareValuation(HISTORY, 'pe', 3)?.matches).toBe(false);
  });

  it('melaporkan tahun lain yang cocok dengan angka klaim', () => {
    // "PER cuma 3x" benar untuk 2021, bukan untuk sekarang: bahan VAL_OWN_HISTORY.
    const c = compareValuation(HISTORY, 'pe', 3.1);
    expect(c?.matches).toBe(false);
    expect(c?.matchingYears).toEqual([2021]);
  });

  it('membawa rata-rata peer', () => {
    expect(compareValuation(HISTORY, 'pe', 12.5)?.peerAverage).toBe(13.0);
  });
});

describe('verifyValuation', () => {
  it('membantah klaim PER murah yang memakai angka lama', async () => {
    const out = await verifyValuation(
      makeClaim('valuation', 'ADRO', { metric: 'PER', value: 3, unit: 'x' }),
      ctx(client()),
    );
    expect(out.matches).toBe(false);
    expect(out.computed?.value).toBe(12.5);
    expect(out.note).toContain('2021');
  });

  it('mendukung klaim PER yang benar', async () => {
    const out = await verifyValuation(
      makeClaim('valuation', 'ADRO', { metric: 'PER', value: 12.5, unit: 'x' }),
      ctx(client()),
    );
    expect(out.matches).toBe(true);
    expect(out.evidence.map((e) => e.label)).toContain('PE ADRO 2025');
    expect(out.evidence.map((e) => e.label)).toContain('Rata-rata PE peer 2025');
  });

  it('tidak bisa memverifikasi metrik yang tidak didukung', async () => {
    const out = await verifyValuation(
      makeClaim('valuation', 'ADRO', { metric: 'EV/EBITDA', value: 4, unit: 'x' }),
      ctx(client()),
    );
    expect(out.matches).toBeNull();
  });

  it('tidak bisa memverifikasi bila tidak ada riwayat valuasi', async () => {
    const out = await verifyValuation(
      makeClaim('valuation', 'ADRO', { metric: 'PER', value: 3, unit: 'x' }),
      ctx(client([])),
    );
    expect(out.matches).toBeNull();
  });
});
