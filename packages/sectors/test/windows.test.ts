import { describe, expect, it } from 'vitest';
import {
  addDays,
  parseWindowPhrase,
  splitWindow,
  windowEndingToday,
  windowLengthDays,
} from '../src/windows.js';

describe('splitWindow', () => {
  it('membiarkan jendela yang sudah muat', () => {
    const w = { start: '2026-01-01', end: '2026-01-30' };
    expect(splitWindow(w, 90)).toEqual([w]);
  });

  it('memecah 180 hari menjadi potongan maksimal 90 hari', () => {
    const w = { start: '2026-01-01', end: '2026-06-29' };
    const parts = splitWindow(w, 90);
    expect(parts.length).toBe(2);
    expect(parts[0]?.start).toBe('2026-01-01');
    expect(parts.at(-1)?.end).toBe('2026-06-29');
    for (const p of parts) expect(windowLengthDays(p)).toBeLessThanOrEqual(90);
  });

  it('memecah tanpa celah maupun tumpang tindih', () => {
    const parts = splitWindow({ start: '2026-01-01', end: '2026-03-01' }, 14);
    for (let i = 1; i < parts.length; i += 1) {
      expect(parts[i]?.start).toBe(addDays(parts[i - 1]!.end, 1));
    }
  });

  it('memakai batas 14 hari untuk broker summary', () => {
    const parts = splitWindow({ start: '2026-01-01', end: '2026-01-31' }, 14);
    expect(parts.length).toBe(3);
    for (const p of parts) expect(windowLengthDays(p)).toBeLessThanOrEqual(14);
  });
});

describe('parseWindowPhrase', () => {
  it('menerjemahkan sebutan bahasa Indonesia', () => {
    expect(parseWindowPhrase('sebulan')).toBe(30);
    expect(parseWindowPhrase('seminggu')).toBe(7);
    expect(parseWindowPhrase('setahun')).toBe(365);
    expect(parseWindowPhrase('3 bulan')).toBe(90);
    expect(parseWindowPhrase('5 hari')).toBe(5);
  });

  it('mengembalikan null untuk yang tidak dikenali', () => {
    expect(parseWindowPhrase('belakangan ini')).toBeNull();
    expect(parseWindowPhrase(undefined)).toBeNull();
  });
});

describe('windowEndingToday', () => {
  it('menghasilkan jendela inklusif sepanjang yang diminta', () => {
    const w = windowEndingToday(30, '2026-09-24');
    expect(w.end).toBe('2026-09-24');
    expect(windowLengthDays(w)).toBe(30);
  });
});
