import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { CacheEntry, CacheStore } from './types.js';

/**
 * Cache berbasis berkas.
 *
 * Gunanya: uji unit verifier dan `run-eval` mode cache_only jalan tanpa Postgres
 * dan tanpa jaringan (bab 8.1 B, definisi selesai). Berkas hasil `npm run
 * pull:demo` di-commit supaya seluruh tim bisa bekerja dari data yang sama.
 */
export class FileCacheStore implements CacheStore {
  constructor(private readonly dir: string) {}

  private pathFor(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 40);
    return join(this.dir, `${hash}.json`);
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const raw = await readFile(this.pathFor(key), 'utf8');
      return JSON.parse(raw) as CacheEntry;
    } catch {
      return null;
    }
  }

  async set(entry: CacheEntry): Promise<void> {
    const path = this.pathFor(entry.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(entry, null, 2), 'utf8');
  }
}
