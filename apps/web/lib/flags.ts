import type { SupabaseClient } from '@supabase/supabase-js';

/** Tested financial coverage is enabled by default; other extended features remain opt-in.
 * Environment and database overrides still apply. */

export const DEFAULT_FLAGS: Record<string, boolean> = {
  claim_types_ext: false,
  earnings_growth: true,
  accounts: false,
  share_target: false,
};

let cache: { value: Record<string, boolean>; at: number } | null = null;
const TTL_MS = 30_000;

export async function loadFlags(db: SupabaseClient | null): Promise<Record<string, boolean>> {
  const envOverrides = flagsFromEnv();

  if (!db) return { ...DEFAULT_FLAGS, ...envOverrides };

  if (cache && Date.now() - cache.at < TTL_MS) {
    return { ...cache.value, ...envOverrides };
  }

  const { data, error } = await db.from('feature_flags').select('key, enabled');
  if (error || !data) return { ...DEFAULT_FLAGS, ...envOverrides };

  const flags = { ...DEFAULT_FLAGS };
  for (const row of data as Array<{ key: string; enabled: boolean }>) {
    flags[row.key] = row.enabled;
  }
  cache = { value: flags, at: Date.now() };
  return { ...flags, ...envOverrides };
}

/**
 * Override lewat lingkungan: `FLAG_CLAIM_TYPES_EXT=1`.
 * Dipakai skrip evaluasi (D) untuk menguji tipe 4-7 tanpa menyalakannya di produksi.
 */
function flagsFromEnv(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(DEFAULT_FLAGS)) {
    const raw = process.env[`FLAG_${key.toUpperCase()}`];
    if (raw !== undefined) out[key] = raw === '1' || raw.toLowerCase() === 'true';
  }
  return out;
}

export function resetFlagCache(): void {
  cache = null;
}
