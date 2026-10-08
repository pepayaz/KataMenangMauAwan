export type FinancialPeriod = { year: number; q: number; kind: 'quarter' | 'semester' | 'year' | 'ytd'; reportDate: string };
const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, satu: 1, pertama: 1, dua: 2, kedua: 2, tiga: 3, ketiga: 3, empat: 4, keempat: 4 };
export function parseFinancialPeriod(raw: string): FinancialPeriod | null {
  const text = raw.trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
  const annual = /^(?:tahun (?:buku )?|fy ?)?(\d{4})$/.exec(text);
  if (annual) return { year: Number(annual[1]), q: 4, kind: 'year', reportDate: `${annual[1]}-12-31` };
  const ytd = /^(?:hingga|sampai|kumulatif|ytd|year to date)\s+(?:(?:kuartal|triwulan|q)\s*)?(i{1,3}|iv|[1-4]|satu|dua|tiga|empat|pertama|kedua|ketiga|keempat)\s+(\d{4})$/.exec(text)
    ?? /^(3|6|9|12)\s*(?:m|bulan)\s+(\d{4})$/.exec(text);
  const quarter = /^(?:q|kuartal|triwulan|quarter) ?(i{1,3}|iv|[1-4]|satu|dua|tiga|empat|pertama|kedua|ketiga|keempat)(?: ?[-/,] ?| )(\d{4})$/.exec(text)
    ?? /^([1-4]) ?q ?(\d{2}|\d{4})$/.exec(text);
  const semester = /^(?:semester|sem) ?(i|ii|1|2|satu|dua|pertama|kedua)(?: ?[-/,] ?| )(\d{4})$/.exec(text)
    ?? /^h([12]) ?(\d{4})$/.exec(text);
  const match = ytd ?? quarter ?? semester;
  if (!match) return null;
  const n = roman[match[1]!] ?? Number(match[1]);
  const q = ytd ? (/^(3|6|9|12)\s*(?:m|bulan)/.test(text) ? n / 3 : n) : quarter ? n : n * 2;
  const year = match[2]!.length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  if (q < 1 || q > 4) return null;
  return { year, q, kind: ytd ? 'ytd' : quarter ? 'quarter' : 'semester', reportDate: `${year}-${['03-31', '06-30', '09-30', '12-31'][q - 1]}` };
}
export function financialQuarterEnds(period: FinancialPeriod): string[] {
  const ends = ['03-31', '06-30', '09-30', '12-31'];
  return period.kind === 'quarter' ? [ends[period.q - 1]!] : period.kind === 'semester' && period.q === 4 ? ends.slice(2) : ends.slice(0, period.q);
}
/** Explicit report labels only; never turn a prediction date into a reporting period. */
export function lastFinancialPeriod(text: string): string | undefined {
  const matches = [...text.matchAll(/(?:\b(?:hingga|sampai|kumulatif|ytd)\s+)?(?:\b(?:semester|sem)\s+(?:ii|i|[12]|satu|dua|pertama|kedua)|\bh[12]|\b(?:kuartal|triwulan|quarter|q)\s*(?:iv|iii|ii|i|[1-4]|satu|dua|tiga|empat|pertama|kedua|ketiga|keempat)|\b(?:3|6|9|12)\s*(?:m|bulan))\s*(?:[-/,]\s*)?\d{4}\b/gi)];
  return matches.at(-1)?.[0];
}
/** These metrics cannot be substituted with total earnings or total revenue. */
export function unsupportedFinancialMetric(metric: string): boolean {
  return /\b(?:nim|net interest margin|margin|provisi|provision|pencadangan|cadangan kredit|portofolio|nasabah|casa|npl|car|roa|roe|eps|ebitda|ebit|laba operasional|operating profit|pendapatan bunga|interest income|net interest income|laba kotor|gross profit|laba sebelum pajak)\b/i.test(metric);
}
