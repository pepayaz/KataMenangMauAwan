import type { SupabaseClient } from '@supabase/supabase-js';
import { MEMBER_BUDGETS, TOTAL_BUDGET } from '@cek-dulu/sectors';

/**
 * Agregasi buku kredit (bab 6.3). Pemilik: B.
 *
 * Logikanya hidup di lib, bukan di route handler, karena route handler Next
 * hanya boleh mengekspor metode HTTP — dan karena fungsi murni di bawah ini
 * perlu diuji tanpa menyalakan server.
 */

export type LedgerRow = {
  endpoint: string;
  credits: number;
  cached: boolean;
  member: string;
  check_id: string | null;
  ts: string;
};

export type CreditsReport = {
  total: { budget: number; used: number; left: number };
  members: Array<{ member: string; budget: number; used: number; left: number; calls: number }>;
  today: { used: number; calls: number; cachedCalls: number };
  byEndpoint: Array<{ endpoint: string; credits: number; calls: number; cachedCalls: number }>;
  recent: Array<{
    endpoint: string;
    credits: number;
    cached: boolean;
    member: string;
    checkId: string | null;
    ts: string;
  }>;
};

export async function buildCreditsReport(db: SupabaseClient): Promise<CreditsReport> {
  const { data } = await db
    .from('credit_ledger')
    .select('endpoint, credits, cached, member, check_id, ts')
    .order('ts', { ascending: false })
    .limit(5000);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return summarizeLedger((data ?? []) as LedgerRow[], startOfToday.toISOString());
}

/** Murni: seluruh agregasi laporan kredit, supaya bisa diuji tanpa basis data. */
export function summarizeLedger(rows: LedgerRow[], sinceIso: string): CreditsReport {
  const perMember = new Map<string, { used: number; calls: number }>();
  const perEndpoint = new Map<string, { credits: number; calls: number; cachedCalls: number }>();
  let todayUsed = 0;
  let todayCalls = 0;
  let todayCached = 0;

  for (const row of rows) {
    const m = perMember.get(row.member) ?? { used: 0, calls: 0 };
    m.used += row.credits;
    m.calls += 1;
    perMember.set(row.member, m);

    const e = perEndpoint.get(row.endpoint) ?? { credits: 0, calls: 0, cachedCalls: 0 };
    e.credits += row.credits;
    e.calls += 1;
    if (row.cached) e.cachedCalls += 1;
    perEndpoint.set(row.endpoint, e);

    if (row.ts >= sinceIso) {
      todayUsed += row.credits;
      todayCalls += 1;
      if (row.cached) todayCached += 1;
    }
  }

  const members = Object.entries(MEMBER_BUDGETS).map(([member, budget]) => {
    const spend = perMember.get(member) ?? { used: 0, calls: 0 };
    return { member, budget, used: spend.used, left: budget - spend.used, calls: spend.calls };
  });

  const totalUsed = members.reduce((s, m) => s + m.used, 0);

  return {
    total: { budget: TOTAL_BUDGET, used: totalUsed, left: TOTAL_BUDGET - totalUsed },
    members,
    today: { used: todayUsed, calls: todayCalls, cachedCalls: todayCached },
    byEndpoint: [...perEndpoint.entries()]
      .map(([endpoint, v]) => ({ endpoint, ...v }))
      .sort((a, b) => b.credits - a.credits),
    recent: rows.slice(0, 50).map((r) => ({
      endpoint: r.endpoint,
      credits: r.credits,
      cached: r.cached,
      member: r.member,
      checkId: r.check_id,
      ts: r.ts,
    })),
  };
}
