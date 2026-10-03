/** Parser deterministik; span memakai indeks UTF-16 [awal, akhir). */
export type NumberUnit = '%' | 'x' | 'IDR' | 'shares' | null;

type NumberLocation = { unit: NumberUnit; raw: string; span: [number, number] };
export type ParsedNumber = NumberLocation & (
  | { ambiguous: false; value: number; normalized: number }
  | { ambiguous: true; value: undefined; normalized: undefined }
);

type Numeric = { ambiguous: false; value: number } | { ambiguous: true };

const SCALES: Record<string, number> = {
  rb: 1e3, ribu: 1e3, k: 1e3,
  jt: 1e6, juta: 1e6, mn: 1e6,
  miliar: 1e9, milyar: 1e9, miliyar: 1e9, bn: 1e9, b: 1e9,
  t: 1e12, triliun: 1e12, trilyun: 1e12, tn: 1e12,
};

/** Pemisah harus konsisten; satu kelompok tiga digit dapat memiliki dua makna. */
function parseNumeric(raw: string): Numeric | null {
  const token = raw.replace(/\u2212/g, '-');
  if (!/^[+-]?\d+(?:[.,]\d+)*$/.test(token)) return null;
  const body = token.replace(/^[+-]/, '');
  let decimal: string;
  if (body.includes('.') && body.includes(',')) {
    if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(body)) {
      decimal = token.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(body)) {
      decimal = token.replace(/,/g, '');
    } else return null;
  } else {
    const groups = body.split(/[.,]/);
    if (groups.length > 2) {
      if (!/^\d{1,3}([.,])\d{3}(?:\1\d{3})+$/.test(body)) return null;
      decimal = token.replace(/[.,]/g, '');
    } else if (groups.length === 2) {
      // Tidak memilih ribuan atau desimal hanya berdasarkan bahasa antarmuka.
      if (groups[0]!.length <= 3 && groups[1]!.length === 3) return { ambiguous: true };
      decimal = token.replace(',', '.');
    } else decimal = token;
  }
  const value = Number(decimal);
  return Number.isFinite(value) ? { ambiguous: false, value } : null;
}

const SCALE_PATTERN = 'miliar|milyar|miliyar|triliun|trilyun|ribu|juta|rb|jt|mn|bn|tn|[kmbt]';
const SUFFIX_PATTERN = `(?:%|persen|x|kali(?:\\s+lipat)?|(?:${SCALE_PATTERN})(?:\\s+(?:lembar|saham|shares))?|lembar|saham|shares)`;
const EXPRESSION = new RegExp(
  `^(Rp\\s*)?([+\\-−]?\\d+(?:[.,]\\d+)*|setengah|dua\\s+kali\\s+lipat)(?:\\s*(${SUFFIX_PATTERN}))?$`, 'i',
);
const SCANNER = new RegExp(
  `(?<![\\p{L}\\p{N}_.,+\\-−])(?:Rp\\s*)?(?:[+\\-−]?\\d+(?:[.,]\\d+)*|setengah|dua\\s+kali\\s+lipat)(?:\\s*${SUFFIX_PATTERN})?(?![\\p{L}\\p{N}_]|[.,]\\d)`, 'giu',
);

/**
 * Membaca satu ekspresi lengkap. Invalid -> null; ambigu -> tanpa nilai tebakan.
 * value tetap berupa mantissa (25,5% -> 25.5; Rp2,4 T -> 2.4).
 * normalized adalah nilai dasar (0.255 dan 2.4e12). Skala tanpa Rp tidak
 * otomatis diasumsikan sebagai uang; "miliar lembar" memiliki unit shares.
 */
export function parseNumber(input: string): ParsedNumber | null {
  const raw = input.trim();
  const start = input.length - input.trimStart().length;
  const match = EXPRESSION.exec(raw);
  if (!match) return null;
  const currency = match[1] !== undefined;
  const numericText = match[2]!;
  const suffix = (match[3] ?? '').toLowerCase().replace(/\s+/g, ' ');
  const words = numericText.toLowerCase().replace(/\s+/g, ' ');
  const numeric: Numeric | null = words === 'setengah'
    ? { ambiguous: false, value: 0.5 }
    : words === 'dua kali lipat'
      ? { ambiguous: false, value: 2 }
      : parseNumeric(numericText);
  if (numeric === null) return null;
  if (words === 'dua kali lipat' && (suffix !== '' || currency)) return null;

  let unit: NumberUnit = currency ? 'IDR' : null;
  let scale = 1;
  let ambiguous = numeric.ambiguous;
  if (suffix === '%' || suffix === 'persen') {
    if (currency) return null;
    unit = '%';
    scale = 0.01;
  } else if (/^(?:x|kali(?: lipat)?)$/.test(suffix) || words === 'dua kali lipat') {
    if (currency) return null;
    unit = 'x';
  } else if (suffix !== '') {
    const shares = /(?:^| )(?:lembar|saham|shares)$/.test(suffix);
    if (shares && currency) return null;
    if (shares) unit = 'shares';
    const scaleName = suffix.replace(/(?:^| )(?:lembar|saham|shares)$/, '');
    // M dipakai untuk million maupun miliar di media sosial, termasuk sesudah Rp.
    if (scaleName === 'm') ambiguous = true;
    else if (scaleName !== '') scale = SCALES[scaleName]!;
  }
  const location: NumberLocation = { unit, raw, span: [start, start + raw.length] };
  if (ambiguous || numeric.ambiguous) {
    return { ...location, ambiguous: true, value: undefined, normalized: undefined };
  }
  const normalized = numeric.value * scale;
  if (!Number.isFinite(normalized)) return null;
  return { ...location, ambiguous: false, value: numeric.value, normalized };
}

/** Pembantu skalar lama: format ambigu/invalid tidak menghasilkan angka. */
export function parseIndonesianNumber(raw: string): number | null {
  const parsed = parseNumeric(raw.trim());
  return parsed && !parsed.ambiguous ? parsed.value : null;
}

/** Menarik angka dan hasil ambigu tanpa mengubah raw atau koordinat teks. */
export function extractNumbers(text: string): ParsedNumber[] {
  const out: ParsedNumber[] = [];
  // Regex lokal agar state lastIndex tidak bocor antarpanggilan.
  for (const match of text.matchAll(new RegExp(SCANNER))) {
    // Hindari mengambil awalan angka dari token pemisah yang rusak (1..2, 1,,2).
    const end = match.index + match[0].length;
    if (/^[.,]{2,}\d/.test(text.slice(end))) continue;
    const parsed = parseNumber(match[0]);
    if (parsed) out.push({ ...parsed, span: [match.index, end] });
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
