import {
  claimHash,
  extractNumbers,
  type Asserted,
  type Claim,
  type ClaimType,
  type Entity,
} from '@cek-dulu/shared';

/**
 * Ekstraktor klaim berbasis aturan.
 *
 * **Ini pengganti sementara milik B, bukan ekstraktor final.** Bab 3.2 dan
 * bab 8.1 A nomor 2 menaruh ekstraktor dengan structured output LLM di tangan A.
 * Yang dibutuhkan B agar route `/api/check` bisa jalan end-to-end sejak Jumat
 * adalah sesuatu yang deterministik dan tidak butuh kunci LLM. Fungsi di sini
 * memenuhi kontrak `Claim` yang sama, jadi menukarnya dengan ekstraktor A nanti
 * tidak menyentuh route, persistensi, maupun verifier.
 */

type Pattern = {
  type: ClaimType;
  re: RegExp;
  metric: string;
  /** Satuan bawaan bila angka di teks tidak membawa satuan. */
  unit?: Asserted['unit'];
};

/** Pola prediksi dan opini — ditandai di luar cakupan (bab 1.4). */
const OUT_OF_SCOPE =
  /\b(bakal|akan|pasti|prediksi|target harga|tp\s*\d|cuan|to the moon|auto\s*kaya|gas\b|hold\b|buy\b|sell\b)/i;

const PATTERNS: Pattern[] = [
  {
    type: 'valuation',
    re: /\b(per|pe|p\/e|pbv?|p\/b|psr?|peg)\b[^.!?\n]{0,30}?(\d[\d.,]*)\s*(x|kali)?/i,
    metric: 'PER',
    unit: 'x',
  },
  {
    type: 'dividend',
    re: /\b(dividen|deviden|yield|dividend)\b[^.!?\n]{0,40}?(\d[\d.,]*)\s*%/i,
    metric: 'yield dividen',
    unit: '%',
  },
  {
    type: 'price_move',
    re: /\b(naik|turun|terbang|anjlok|roket|melesat|ara|arb)\b[^.!?\n]{0,30}?(\d[\d.,]*)\s*%/i,
    metric: 'perubahan harga',
    unit: '%',
  },
  {
    type: 'earnings_growth',
    re: /\b(laba|profit|pendapatan|revenue|omzet|omset)\b[^.!?\n]{0,40}?(\d[\d.,]*)\s*%/i,
    metric: 'pertumbuhan laba',
    unit: '%',
  },
  {
    type: 'foreign_flow',
    re: /\b(asing|foreign|net\s*buy|net\s*sell)\b[^.!?\n]{0,40}/i,
    metric: 'arus asing',
  },
  {
    type: 'accumulation',
    re: /\b(institusi|bandar|akumulasi|dikoleksi|dikumpulin|big fund)\b[^.!?\n]{0,40}/i,
    metric: 'akumulasi institusi',
  },
  {
    type: 'safety',
    re: /\b(aman|fundamental (kuat|bagus)|perusahaan (gede|besar)|blue chip|bluechip)\b[^.!?\n]{0,40}/i,
    metric: 'keamanan',
  },
];

/** Sebutan jendela waktu yang lazim menempel pada klaim harga dan arus. */
const WINDOW_RE =
  /\b(sehari|hari ini|seminggu|sepekan|sebulan|setahun|ytd|\d+\s*(hari|minggu|bulan|tahun))\b/i;

export type ExtractOptions = {
  checkId: string;
  entities: Entity[];
  /** Tipe klaim yang aktif menurut feature flag. */
  enabledTypes: ClaimType[];
};

export function extractClaims(text: string, opts: ExtractOptions): Claim[] {
  const primary = opts.entities[0];
  if (!primary) return [];

  const claims: Claim[] = [];
  const sentences = splitSentences(text);
  let seq = 0;

  for (const sentence of sentences) {
    const ticker = tickerForSentence(sentence.text, opts.entities) ?? primary.ticker;
    const inScope = !OUT_OF_SCOPE.test(sentence.text);

    for (const pattern of PATTERNS) {
      if (!opts.enabledTypes.includes(pattern.type)) continue;
      const m = pattern.re.exec(sentence.text);
      if (!m) continue;

      const numbers = extractNumbers(m[0]);
      const picked = numbers.find((n) => n.unit === pattern.unit) ?? numbers[0];
      // Tipe yang wajib berangka dilewati bila tidak ada angka sama sekali.
      const needsNumber = pattern.unit !== undefined;
      if (needsNumber && !picked) continue;

      const windowMatch = WINDOW_RE.exec(sentence.text);
      const yearMatch = /\b(20\d{2})\b/.exec(sentence.text);

      seq += 1;
      const asserted: Asserted = { metric: metricFor(pattern, sentence.text) };
      if (picked) asserted.value = picked.value;
      if (pattern.unit) asserted.unit = pattern.unit;
      else if (picked?.unit) asserted.unit = picked.unit;
      if (windowMatch) asserted.window = windowMatch[0];
      if (yearMatch) asserted.period = yearMatch[1];

      const claim: Claim = {
        claimId: `${opts.checkId}-c${seq}`,
        checkId: opts.checkId,
        span: [sentence.start + m.index, sentence.start + m.index + m[0].length],
        type: pattern.type,
        ticker,
        asserted,
        inScope,
      };
      claims.push(claim);
      // Satu kalimat menghasilkan paling banyak satu klaim; pola pertama menang.
      break;
    }
  }

  return claims;
}

/** Ticker yang dipakai untuk menghitung claim_hash sebelum disimpan. */
export function hashForClaim(claim: Claim): string {
  return claimHash(claim);
}

function metricFor(pattern: Pattern, sentence: string): string {
  if (pattern.type !== 'valuation') return pattern.metric;
  const m = /\b(per|pe|p\/e|pbv?|p\/b|psr?|peg)\b/i.exec(sentence);
  return m ? m[1]!.toUpperCase() : pattern.metric;
}

type Sentence = { text: string; start: number };

function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const re = /[^.!?\n]+[.!?\n]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const chunk = m[0];
    if (chunk.trim() === '') continue;
    out.push({ text: chunk, start: m.index });
  }
  return out.length > 0 ? out : [{ text, start: 0 }];
}

/** Bila satu kalimat menyebut emiten tertentu, klaimnya milik emiten itu. */
function tickerForSentence(sentence: string, entities: Entity[]): string | null {
  const lower = sentence.toLowerCase();
  for (const e of entities) {
    if (lower.includes(e.surface.toLowerCase()) || lower.includes(e.ticker.toLowerCase())) {
      return e.ticker;
    }
  }
  return null;
}
