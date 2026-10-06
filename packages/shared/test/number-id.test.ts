import { describe, expect, it } from 'vitest';
import {
  extractNumbers,
  formatIndonesianNumber,
  numbersMatch,
  parseIndonesianNumber,
  parseNumber,
} from '../src/number-id.js';

describe('parseIndonesianNumber', () => {
  it('membaca desimal gaya Indonesia', () => {
    expect(parseIndonesianNumber('1.358,18')).toBe(1358.18);
    expect(parseIndonesianNumber('25,5')).toBe(25.5);
    expect(parseIndonesianNumber('-0,90')).toBe(-0.9);
  });

  it('tidak menebak pemisah tunggal yang ambigu', () => {
    expect(parseIndonesianNumber('1.358')).toBeNull();
    expect(parseIndonesianNumber('10.950')).toBeNull();
  });

  it('membaca desimal gaya Inggris', () => {
    expect(parseIndonesianNumber('5.6')).toBe(5.6);
    expect(parseIndonesianNumber('1,358.18')).toBe(1358.18);
  });

  it('menolak yang bukan angka', () => {
    expect(parseIndonesianNumber('abc')).toBeNull();
    expect(parseIndonesianNumber('')).toBeNull();
  });
});

describe('parseNumber — ekspresi lengkap', () => {
  it.each([
    ['1.358,18', 1358.18, null, 1358.18],
    ['25,5%', 25.5, '%', 0.255],
    ['25,5 persen', 25.5, '%', 0.255],
    ['Rp2,4 T', 2.4, 'IDR', 2.4e12],
    ['Rp 349,5 miliar', 349.5, 'IDR', 349.5e9],
    ['3x', 3, 'x', 3],
    ['3 kali', 3, 'x', 3],
    ['-0,90', -0.9, null, -0.9],
    ['−0,90', -0.9, null, -0.9],
    ['0.45', 0.45, null, 0.45],
    ['setengah', 0.5, null, 0.5],
    ['dua kali lipat', 2, 'x', 2],
    ['setengah persen', 0.5, '%', 0.005],
    ['setengah juta', 0.5, null, 500000],
    ['2 kali lipat', 2, 'x', 2],
    ['+12,5%', 12.5, '%', 0.125],
    ['Rp−349,5 miliar', -349.5, 'IDR', -349.5e9],
    ['Rp 1.358,18', 1358.18, 'IDR', 1358.18],
    ['1,358.18', 1358.18, null, 1358.18],
    ['1.234.567', 1234567, null, 1234567],
    ['1,234,567', 1234567, null, 1234567],
    ['1.234.567,89', 1234567.89, null, 1234567.89],
    ['1,234,567.89', 1234567.89, null, 1234567.89],
    ['0', 0, null, 0],
    ['100%', 100, '%', 1],
    ['5.6', 5.6, null, 5.6],
    ['1,25 juta saham', 1.25, 'shares', 1250000],
    ['4,28 miliar lembar', 4.28, 'shares', 4.28e9],
    ['500 shares', 500, 'shares', 500],
    ['Rp2 jt', 2, 'IDR', 2e6],
    ['Rp3 ribu', 3, 'IDR', 3000],
    ['Rp4 triliun', 4, 'IDR', 4e12],
    ['Rp2 B', 2, 'IDR', 2e9],
    ['25,5 PERSEN', 25.5, '%', 0.255],
    ['DUA  KALI LIPAT', 2, 'x', 2],
    ['Rp\u00a02,4\u00a0T', 2.4, 'IDR', 2.4e12],
  ] as const)('membaca %s', (raw, value, unit, normalized) => {
    const parsed = parseNumber(raw);
    expect(parsed).toMatchObject({ value, unit, raw, span: [0, raw.length], ambiguous: false });
    expect(parsed?.normalized).toBeCloseTo(normalized, 5);
    const extracted = extractNumbers(`📈 ${raw}!`);
    expect(extracted).toHaveLength(1);
    expect(extracted[0]).toMatchObject({ value, unit, raw, span: [3, 3 + raw.length], ambiguous: false });
  });

  it.each([['Rp10.950', 10950], ['Rp 5.925', 5925], ['Rp1.358', 1358], ['Rp1,358', 1358], ['-Rp965', null]] as const)
  ('Rp tanpa skala membaca kelompok tiga digit %s sebagai ribuan', (raw, value) => {
    const parsed = parseNumber(raw);
    if (value === null) return expect(parsed).toBeNull();
    expect(parsed).toMatchObject({ ambiguous: false, unit: 'IDR', value, normalized: value });
  });
  it('desimal rupiah dua digit tidak berubah', () => {
    expect(parseNumber('Rp1.358,18')).toMatchObject({ value: 1358.18 });
    expect(parseNumber('Rp2,4 T')).toMatchObject({ value: 2.4, normalized: 2.4e12 });
    expect(parseNumber('Rp15.5 Triliun')).toMatchObject({ value: 15.5, normalized: 15.5e12 });
  });

  it.each(['1.358', '10.950', '1,358', '0.255', '0,255', 'Rp1.358 M', 'Rp2,4 M', '2 M', '3 M lembar'])
  ('menandai %s sebagai ambigu tanpa nilai tebakan', (raw) => {
    expect(parseNumber(raw)).toMatchObject({ ambiguous: true, value: undefined, normalized: undefined, raw });
    expect(extractNumbers(raw)[0]?.ambiguous).toBe(true);
  });

  it.each(['', 'abc', '1..2', '1,,2', '12.34,56', '1.234.56', '1,23,456',
    'Rp3%', 'Rp3x', 'Rp3 saham', 'dua kali lipat persen', 'NaN', 'Infinity', '1e3', '--2', '3.'])
  ('menolak ekspresi invalid %s', (raw) => expect(parseNumber(raw)).toBeNull());

  it('mempertahankan span dengan spasi luar', () => {
    const input = '  Rp2,4 T  ';
    const parsed = parseNumber(input)!;
    expect(parsed.span).toEqual([2, 9]);
    expect(input.slice(...parsed.span)).toBe(parsed.raw);
  });

  it('memisahkan tanda baca dan tidak menyerap spasi akhir', () => {
    const text = 'Yield 25,5%, PER 3 kali. Nilai −0,90; Rp2,4 T.';
    const results = extractNumbers(text);
    expect(results.map((n) => n.raw)).toEqual(['25,5%', '3 kali', '−0,90', 'Rp2,4 T']);
    for (const n of results) expect(text.slice(...n.span)).toBe(n.raw);
    expect(extractNumbers(text)).toEqual(results);
  });

  it('tidak mengambil angka dari kode, eksponen, atau token rusak', () => {
    expect(extractNumbers('BBRI123 Q2 1e3 1..2 1,,2')).toEqual([]);
  });

  it('membaca angka sebelum kata biasa tanpa mengambil awalan satuan', () => {
    expect(extractNumbers('3 tahun 4 transaksi 5 kapital')[0]?.raw).toBe('3');
    expect(extractNumbers('3 tahun 4 transaksi 5 kapital').map((n) => n.unit)).toEqual([null, null, null]);
  });

  it('menolak overflow', () => {
    expect(parseNumber('9'.repeat(400))).toBeNull();
  });
});

describe('extractNumbers', () => {
  it('menarik persen beserta normalisasinya', () => {
    const [n] = extractNumbers('yield dividennya 25,5% setahun');
    expect(n?.value).toBe(25.5);
    expect(n?.unit).toBe('%');
    expect(n?.normalized).toBeCloseTo(0.255);
  });

  it('menarik kelipatan valuasi', () => {
    const [n] = extractNumbers('PER cuma 3x');
    expect(n?.value).toBe(3);
    expect(n?.unit).toBe('x');
  });

  it('menarik satuan besar rupiah', () => {
    const nums = extractNumbers('asing borong 4,28 miliar lembar');
    expect(nums[0]?.normalized).toBeCloseTo(4.28e9);
  });

  it('mencatat posisi angka di dalam teks', () => {
    const text = 'PER 3x';
    const [n] = extractNumbers(text);
    expect(text.slice(n!.span[0], n!.span[1])).toContain('3');
  });
});

describe('numbersMatch', () => {
  it('menyamakan persen dengan pecahan', () => {
    expect(numbersMatch(25.5, 0.255)).toBe(true);
    expect(numbersMatch(5.6, 0.056)).toBe(true);
  });

  it('menolak persen yang dibulatkan ke arah yang salah', () => {
    // 0,0576 adalah 5,8% setelah dibulatkan, bukan 5,6%. Grounding validator
    // harus menolaknya: inilah cara angka pelan-pelan melenceng di penjelasan.
    expect(numbersMatch(5.6, 0.0576518218623482)).toBe(false);
    expect(numbersMatch(5.8, 0.0576518218623482)).toBe(true);
  });

  it('memaklumi pembulatan', () => {
    expect(numbersMatch(1358.18, 1358.1832)).toBe(true);
  });

  it('menolak angka yang benar-benar beda', () => {
    expect(numbersMatch(25.5, 0.056)).toBe(false);
  });
});

describe('formatIndonesianNumber', () => {
  it('memakai titik ribuan dan koma desimal', () => {
    expect(formatIndonesianNumber(1358.18)).toBe('1.358,18');
  });
});
