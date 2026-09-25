import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FileCacheStore } from './cache/file.js';
import { MemoryCacheStore } from './cache/memory.js';
import { LayeredCacheStore, SupabaseCacheStore } from './cache/supabase.js';
import type { CacheStore } from './cache/types.js';
import { MemoryLedgerStore } from './ledger/memory.js';
import { SupabaseLedgerStore } from './ledger/supabase.js';
import type { LedgerStore } from './ledger/types.js';
import { SectorsClient, type SectorsClientDeps } from './client.js';
import type { SectorsConfig } from './config.js';

/**
 * Perakitan klien untuk server dan skrip.
 *
 * Supabase dipakai bila kunci service role tersedia; kalau tidak, jatuh ke cache
 * berkas supaya seluruh tim tetap bisa menjalankan pipeline di mode cache_only
 * tanpa akses basis data (bab 10: C dan D bekerja sebelum Supabase siap).
 */

let cachedDb: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  if (cachedDb) return cachedDb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedDb = createClient(url, key, { auth: { persistSession: false } });
  return cachedDb;
}

export type ClientBundle = {
  client: SectorsClient;
  cache: CacheStore;
  ledger: LedgerStore;
  db: SupabaseClient | null;
};

export function createSectorsClient(
  opts: { config?: Partial<SectorsConfig>; fileCacheDir?: string } = {},
): ClientBundle {
  const db = getServiceClient();
  const fileDir = opts.fileCacheDir ?? process.env.SECTORS_CACHE_DIR ?? './.cache/sectors';

  const cache: CacheStore = db
    ? new LayeredCacheStore([new MemoryCacheStore(), new SupabaseCacheStore(db)])
    : new LayeredCacheStore([new MemoryCacheStore(), new FileCacheStore(fileDir)]);

  const ledger: LedgerStore = db ? new SupabaseLedgerStore(db) : new MemoryLedgerStore();

  const deps: SectorsClientDeps = { cache, ledger };
  if (opts.config) deps.config = opts.config;

  return { client: new SectorsClient(deps), cache, ledger, db };
}
