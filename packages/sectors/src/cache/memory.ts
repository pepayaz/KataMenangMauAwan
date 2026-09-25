import type { CacheEntry, CacheStore } from './types.js';

/** Cache dalam proses. Dipakai uji unit dan sebagai lapisan pertama di server. */
export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheEntry>();

  async get(key: string): Promise<CacheEntry | null> {
    return this.map.get(key) ?? null;
  }

  async set(entry: CacheEntry): Promise<void> {
    this.map.set(entry.key, entry);
  }

  async count(): Promise<number> {
    return this.map.size;
  }

  /** Hanya untuk uji: mengisi cache tanpa lewat jaringan. */
  seed(entry: CacheEntry): void {
    this.map.set(entry.key, entry);
  }

  entries(): CacheEntry[] {
    return [...this.map.values()];
  }
}
