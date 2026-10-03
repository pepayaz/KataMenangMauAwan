import { describe, expect, it } from 'vitest';
import { MANUAL_ALIASES } from '../src/manual-aliases.js';
import { needsClarification, resolveEntities } from '../src/resolve-ticker.js';

const aliases = MANUAL_ALIASES;

describe('resolveEntities', () => {
  it('mengenali kode bertanda dengan keyakinan tertinggi', () => {
    const [e] = resolveEntities('lagi pantau $ADRO nih', { aliases });
    expect(e?.ticker).toBe('ADRO');
    expect(e?.method).toBe('explicit');
    expect(e?.confidence).toBeGreaterThan(0.9);
  });

  it('mengenali nama perusahaan dari kamus alias', () => {
    const [e] = resolveEntities('bank mandiri lagi murah', { aliases });
    expect(e?.ticker).toBe('BMRI');
    expect(e?.method).toBe('alias');
  });

  it('memenangkan alias yang lebih panjang', () => {
    // "mandiri" sendiri berbobot 0,9; "bank mandiri" berbobot 1,0.
    const [e] = resolveEntities('saham bank mandiri', { aliases });
    expect(e?.surface).toBe('bank mandiri');
  });

  it('mengenali plesetan grup', () => {
    const [e] = resolveEntities('batu bara grup thohir yield-nya gede', { aliases });
    expect(e?.ticker).toBe('ADRO');
  });

  it('tidak menganggap empat huruf kapital sembarangan sebagai ticker', () => {
    // Tanpa daftar emiten, kode telanjang tetap dikenali tetapi berkeyakinan
    // rendah; dengan daftar emiten, kata biasa ditolak sama sekali.
    const known = new Set(['ADRO', 'BBRI']);
    const entities = resolveEntities('SAYA MAU BELI', { aliases: [], knownTickers: known });
    expect(entities).toHaveLength(0);
  });

  it('menerima kode telanjang yang ada di daftar emiten', () => {
    const known = new Set(['ADRO']);
    const [e] = resolveEntities('ADRO naik terus', { aliases: [], knownTickers: known });
    expect(e?.ticker).toBe('ADRO');
  });

  it('meminta klarifikasi bila keyakinan di bawah ambang', () => {
    const low = [{ alias: 'saham emas', ticker: 'ANTM', weight: 0.5 }];
    const entities = resolveEntities('lagi ramai saham emas', { aliases: low });
    expect(needsClarification(entities)).toBe(true);
  });
});
