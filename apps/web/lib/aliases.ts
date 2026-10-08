import type { SupabaseClient } from '@supabase/supabase-js';
import { MANUAL_ALIASES, IDX_COMPANIES, type AliasEntry } from '@cek-dulu/shared';

/**
 * Kamus alias runtime (bab 3.3).
 *
 * Isinya tabel `ticker_aliases`: daftar emiten resmi dari Sectors ditambah alias
 * manual. Bila basis data tidak tersedia, jatuh ke daftar emiten resmi dan alias manual yang dibundel
 * di `@cek-dulu/shared` supaya cek tetap bisa mengenali emiten populer.
 */

const bundledAliases: AliasEntry[] = [...MANUAL_ALIASES, ...IDX_COMPANIES.flatMap(company => [
  { alias: company.symbol.toLowerCase(), ticker: company.symbol, weight: 1 },
  { alias: company.company_name.replace(/\b(?:PT|Tbk|Persero)\b[.]?/gi, ' ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(), ticker: company.symbol, weight: 1 },
])];
let cache: { value: AliasEntry[]; at: number } | null = null;
const TTL_MS = 5 * 60_000;

export async function loadAliases(db: SupabaseClient | null): Promise<AliasEntry[]> {
  if (!db) return bundledAliases;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const { data, error } = await db
    .from('ticker_aliases')
    .select('alias, ticker, weight')
    .order('weight', { ascending: false });

  if (error || !data || data.length === 0) {
    console.warn('[aliases] memakai direktori emiten bawaan:', error?.message ?? 'tabel kosong');
    return bundledAliases;
  }

  const value = (data as Array<{ alias: string; ticker: string; weight: number }>).map((r) => ({
    alias: r.alias,
    ticker: r.ticker,
    weight: Number(r.weight),
  }));
  value.push(...bundledAliases.filter(alias => !value.some(row => row.alias === alias.alias && row.ticker === alias.ticker)));
  cache = { value, at: Date.now() };
  return value;
}

export function resetAliasCache(): void {
  cache = null;
}
