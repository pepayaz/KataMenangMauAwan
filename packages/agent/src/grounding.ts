import { extractNumbers, parseNumber, type Evidence, type ParsedNumber } from '@cek-dulu/shared';

export type UnmatchedNumber = { raw: string; span: [number, number] };
export type GroundingResult = { ok: boolean; unmatched: UnmatchedNumber[] };
export type GroundingFeedback = { previousText: string; unmatched: UnmatchedNumber[]; rejectedByPolicy?: true };
export type GroundingExclusion = UnmatchedNumber & {
  kind: 'year' | 'date' | 'duration' | 'quarter';
};

const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli',
  'agustus', 'september', 'oktober', 'november', 'desember'];
const MONTH_PATTERN = MONTHS.map((month) => `${month}|${month.slice(0, 3)}`).join('|');

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && year <= 2099 && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Pengecualian format waktu yang dapat diaudit, bukan pencocokan evidence. */
export function groundingExclusions(text: string): GroundingExclusion[] {
  const out: GroundingExclusion[] = [];
  const add = (match: RegExpMatchArray, kind: GroundingExclusion['kind']) => {
    const start = match.index!;
    out.push({ kind, raw: match[0], span: [start, start + match[0].length] });
  };
  for (const match of text.matchAll(/\b(19\d{2}|20\d{2})-(\d{2})-(\d{2})\b/g)) {
    if (validDate(Number(match[1]), Number(match[2]), Number(match[3]))) add(match, 'date');
  }
  for (const match of text.matchAll(/\b(\d{1,2})([/.\-])(\d{1,2})\2(19\d{2}|20\d{2})\b/g)) {
    if (validDate(Number(match[4]), Number(match[3]), Number(match[1]))) add(match, 'date');
  }
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\.?\\s+(19\\d{2}|20\\d{2})\\b`, 'gi'))) {
    const month = MONTHS.findIndex((name) => name === match[2]!.toLowerCase()
      || name.slice(0, 3) === match[2]!.toLowerCase()) + 1;
    if (validDate(Number(match[3]), month, Number(match[1]))) add(match, 'date');
  }
  for (const match of text.matchAll(/\b(?:tahun|pada|di|sejak|hingga|sampai|periode|laporan|dividen|data|FY)\s+(?:19|20)\d{2}\b/gi)) add(match, 'year');
  for (const match of text.matchAll(/\b(?:19|20)\d{2}\s*[–-]\s*(?:19|20)\d{2}\b/g)) add(match, 'year');
  for (const match of text.matchAll(/^\s*(?:19|20)\d{2}\s*$/g)) add(match, 'year');
  for (const match of text.matchAll(/(?<![\p{L}\p{N}_.,+\-−])\d+\s+(?:tahun|bulan|minggu|hari)\b/giu)) add(match, 'duration');
  for (const match of text.matchAll(/\bQ[1-4](?:\s+(?:19|20)\d{2})?\b/gi)) add(match, 'quarter');
  return out.sort((a, b) => a.span[0] - b.span[0]);
}

type NumericEvidence = { value: number; unit: string | null };

function numericEvidence(evidence: Evidence): NumericEvidence | null {
  if (typeof evidence.value === 'number') {
    return Number.isFinite(evidence.value) ? { value: evidence.value, unit: evidence.unit ?? null } : null;
  }
  const parsed = parseNumber(evidence.value);
  if (!parsed || parsed.ambiguous) return null;
  if (parsed.unit !== null && evidence.unit !== undefined && parsed.unit !== evidence.unit) return null;
  return { value: parsed.normalized, unit: parsed.unit ?? evidence.unit ?? null };
}

/** Persis sesuai digit yang ditulis; tidak memakai toleransi relatif verifier. */
function matchesNumber(number: ParsedNumber, evidence: NumericEvidence): boolean {
  if (number.ambiguous) return false;
  if (number.unit !== null && evidence.unit !== null && number.unit !== evidence.unit) return false;
  // Memakai parser bersama juga untuk skala nol: nilai / mantissa akan membagi nol.
  const token = /[+\-−]?\d+(?:[.,]\d+)*/.exec(number.raw);
  let scale = 1;
  let digits = number.raw.toLowerCase().includes('setengah') ? 1 : 0;
  if (token) {
    const body = token[0].replace(/^[+\-−]/, '');
    const parts = body.split(/[.,]/);
    if (parts.length === 2 || (body.includes(',') && body.includes('.'))) digits = parts.at(-1)!.length;
    const scaleNumber = parseNumber(number.raw.replace(token[0], '1'));
    if (!scaleNumber || scaleNumber.ambiguous) return false;
    scale = scaleNumber.normalized;
  } else if (number.value !== 0) scale = number.normalized / number.value;
  if (digits > 20 || scale === 0) return false;
  if (number.value !== 0 && Math.sign(number.value) !== Math.sign(evidence.value)) return false;
  const displayValue = evidence.value / scale;
  if (!Number.isFinite(displayValue)) return false;
  // Intl halfExpand membulatkan positif dan negatif dengan arah simetris.
  const rounded = Number(new Intl.NumberFormat('en-US', {
    useGrouping: false, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(displayValue));
  return rounded === number.value;
}

/** Tidak ada angka di luar evidence yang lolos, termasuk token ambigu/invalid. */
export function validateGrounding(text: string, evidence: readonly Evidence[]): GroundingResult {
  const numbers = extractNumbers(text);
  const exclusions = groundingExclusions(text);
  const values = evidence.map(numericEvidence).filter((value): value is NumericEvidence => value !== null);
  const contained = (span: [number, number], outer: [number, number]) => span[0] >= outer[0] && span[1] <= outer[1];
  const unmatched: UnmatchedNumber[] = [];
  for (const number of numbers) {
    if (exclusions.some((excluded) => contained(number.span, excluded.span))) continue;
    if (!values.some((value) => matchesNumber(number, value))) unmatched.push({ raw: number.raw, span: number.span });
  }
  // extractNumbers sengaja melewati format invalid dan digit di token seperti Q5.
  // Audit sisa digit agar itu tidak menjadi pintu lolos diam-diam.
  for (const match of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const span: [number, number] = [match.index, match.index + match[0].length];
    if (numbers.some((number) => contained(span, number.span))
      || exclusions.some((excluded) => contained(span, excluded.span))) continue;
    unmatched.push({ raw: match[0], span });
  }
  unmatched.sort((a, b) => a.span[0] - b.span[0]);
  return { ok: unmatched.length === 0, unmatched };
}

export class GroundingError extends Error {
  constructor(readonly result: GroundingResult) {
    super('Templat deterministik memuat angka yang tidak didukung evidence.');
    this.name = 'GroundingError';
  }
}

/** Dua penulisan maksimum; template juga wajib lolos sebelum dikembalikan. */
export async function withGrounding(
  writeFn: (feedback?: GroundingFeedback) => string | Promise<string>,
  evidence: readonly Evidence[],
  templateFn: (evidence: readonly Evidence[]) => string,
  validateText: (text: string) => boolean = () => true,
): Promise<string> {
  let feedback: GroundingFeedback | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await writeFn(feedback);
    const result = validateGrounding(text, evidence);
    const policyOk = validateText(text);
    if (result.ok && policyOk) return text;
    feedback = { previousText: text, unmatched: result.unmatched, ...(!policyOk ? { rejectedByPolicy: true as const } : {}) };
  }
  const template = templateFn(evidence);
  const result = validateGrounding(template, evidence);
  if (!result.ok) throw new GroundingError(result);
  if (!validateText(template)) throw new Error('Templat deterministik melanggar kebijakan output.');
  return template;
}
