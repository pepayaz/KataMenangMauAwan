/** Bentuk turunan dan ejaan dipisah tanda baca ikut ditolak; berlaku pada penjelasan produk. */
export const FORBIDDEN_OUTPUT_PATTERNS: readonly RegExp[] = [
  /\b(?:beli|membeli|dibeli|pembeli(?:an)?|jual|menjual|dijual|penjual(?:an)?|buy|sell|hold|holding|entry|exit)\b/iu,
  /\btarget\s*harga\b/iu,
  /\b(?:rekomendasi|direkomendasikan|merekomendasikan)\b/iu,
  /\b(?:ambil|tambah|kurangi)\s+posisi\b/iu,
];
export function isOutputAllowed(text: string): boolean {
  const normalized = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  return text.trim().length > 0 && !FORBIDDEN_OUTPUT_PATTERNS.some((pattern) => pattern.test(normalized));
}
