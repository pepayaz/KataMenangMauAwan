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
 * Menafsirkan sebutan jendela berbahasa Indonesia menjadi jumlah hari kalender.
 * Mengembalikan null bila tidak dikenali — pemanggil harus memakai bawaan tipe klaim.
 */
export function parseWindowPhrase(phrase: string | undefined): number | null {
  if (!phrase) return null;
  const p = phrase.toLowerCase().trim();

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
