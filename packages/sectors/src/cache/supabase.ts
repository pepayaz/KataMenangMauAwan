import type { SupabaseClient } from '@supabase/supabase-js';
import type { CacheEntry, CacheStore } from './types.js';

/**
 * Cache Postgres di tabel `api_cache` (bab 6.5).
 *
 * Dibungkus lapisan memori di `LayeredCacheStore` supaya satu cek yang memakai
 * endpoint sama dua kali tidak memukul Postgres dua kali.
 */
export class SupabaseCacheStore implements CacheStore {
  constructor(private readonly db: SupabaseClient) {}

  async get(key: string): Promise<CacheEntry | null> {
    const { data, error } = await this.db
      .from('api_cache')
      .select('key, endpoint, params, response, fetched_at, ttl_seconds')
      .eq('key', key)
      .maybeSingle();

    if (error || !data) return null;
    return {
      key: data.key as string,
      endpoint: data.endpoint as string,
      params: (data.params ?? {}) as Record<string, unknown>,
      response: data.response,
      fetchedAt: data.fetched_at as string,
      ttlSeconds: data.ttl_seconds as number,
    };
  }

  async set(entry: CacheEntry): Promise<void> {
    const { error } = await this.db.from('api_cache').upsert(
      {
        key: entry.key,
        endpoint: entry.endpoint,
        params: entry.params,
        response: entry.response,
        fetched_at: entry.fetchedAt,
        ttl_seconds: entry.ttlSeconds,
      },
      { onConflict: 'key' },
    );
    // Cache yang gagal ditulis bukan alasan menggagalkan cek; datanya sudah di tangan.
    if (error) console.warn('[sectors] gagal menulis api_cache:', error.message);
  }

  async count(): Promise<number> {
    const { count } = await this.db.from('api_cache').select('key', { count: 'exact', head: true });
    return count ?? 0;
  }
}

/** Cache berlapis: memori dulu, lalu penyimpanan tetap. */
export class LayeredCacheStore implements CacheStore {
  constructor(private readonly layers: CacheStore[]) {}

  async get(key: string): Promise<CacheEntry | null> {
    for (let i = 0; i < this.layers.length; i += 1) {
      const layer = this.layers[i];
      if (!layer) continue;
      const hit = await layer.get(key);
      if (hit) {
        // Naikkan ke lapisan yang lebih cepat.
        for (let j = 0; j < i; j += 1) await this.layers[j]?.set(hit);
        return hit;
      }
    }
    return null;
  }

  async set(entry: CacheEntry): Promise<void> {
    await Promise.all(this.layers.map((l) => l.set(entry)));
  }

  async count(): Promise<number> {
    const last = this.layers[this.layers.length - 1];
    return (await last?.count?.()) ?? 0;
  }
}
