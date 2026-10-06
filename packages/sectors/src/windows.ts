/**
 * Pemecahan jendela waktu (bab 4, catatan akhir).
 *
 * Arus asing dan harga harian maksimal 90 hari per panggilan; broker summary
 * maksimal 14 hari. Router harus tahu berapa panggilan yang dibutuhkan sebelum
 * memulai supaya kreditnya bisa dihitung di muka.
 */

export type DateWindow = { start: string; end: string };

const MS_PER_DAY = 86_400_000;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(s: string): Date {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Tanggal tidak valid: ${s}`);
  return d;
}

export function addDays(s: string, days: number): string {
  return toISODate(new Date(parseISODate(s).getTime() + days * MS_PER_DAY));
}

/** Jumlah hari kalender inklusif antara dua tanggal. */
export function windowLengthDays(w: DateWindow): number {
  return Math.round((parseISODate(w.end).getTime() - parseISODate(w.start).getTime()) / MS_PER_DAY) + 1;
}

/**
 * Memecah satu jendela menjadi beberapa jendela yang masing-masing tidak
 * melewati `maxDays`. Urutan hasil dari yang paling lama ke yang paling baru.
 */
export function splitWindow(w: DateWindow, maxDays: number): DateWindow[] {
  if (maxDays <= 0) throw new Error('maxDays harus positif');
  const total = windowLengthDays(w);
  if (total <= 0) return [];
  if (total <= maxDays) return [w];

  const out: DateWindow[] = [];
  let cursor = w.start;
  while (parseISODate(cursor).getTime() <= parseISODate(w.end).getTime()) {
    const chunkEnd = addDays(cursor, maxDays - 1);
    const end = parseISODate(chunkEnd).getTime() > parseISODate(w.end).getTime() ? w.end : chunkEnd;
    out.push({ start: cursor, end });
    cursor = addDays(end, 1);
  }
  return out;
}

/** Jendela relatif yang lazim disebut di klaim: "sebulan", "5 hari", "setahun". */
export function windowEndingToday(days: number, today = toISODate(new Date())): DateWindow {
  return { start: addDays(today, -(days - 1)), end: today };
}

/**
 * Jendela panjang tidak diambil utuh (5 tahun = 21 panggilan). Untuk perubahan
 * harga cukup harga di awal dan akhir jendela, jadi diambil dua cuplikan pendek.
 * Null bila jendela muat dalam satu panggilan.
 */
export const PRICE_PROBE_DAYS = 21;
export function sampledWindows(w: DateWindow, maxDays = 90, probeDays = PRICE_PROBE_DAYS): [DateWindow, DateWindow] | null {
  if (windowLengthDays(w) <= maxDays) return null;
  return [{ start: w.start, end: addDays(w.start, probeDays - 1) }, { start: addDays(w.end, -(probeDays - 1)), end: w.end }];
}

const ENGLISH_UNITS: Record<string, string> = { day: 'hari', week: 'minggu', month: 'bulan', year: 'tahun' };

/**
 * Konten media sosial sering memakai frasa Inggris ("past 5 years", "1Y").
 * Diubah ke bentuk Indonesia yang dikenali; frasa lain dikembalikan apa adanya.
 */
export function normalizeWindowPhrase(phrase: string): string {
  const p = phrase.toLowerCase().trim().replace(/\s+/g, ' ');
  if (/^(?:the )?(?:past|last) (?:day|week|month|year)$/.test(p)) {
    return { day: 'sehari', week: 'seminggu', month: 'sebulan', year: 'setahun' }[p.split(' ').at(-1)!]!;
  }
  const words = /^(?:(?:the )?(?:past|last) )?([1-9]\d*) (day|week|month|year)s?(?: ago)?$/.exec(p);
  if (words) return `${words[1]} ${ENGLISH_UNITS[words[2]!]} terakhir`;
  const short = /^([1-9]\d*) ?(d|w|m|y)$/.exec(p);
  if (short) return `${short[1]} ${{ d: 'hari', w: 'minggu', m: 'bulan', y: 'tahun' }[short[2] as 'd' | 'w' | 'm' | 'y']} terakhir`;
  return p;
}

/**
 * Menafsirkan sebutan jendela menjadi jumlah hari kalender.
 * Mengembalikan null bila tidak dikenali — pemanggil harus memakai bawaan tipe klaim.
 */
export function parseWindowPhrase(phrase: string | undefined): number | null {
  if (!phrase) return null;
  const p = normalizeWindowPhrase(phrase);

  const table: Array<[RegExp, number]> = [
    [/\b(sehari|1\s*hari|hari ini)\b/, 1],
    [/\b(seminggu|1\s*minggu|sepekan)\b/, 7],
    [/\b(sebulan|1\s*bulan)\b/, 30],
    [/\b(sekuartal|3\s*bulan|triwulan)\b/, 90],
    [/\b(setahun|1\s*tahun|ytd)\b/, 365],
    [/\b5\s*tahun\b/, 365 * 5],
  ];
  for (const [re, days] of table) if (re.test(p)) return days;

  const m = /(\d+)\s*(hari|minggu|bulan|tahun)/.exec(p);
  if (m) {
    const n = Number(m[1]);
    switch (m[2]) {
      case 'hari':
        return n;
      case 'minggu':
        return n * 7;
      case 'bulan':
        return n * 30;
      case 'tahun':
        return n * 365;
    }
  }
  return null;
}
