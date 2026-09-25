/**
 * Toleransi per tipe klaim — tabel bab 4.
 *
 * Dipusatkan di sini karena angkanya dipakai dua kali: sekali oleh verifier
 * untuk memutuskan `matches`, sekali oleh rapor untuk memberi tahu pengguna
 * seberapa longgar penilaiannya. Dua tempat yang berbeda pendapat akan membuat
 * rapor berbohong.
 */

/** Tipe 1 dan 4: toleransi relatif. 0,1 berarti ±10% dari nilai resmi. */
export const REL_TOLERANCE = {
  valuation: 0.1,
  dividend: 0.1,
  earnings_growth: 0.1,
} as const;

/** Tipe 3: toleransi absolut dalam poin persen. */
export const ABS_TOLERANCE_PP = {
  price_move: 3,
} as const;

/** Tipe 5: arus asing dianggap cocok bila arahnya sama dan besarnya dalam ±25%. */
export const FLOW_TOLERANCE = 0.25;

/**
 * Cocok secara relatif: |diklaim - resmi| <= toleransi * |resmi|.
 * Nilai resmi nol ditangani terpisah supaya tidak membagi dengan nol.
 */
export function withinRelative(claimed: number, actual: number, tolerance: number): boolean {
  if (actual === 0) return Math.abs(claimed) <= tolerance;
  return Math.abs(claimed - actual) / Math.abs(actual) <= tolerance;
}

/** Cocok secara absolut, dipakai untuk besaran yang sudah berupa persen. */
export function withinAbsolute(claimed: number, actual: number, tolerance: number): boolean {
  return Math.abs(claimed - actual) <= tolerance;
}

/**
 * Menyamakan satuan angka yang diklaim dengan angka resmi.
 *
 * Sectors mengembalikan rasio sebagai pecahan (0,255) sementara pengguna
 * menulis persen (25,5%). Menebak dari besarnya angka berbahaya, jadi
 * keputusannya dibuat dari satuan yang diekstrak, dan hanya jatuh ke tebakan
 * bila satuannya hilang.
 */
export function toFraction(value: number, unit: string | undefined): number {
  if (unit === '%') return value / 100;
  if (unit === undefined && Math.abs(value) > 1.5) return value / 100;
  return value;
}

export function describeRelative(tolerance: number): string {
  return `±${Math.round(tolerance * 100)}% relatif terhadap angka resmi`;
}

export function describeAbsolute(pp: number): string {
  return `±${pp} poin persen`;
}
