export type CacheEntry = {
  key: string;
  endpoint: string;
  params: Record<string, unknown>;
  response: unknown;
  fetchedAt: string;
  ttlSeconds: number;
};

export interface CacheStore {
  get(key: string): Promise<CacheEntry | null>;
  set(entry: CacheEntry): Promise<void>;
  /** Untuk dasbor dan skrip pemanasan cache. */
  count?(): Promise<number>;
}

export function isFresh(entry: CacheEntry, now = Date.now()): boolean {
  const age = (now - new Date(entry.fetchedAt).getTime()) / 1000;
  return age < entry.ttlSeconds;
}

/**
 * Kunci cache stabil: endpoint + parameter yang diurutkan. Parameter yang
 * undefined dibuang supaya `{a:1}` dan `{a:1,b:undefined}` memakai kunci sama.
 */
export function cacheKey(endpoint: string, params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort().join(',') : String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const qs = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return qs === '' ? endpoint : `${endpoint}?${qs}`;
}
