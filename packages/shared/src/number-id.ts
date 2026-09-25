/**
 * Parser dan format angka Indonesia.
 *
 * Dipakai grounding validator (A, bab 3.6) dan verifier (B, bab 4). Ditaruh di
 * shared supaya kedua sisi memakai definisi "angka yang sama" yang persis sama.
 *
 * Format Indonesia: titik memisah ribuan, koma memisah desimal — 1.358,18.
 * Format Inggris juga diterima karena konten media sosial mencampur keduanya.
 */

export type ParsedNumber = {
  /** Nilai dasar tanpa satuan, mis. "25,5%" -> 25.5 */
  value: number;
  /** Nilai ternormalisasi ke satuan dasar: persen -> pecahan, miliar -> angka penuh. */
  normalized: number;
  unit: '%' | 'x' | 'IDR' | 'shares' | null;
  /** Teks asli yang cocok. */
  raw: string;
  /** Posisi [awal, akhir) di dalam teks masukan. */
  span: [number, number];
};

const SCALES: Record<string, number> = {
  rb: 1e3,
  ribu: 1e3,
  k: 1e3,
  jt: 1e6,
  juta: 1e6,
  m: 1e6,
  mn: 1e6,
  miliar: 1e9,
  milyar: 1e9,
  miliyar: 1e9,
  bn: 1e9,
  b: 1e9,
  t: 1e12,
  triliun: 1e12,
  trilyun: 1e12,
  tn: 1e12,
};

/**
 * Menafsirkan satu token angka. Ambigu bila ada titik maupun koma; aturannya:
 * pemisah yang muncul terakhir adalah pemisah desimal.
 */
export function parseIndonesianNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!/^[-+]?[\d.,]+$/.test(cleaned)) return null;

  const sign = cleaned.startsWith('-') ? -1 : 1;
  const body = cleaned.replace(/^[-+]/, '');
  if (body === '') return null;

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');

  let intPart: string;
  let fracPart = '';

  if (lastDot === -1 && lastComma === -1) {
    intPart = body;
  } else if (lastComma > lastDot) {
    // Koma paling kanan -> desimal gaya Indonesia (1.358,18)
    intPart = body.slice(0, lastComma).replace(/[.,]/g, '');
    fracPart = body.slice(lastComma + 1);
  } else if (lastDot > lastComma) {
    const tail = body.slice(lastDot + 1);
    // Titik dengan tepat 3 digit di belakang dan tanpa koma bisa jadi ribuan
    // gaya Indonesia (1.358) atau desimal gaya Inggris (1.358). Kalau ada lebih
    // dari satu titik, itu pasti pemisah ribuan.
    const dotCount = (body.match(/\./g) ?? []).length;
    if (lastComma === -1 && tail.length === 3 && dotCount >= 1 && /^\d+$/.test(tail)) {
      // 1.358 -> ribuan bila bagian depan pendek dan tidak ada koma di mana pun.
      intPart = body.replace(/\./g, '');
    } else {
      intPart = body.slice(0, lastDot).replace(/[.,]/g, '');
      fracPart = tail;
    }
  } else {
    intPart = body.replace(/[.,]/g, '');
  }

  if (fracPart !== '' && !/^\d+$/.test(fracPart)) return null;
  if (intPart !== '' && !/^\d+$/.test(intPart)) return null;

  const n = Number(`${intPart === '' ? '0' : intPart}.${fracPart === '' ? '0' : fracPart}`);
  return Number.isFinite(n) ? sign * n : null;
}

const NUMBER_RE =
  /([-+]?\d[\d.,]*)\s*(%|persen|x|kali|rb|ribu|jt|juta|miliar|milyar|miliyar|triliun|trilyun|k|bn|tn)?/gi;

/** Menarik setiap angka dari teks bebas, beserta satuan dan posisinya. */
export function extractNumbers(text: string): ParsedNumber[] {
  const out: ParsedNumber[] = [];
  NUMBER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMBER_RE.exec(text)) !== null) {
    const numeric = m[1];
    if (numeric === undefined) continue;
    const value = parseIndonesianNumber(numeric);
    if (value === null) continue;

    const suffix = (m[2] ?? '').toLowerCase();
    let unit: ParsedNumber['unit'] = null;
    let normalized = value;

    if (suffix === '%' || suffix === 'persen') {
      unit = '%';
      normalized = value / 100;
    } else if (suffix === 'x' || suffix === 'kali') {
      unit = 'x';
    } else if (suffix in SCALES) {
      unit = 'IDR';
      normalized = value * (SCALES[suffix] as number);
    }

    out.push({
      value,
      normalized,
      unit,
      raw: m[0].trim(),
      span: [m.index, m.index + m[0].length],
    });
  }
  return out;
}

/** Format angka gaya Indonesia: 1358.18 -> "1.358,18". */
export function formatIndonesianNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(fraction: number, decimals = 1): string {
  return `${formatIndonesianNumber(fraction * 100, decimals)}%`;
}

/**
 * Dua angka dianggap sama bila cocok setelah normalisasi yang wajar:
 * pembulatan, persen versus pecahan, dan satuan miliar/triliun.
 * Dipakai grounding validator untuk memutuskan apakah angka di penjelasan
 * benar-benar ada di evidence.
 */
export function numbersMatch(a: number, b: number, relTolerance = 0.005): boolean {
  const candidates = [b, b * 100, b / 100, b * 1e9, b / 1e9, b * 1e12, b / 1e12];
  return candidates.some((c) => {
    if (c === 0) return Math.abs(a) < 1e-9;
    if (Math.abs(a - c) < 1e-9) return true;
    // Toleransi pembulatan: cocok bila a adalah c yang dibulatkan ke desimal apa pun.
    for (let d = 0; d <= 4; d += 1) {
      if (Math.abs(a - roundTo(c, d)) < 1e-9) return true;
    }
    return Math.abs(a - c) / Math.abs(c) <= relTolerance;
  });
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
