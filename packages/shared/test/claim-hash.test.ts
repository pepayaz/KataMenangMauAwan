import { describe, expect, it } from 'vitest';
import { claimHash } from '../src/claim-hash.js';

const base = {
  ticker: 'ADRO',
  type: 'dividend' as const,
  asserted: { metric: 'yield dividen', value: 25.5, unit: '%' as const },
};

describe('claimHash', () => {
  it('stabil untuk klaim yang sama', () => {
    expect(claimHash(base)).toBe(claimHash({ ...base }));
  });

  it('tidak peduli huruf besar-kecil pada ticker dan metrik', () => {
    expect(claimHash(base)).toBe(
      claimHash({ ...base, ticker: 'adro', asserted: { ...base.asserted, metric: 'Yield Dividen' } }),
    );
  });

  it('menyamakan angka yang hanya beda di desimal kedua', () => {
    // Bab 6.5: nilai dibulatkan, supaya "25,5%" dan "25,52%" dikenali sebagai
    // klaim yang sama saat mendeteksi perubahan status.
    expect(claimHash(base)).toBe(claimHash({ ...base, asserted: { ...base.asserted, value: 25.52 } }));
  });

  it('membedakan emiten, tipe, dan nilai yang berbeda', () => {
    expect(claimHash(base)).not.toBe(claimHash({ ...base, ticker: 'BBRI' }));
    expect(claimHash(base)).not.toBe(claimHash({ ...base, type: 'valuation' }));
    expect(claimHash(base)).not.toBe(
      claimHash({ ...base, asserted: { ...base.asserted, value: 12 } }),
    );
  });
});
