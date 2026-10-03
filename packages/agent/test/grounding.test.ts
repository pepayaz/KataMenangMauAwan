import { describe, expect, it, vi } from 'vitest';
import type { Evidence } from '@cek-dulu/shared';
import { GroundingError, groundingExclusions, validateGrounding, withGrounding } from '../src/grounding.js';

function evidence(value: number | string, unit?: string): Evidence {
  return { evidenceId: 'e1', claimId: 'c1', tool: 'fixture:synthetic', params: {},
    credits: 0, cached: true, fetchedAt: '2026-09-23T00:00:00.000Z', label: 'Data sintetis',
    value, ...(unit === undefined ? {} : { unit }) };
}

describe('validateGrounding', () => {
  it.each([
    ['PER 3x.', 3, 'x'],
    ['Yield 25,5%.', 0.255, '%'],
    ['Yield 25,5 persen.', 0.255, '%'],
    ['Yield 25,5%.', '25,5%', '%'],
    ['Yield 25,5%.', 0.255, undefined],
    ['Yield 25,5%.', '0.2550', '%'],
    ['Rp1.358,18.', 1358.1832, 'IDR'],
    ['Rp1.358,19.', 1358.185, 'IDR'],
    ['Rp2,4 T.', 2.44e12, 'IDR'],
    ['Rp349,5 miliar.', 349.46e9, 'IDR'],
    ['Rp2,4 triliun.', 'Rp2,4 T', 'IDR'],
    ['2,4 miliar lembar.', 2.4e9, 'shares'],
    ['Rp−0,90.', -0.897, 'IDR'],
    ['−0,90x.', -0.895, 'x'],
    ['0,0%.', 0.0001, '%'],
    ['setengah persen.', 0.005, '%'],
    ['dua kali lipat.', 2, 'x'],
    ['1.234.567.', 1234567, undefined],
    ['Nilainya 0.45.', 0.45, undefined],
  ] as const)('menerima %s dari evidence %s', (text, value, unit) => {
    expect(validateGrounding(text, [evidence(value, unit)])).toEqual({ ok: true, unmatched: [] });
  });

  it.each([
    ['Yield 30%.', 0.255, '%'],
    ['Yield 25,4%.', 0.255, '%'],
    ['Yield 25,51%.', 0.255, '%'],
    ['Yield 25,50%.', 0.2549, '%'],
    ['Yield 5,6%.', 0.05765, '%'],
    ['Rp1.358,18.', 1358.186, 'IDR'],
    ['Rp2,4 T.', 2.4e9, 'IDR'],
    ['Rp2,4 miliar.', 2.4e12, 'IDR'],
    ['Rp349,5 miliar.', 349.44e9, 'IDR'],
    ['−0,90x.', 0.897, 'x'],
    ['0,90x.', -0.897, 'x'],
    ['25,5%.', 0.255, 'IDR'],
    ['Rp3.', 3, 'shares'],
    ['3x.', 3, '%'],
    ['25,5%.', 25.5, '%'],
    ['3x.', 'PER 3x', 'x'],
    ['3x.', Number.NaN, 'x'],
    ['3x.', Number.POSITIVE_INFINITY, 'x'],
    ['1.358.', 1358, undefined],
    ['Rp2,4 M.', 2.4e9, 'IDR'],
  ] as const)('menolak %s dari evidence %s', (text, value, unit) => {
    const result = validateGrounding(text, [evidence(value, unit)]);
    expect(result.ok).toBe(false);
    expect(result.unmatched.length).toBeGreaterThan(0);
  });

  it('melaporkan raw dan span asli hanya untuk angka yang gagal', () => {
    const text = '📈 PER 3x, yield 30% dan Rp9 miliar.';
    const result = validateGrounding(text, [evidence(3, 'x')]);
    expect(result.unmatched.map((n) => n.raw)).toEqual(['30%', 'Rp9 miliar']);
    for (const n of result.unmatched) expect(text.slice(...n.span)).toBe(n.raw);
  });

  it('tidak mengambil angka dari label, params, atau tanggal evidence', () => {
    const source = { ...evidence('tidak tersedia'), label: 'PER 3x', params: { value: 3 } };
    expect(validateGrounding('PER 3x', [source]).ok).toBe(false);
  });

  it.each(['Q5', 'Rp1..2', '1e3', 'kode123', '1,,2'])('menolak digit yang parser lewati: %s', (text) => {
    expect(validateGrounding(text, []).ok).toBe(false);
  });

  it('teks tanpa angka lolos tanpa evidence', () => {
    expect(validateGrounding('Data tidak tersedia.', [])).toEqual({ ok: true, unmatched: [] });
  });
});

describe('pengecualian temporal eksplisit', () => {
  it.each([
    ['Pada 2024 data diperbarui.', 'year'],
    ['2024', 'year'],
    ['Periode 2021–2025.', 'year'],
    ['Pada 28 November 2024.', 'date'],
    ['Pada 28 Nov 2024.', 'date'],
    ['Tanggal 28/11/2024.', 'date'],
    ['Tanggal 28-11-2024.', 'date'],
    ['Tanggal 28.11.2024.', 'date'],
    ['Tanggal 2024-11-28.', 'date'],
    ['Tanggal 29/02/2024.', 'date'],
    ['Rata-rata 5 tahun.', 'duration'],
    ['Selama 20 hari.', 'duration'],
    ['Periode Q2.', 'quarter'],
    ['Laporan Q2 2024.', 'quarter'],
  ] as const)('mengecualikan %s dengan aturan %s', (text, kind) => {
    const exclusions = groundingExclusions(text);
    expect(exclusions.some((e) => e.kind === kind)).toBe(true);
    for (const e of exclusions) expect(text.slice(...e.span)).toBe(e.raw);
    expect(validateGrounding(text, [])).toEqual({ ok: true, unmatched: [] });
  });

  it.each(['Rp2024', '2024%', '2024 saham', 'Harga 2024', 'Tahun 2024%',
    'Tanggal 31/02/2024', 'Tanggal 29/02/2023', 'Tanggal 2024-13-28', '31 Februari 2024', 'Q5'])
  ('tidak menyamarkan data atau tanggal invalid: %s', (text) => {
    expect(validateGrounding(text, []).ok).toBe(false);
  });

  it('pengecualian tanggal tidak meloloskan angka finansial sesudahnya', () => {
    const text = 'Pada 28 Nov 2024 dan Q2, yield 30% selama 5 tahun.';
    expect(validateGrounding(text, []).unmatched.map((n) => n.raw)).toEqual(['30%']);
  });
});

describe('withGrounding', () => {
  const sources = [evidence(0.255, '%')];

  it('mengembalikan tulisan pertama yang lolos tanpa retry atau template', async () => {
    const write = vi.fn(() => 'Yield 25,5%.');
    const template = vi.fn(() => 'Data tidak tersedia.');
    expect(await withGrounding(write, sources, template)).toBe('Yield 25,5%.');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(undefined);
    expect(template).not.toHaveBeenCalled();
  });

  it('menulis ulang sekali dengan feedback angka yang gagal', async () => {
    const write = vi.fn().mockResolvedValueOnce('Yield 30%.').mockResolvedValueOnce('Yield 25,5%.');
    const template = vi.fn(() => 'Data tidak tersedia.');
    expect(await withGrounding(write, sources, template)).toBe('Yield 25,5%.');
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]?.[0]).toEqual({ previousText: 'Yield 30%.', unmatched: [{ raw: '30%', span: [6, 9] }] });
    expect(template).not.toHaveBeenCalled();
  });

  it('memanggil template deterministik setelah dua kegagalan', async () => {
    const write = vi.fn(() => 'Yield 99%.');
    const template = vi.fn(() => 'Yield 25,5%.');
    expect(await withGrounding(write, sources, template)).toBe('Yield 25,5%.');
    expect(write).toHaveBeenCalledTimes(2);
    expect(template).toHaveBeenCalledTimes(1);
    expect(template).toHaveBeenCalledWith(sources);
  });

  it('menolak template yang juga berisi angka karangan', async () => {
    const write = vi.fn(() => 'Yield 99%.');
    const template = vi.fn(() => 'Yield 88%.');
    await expect(withGrounding(write, sources, template)).rejects.toBeInstanceOf(GroundingError);
    expect(write).toHaveBeenCalledTimes(2);
    expect(template).toHaveBeenCalledTimes(1);
  });

  it('error template menyertakan hasil validasi', () => {
    const result = { ok: false, unmatched: [{ raw: '88%', span: [0, 3] as [number, number] }] };
    expect(new GroundingError(result).result).toEqual(result);
  });
});
