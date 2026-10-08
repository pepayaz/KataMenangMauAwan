export type FinancialPeriod = { year: number; q: number; kind: 'quarter' | 'semester'; reportDate: string };
const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, satu: 1, pertama: 1, dua: 2, kedua: 2 };
export function parseFinancialPeriod(raw: string): FinancialPeriod | null {
  const text = raw.trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
  const quarter = /^(?:q|kuartal|triwulan|quarter) ?(i{1,3}|iv|[1-4])(?: ?[-/,] ?| )(\d{4})$/.exec(text)
    ?? /^([1-4]) ?q ?(\d{2}|\d{4})$/.exec(text);
  const semester = /^(?:semester|sem) ?(i|ii|1|2|satu|dua|pertama|kedua)(?: ?[-/,] ?| )(\d{4})$/.exec(text)
    ?? /^h([12]) ?(\d{4})$/.exec(text);
  const match = quarter ?? semester;
  if (!match) return null;
  const n = roman[match[1]!] ?? Number(match[1]);
  const q = quarter ? n : n * 2;
  const year = match[2]!.length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  if (q < 1 || q > 4) return null;
  return { year, q, kind: quarter ? 'quarter' : 'semester', reportDate: `${year}-${['03-31', '06-30', '09-30', '12-31'][q - 1]}` };
}
/** Explicit report labels only; never turn a prediction date into a reporting period. */
export function lastFinancialPeriod(text: string): string | undefined {
  const matches = [...text.matchAll(/(?:\b(?:semester|sem)\s+(?:ii|i|[12]|satu|dua|pertama|kedua)|\bh[12]|\b(?:kuartal|triwulan|quarter|q)\s*(?:iv|iii|ii|i|[1-4]))\s*(?:[-/,]\s*)?\d{4}\b/gi)];
  return matches.at(-1)?.[0];
}
/** These metrics cannot be substituted with total earnings or total revenue. */
export function unsupportedFinancialMetric(metric: string): boolean {
  return /\b(?:nim|net interest margin|margin|provisi|provision|pencadangan|cadangan kredit|portofolio|nasabah|casa|npl|car|roa|roe|eps|ebitda|ebit|laba operasional|operating profit|pendapatan bunga|interest income|net interest income|laba kotor|gross profit|laba sebelum pajak)\b/i.test(metric);
}
