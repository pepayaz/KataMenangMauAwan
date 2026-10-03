import { describe, expect, it } from 'vitest';
import { detectStatusChanges } from '../lib/history.js';
import { summarizeLedger } from '../lib/credits.js';
import { renderReport } from '../../../scripts/credit-report.js';

type Row = Parameters<typeof detectStatusChanges>[0][number];

function row(overrides: Partial<Row>): Row {
  return {
    claim_hash: 'h1',
    claim_id: 'c1',
    check_id: 'cek-1',
    ticker: 'ADRO',
    type: 'dividend',
    asserted: {},
    verdict: 'supported',
    explanation: 'penjelasan',
    created_at: '2026-09-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('detectStatusChanges', () => {
  it('menemukan klaim yang statusnya berubah sejak cek terakhir', () => {
    const changes = detectStatusChanges([
      row({ verdict: 'misleading', created_at: '2026-09-24T00:00:00.000Z', check_id: 'cek-2' }),
      row({ verdict: 'supported', created_at: '2026-09-20T00:00:00.000Z', check_id: 'cek-1' }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.previousVerdict).toBe('supported');
    expect(changes[0]?.currentVerdict).toBe('misleading');
    expect(changes[0]?.currentCheckId).toBe('cek-2');
  });

  it('diam bila statusnya tidak berubah', () => {
    const changes = detectStatusChanges([
      row({ created_at: '2026-09-24T00:00:00.000Z' }),
      row({ created_at: '2026-09-20T00:00:00.000Z' }),
    ]);
    expect(changes).toHaveLength(0);
  });

  it('mengabaikan klaim yang baru dicek sekali', () => {
    expect(detectStatusChanges([row({})])).toHaveLength(0);
  });

  it('memisahkan klaim yang berbeda berdasarkan claim_hash', () => {
    const changes = detectStatusChanges([
      row({ claim_hash: 'h1', verdict: 'refuted', created_at: '2026-09-24T00:00:00.000Z' }),
      row({ claim_hash: 'h1', verdict: 'supported', created_at: '2026-09-20T00:00:00.000Z' }),
      row({ claim_hash: 'h2', verdict: 'supported', created_at: '2026-09-24T00:00:00.000Z' }),
      row({ claim_hash: 'h2', verdict: 'supported', created_at: '2026-09-20T00:00:00.000Z' }),
    ]);
    expect(changes.map((c) => c.claimHash)).toEqual(['h1']);
  });

  it('membandingkan dua cek terbaru, bukan yang paling lama', () => {
    // Statusnya sempat berubah lalu kembali; yang dilaporkan hanya lompatan terakhir.
    const changes = detectStatusChanges([
      row({ verdict: 'supported', created_at: '2026-09-24T00:00:00.000Z' }),
      row({ verdict: 'refuted', created_at: '2026-09-22T00:00:00.000Z' }),
      row({ verdict: 'supported', created_at: '2026-09-20T00:00:00.000Z' }),
    ]);
    expect(changes[0]?.previousVerdict).toBe('refuted');
    expect(changes[0]?.currentVerdict).toBe('supported');
  });
});

describe('summarizeLedger', () => {
  const rows = [
    { endpoint: 'fetchCompanyReport', credits: 8, cached: false, member: 'B', check_id: null, ts: '2026-09-24T10:00:00.000Z' },
    { endpoint: 'fetchCompanyReport', credits: 0, cached: true, member: 'B', check_id: null, ts: '2026-09-24T11:00:00.000Z' },
    { endpoint: 'fetchDailyPrice', credits: 2, cached: false, member: 'A', check_id: null, ts: '2026-09-23T10:00:00.000Z' },
  ];

  it('menghitung sisa anggaran per pos', () => {
    const report = summarizeLedger(rows, '2026-09-24T00:00:00.000Z');
    const b = report.members.find((m) => m.member === 'B');
    expect(b?.used).toBe(8);
    expect(b?.left).toBe(242);
  });

  it('memisahkan pemakaian hari ini', () => {
    const report = summarizeLedger(rows, '2026-09-24T00:00:00.000Z');
    expect(report.today.used).toBe(8);
    expect(report.today.calls).toBe(2);
    expect(report.today.cachedCalls).toBe(1);
  });

  it('mengurutkan endpoint dari yang termahal', () => {
    const report = summarizeLedger(rows, '2026-09-24T00:00:00.000Z');
    expect(report.byEndpoint[0]?.endpoint).toBe('fetchCompanyReport');
  });

  it('total sisa memakai anggaran 1.000 kredit', () => {
    const report = summarizeLedger(rows, '2026-09-24T00:00:00.000Z');
    expect(report.total.budget).toBe(1000);
    expect(report.total.used).toBe(10);
    expect(report.total.left).toBe(990);
  });
});

describe('renderReport', () => {
  it('menyusun laporan harian yang bisa ditempel ke chat tim', () => {
    const text = renderReport(
      [
        { endpoint: 'fetchCompanyReport', credits: 40, cached: false, member: 'B', ts: '2026-09-24T10:00:00.000Z' },
        { endpoint: 'fetchDailyPrice', credits: 5, cached: true, member: 'D', ts: '2026-09-24T11:00:00.000Z' },
      ],
      '2026-09-24T00:00:00.000Z',
      new Date('2026-09-24T21:00:00.000Z'),
    );
    expect(text).toContain('Sisa total: 955 dari 1000 kredit.');
    expect(text).toContain('B');
    expect(text).toContain('fetchCompanyReport: 40');
  });

  it('menandai pos yang anggarannya habis', () => {
    const text = renderReport(
      [{ endpoint: 'x', credits: 30, cached: false, member: 'C', ts: '2026-09-24T10:00:00.000Z' }],
      '2026-09-24T00:00:00.000Z',
    );
    expect(text).toContain('HABIS');
  });
});
