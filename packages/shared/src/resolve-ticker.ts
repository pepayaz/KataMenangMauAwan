import type { Entity } from './schemas.js';
import { normalizeTicker } from './ticker.js';

/**
 * Resolusi ticker (bab 3.3).
 *
 * Urutannya sengaja dari yang paling pasti ke yang paling meragukan:
 *   1. pola kode saham eksplisit — $ADRO, #BBRI, atau empat huruf kapital;
 *   2. kamus alias — nama perusahaan, nama pendek, nama grup, plesetan;
 *   3. fallback LLM dengan daftar kandidat terbatas (dikerjakan A);
 *   4. keyakinan di bawah 0,7: UI meminta pengguna memilih, jangan menebak.
 *
 * Fungsi di berkas ini menangani langkah 1 dan 2 dan sepenuhnya murni, jadi
 * bisa diuji tanpa basis data maupun LLM.
 */

export type AliasEntry = { alias: string; ticker: string; weight: number };

export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Empat huruf kapital berdiri sendiri sering bukan ticker: SAYA, BANK, JUGA.
 * Karena itu pencocokan tanpa penanda `$` atau `#` hanya diterima bila kodenya
 * ada di daftar emiten resmi.
 */
const EXPLICIT_MARKED = /[$#]([A-Za-z]{4})\b/g;
const BARE_FOUR_CAPS = /\b([A-Z]{4})\b/g;

export type ResolveOptions = {
  aliases: AliasEntry[];
  /** Daftar emiten resmi. Kosongkan untuk melewati validasi kode telanjang. */
  knownTickers?: Set<string>;
};

export function resolveEntities(text: string, opts: ResolveOptions): Entity[] {
  const found = new Map<string, Entity>();

  const consider = (entity: Entity): void => {
    const existing = found.get(entity.ticker);
    if (!existing || entity.confidence > existing.confidence) found.set(entity.ticker, entity);
  };

  // 1a. Kode bertanda: $ADRO, #BBRI. Penanda itu sendiri sudah niat yang jelas.
  for (const m of text.matchAll(EXPLICIT_MARKED)) {
    const ticker = normalizeTicker(m[1] ?? '');
    if (ticker === '') continue;
    consider({ surface: m[0], ticker, confidence: 0.99, method: 'explicit' });
  }

  // 1b. Empat huruf kapital telanjang, hanya bila dikenal sebagai emiten.
  const known = opts.knownTickers;
  for (const m of text.matchAll(BARE_FOUR_CAPS)) {
    const ticker = normalizeTicker(m[1] ?? '');
    if (ticker === '') continue;
    if (known && !known.has(ticker)) continue;
    consider({
      surface: m[0],
      ticker,
      // Sedikit di bawah kode bertanda: "ASII" di tengah kalimat kapital semua
      // bisa saja kebetulan.
      confidence: known ? 0.95 : 0.75,
      method: 'explicit',
    });
  }

  // 2. Kamus alias. Alias yang lebih panjang diperiksa lebih dulu supaya
  //    "bank mandiri" menang atas "mandiri".
  const haystack = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const sorted = [...opts.aliases].sort((a, b) => b.alias.length - a.alias.length);
  const consumed: Array<[number, number]> = [];

  for (const entry of sorted) {
    const needle = ` ${entry.alias.toLowerCase()} `;
    const at = haystack.indexOf(needle);
    if (at === -1) continue;
    const span: [number, number] = [at, at + needle.length];
    // Alias yang tumpang tindih dengan alias lebih panjang yang sudah cocok dilewati.
    if (consumed.some(([s, e]) => at >= s && at < e)) continue;
    consumed.push(span);

    consider({
      surface: entry.alias,
      ticker: normalizeTicker(entry.ticker),
      // Bobot kamus menjadi keyakinan; alias ambigu diberi bobot rendah
      // supaya jatuh di bawah ambang klarifikasi.
      confidence: clamp(entry.weight * 0.9, 0, 0.95),
      method: 'alias',
    });
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Entitas yang perlu dikonfirmasi pengguna sebelum dipakai (bab 3.3 nomor 4). */
export function needsClarification(entities: Entity[]): boolean {
  const best = entities[0];
  return best === undefined || best.confidence < CONFIDENCE_THRESHOLD;
}

/** Kandidat untuk dialog klarifikasi; maksimal 10 (bab 3.3 nomor 3). */
export function clarificationCandidates(entities: Entity[], limit = 10): Entity[] {
  return entities.slice(0, limit);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
