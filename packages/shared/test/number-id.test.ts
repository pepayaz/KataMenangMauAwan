import { describe, expect, it } from 'vitest';
import {
  extractNumbers,
  formatIndonesianNumber,
  numbersMatch,
  parseIndonesianNumber,
} from '../src/number-id.js';

describe('parseIndonesianNumber', () => {
  it('membaca desimal gaya Indonesia', () => {
    expect(parseIndonesianNumber('1.358,18')).toBe(1358.18);
    expect(parseIndonesianNumber('25,5')).toBe(25.5);
    expect(parseIndonesianNumber('-0,90')).toBe(-0.9);
  });

  it('membaca pemisah ribuan tanpa desimal', () => {
    expect(parseIndonesianNumber('1.358')).toBe(1358);
    expect(parseIndonesianNumber('10.950')).toBe(10950);
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
