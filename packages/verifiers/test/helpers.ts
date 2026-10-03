import {
  MemoryCacheStore,
  MemoryLedgerStore,
  SectorsClient,
  cacheKey,
  type EndpointName,
} from '@cek-dulu/sectors';
import type { Claim, ClaimType } from '@cek-dulu/shared';
import type { VerifierContext } from '../src/types.js';

export const TODAY = '2026-09-24';

export type Seed = {
  endpoint: EndpointName;
  params: Record<string, unknown>;
  response: unknown;
};

/**
 * Klien yang seluruh datanya berasal dari cache.
 *
 * Mode `cache_only` dipakai sengaja: bila satu verifier meminta endpoint yang
 * lupa disiapkan, uji gagal dengan CACHE_MISS alih-alih diam-diam memanggil API.
 * Inilah yang membuat "seluruh set uji jalan tanpa satu pun panggilan ke API"
 * (bab 8.1 B) bisa dibuktikan, bukan sekadar diklaim.
 */
export function seededClient(seeds: Seed[]): SectorsClient {
  const cache = new MemoryCacheStore();
  for (const seed of seeds) {
    cache.seed({
      key: cacheKey(seed.endpoint, seed.params),
      endpoint: seed.endpoint,
      params: seed.params,
      response: seed.response,
      fetchedAt: new Date().toISOString(),
      ttlSeconds: 86_400,
    });
  }
  return new SectorsClient({
    cache,
    ledger: new MemoryLedgerStore(),
    config: { mode: 'cache_only', member: 'B', apiKey: '' },
  });
}

export function ctx(client: SectorsClient, today = TODAY): VerifierContext {
  return { client, checkId: 'cek-uji', today };
}

export function makeClaim(
  type: ClaimType,
  ticker: string,
  asserted: Claim['asserted'],
  overrides: Partial<Claim> = {},
): Claim {
  return {
    claimId: 'cek-uji-c1',
    checkId: 'cek-uji',
    span: [0, 10],
    type,
    ticker,
    asserted,
    inScope: true,
    ...overrides,
  };
}

/** Deret harga harian sintetis dengan perubahan yang bisa diatur. */
export function dailySeries(opts: {
  symbol: string;
  start: string;
  days: number;
  from: number;
  to: number;
  volume?: number;
}): Array<{ symbol: string; date: string; close: number; volume: number }> {
  const out = [];
  const step = (opts.to - opts.from) / Math.max(1, opts.days - 1);
  const startMs = new Date(`${opts.start}T00:00:00.000Z`).getTime();
  for (let i = 0; i < opts.days; i += 1) {
    out.push({
      symbol: `${opts.symbol}.JK`,
      date: new Date(startMs + i * 86_400_000).toISOString().slice(0, 10),
      close: Math.round(opts.from + step * i),
      volume: opts.volume ?? 1_000_000,
    });
  }
  return out;
}
