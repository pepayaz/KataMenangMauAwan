import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Mode replay (bab 6.1, bab 12.3).
 *
 * Saat merekam video kita tidak mau bergantung pada jaringan atau sisa kredit,
 * tetapi juri harus melihat data yang benar-benar berasal dari panggilan live.
 * Jadi: sekali jalan di mode `live` dengan `record()` menyala, seluruh respons
 * mentah ditulis ke JSONL; setelah itu mode `replay` memutarnya ulang persis.
 */
export type RecordedCall = {
  key: string;
  endpoint: string;
  params: Record<string, unknown>;
  response: unknown;
  ts: string;
};

export class Recorder {
  private readonly map = new Map<string, RecordedCall>();
  private loaded = false;

  constructor(
    private readonly path: string,
    private readonly mode: 'record' | 'replay' | 'off',
  ) {}

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  async load(): Promise<void> {
    if (this.loaded || this.mode !== 'replay') return;
    this.loaded = true;
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch {
      return; // rekaman belum ada; setiap lookup akan REPLAY_MISS
    }
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      try {
        const call = JSON.parse(trimmed) as RecordedCall;
        // Baris terakhir menang: rekaman ulang menimpa yang lama.
        this.map.set(call.key, call);
      } catch {
        // Baris rusak dilewati; rekaman parsial tetap berguna.
      }
    }
  }

  async lookup(key: string): Promise<RecordedCall | null> {
    await this.load();
    return this.map.get(key) ?? null;
  }

  async append(call: RecordedCall): Promise<void> {
    if (this.mode !== 'record') return;
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(call)}\n`, 'utf8');
    this.map.set(call.key, call);
  }

  size(): number {
    return this.map.size;
  }

  /**
   * Mengisi rekaman tanpa berkas. Dipakai uji unit dan skrip demo yang
   * menyusun rekaman dari cache yang sudah ada.
   */
  seed(calls: RecordedCall[]): void {
    this.loaded = true;
    for (const call of calls) this.map.set(call.key, call);
  }
}
