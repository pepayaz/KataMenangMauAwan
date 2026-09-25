import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetPost } from '../config.js';
import type { LedgerEntry, LedgerStore, MemberSpend } from './types.js';

/** Buku kredit di tabel `credit_ledger` (bab 6.5). */
export class SupabaseLedgerStore implements LedgerStore {
  constructor(private readonly db: SupabaseClient) {}

  async record(entry: LedgerEntry): Promise<void> {
    const { error } = await this.db.from('credit_ledger').insert({
      endpoint: entry.endpoint,
      params: entry.params,
      credits: entry.credits,
      cached: entry.cached,
      check_id: entry.checkId,
      member: entry.member,
      ts: entry.ts,
    });
    if (error) console.warn('[sectors] gagal menulis credit_ledger:', error.message);
  }

  async spendByMember(): Promise<MemberSpend> {
    const { data, error } = await this.db.from('credit_spend_by_member').select('member, credits');
    if (error || !data) return {};
    const out: MemberSpend = {};
    for (const row of data as Array<{ member: string; credits: number }>) {
      out[row.member] = Number(row.credits);
    }
    return out;
  }

  async spendSince(iso: string): Promise<MemberSpend> {
    const { data, error } = await this.db
      .from('credit_ledger')
      .select('member, credits')
      .gte('ts', iso);
    if (error || !data) return {};
    const out: MemberSpend = {};
    for (const row of data as Array<{ member: string; credits: number }>) {
      out[row.member] = (out[row.member] ?? 0) + Number(row.credits);
    }
    return out;
  }

  async recent(limit: number): Promise<LedgerEntry[]> {
    const { data, error } = await this.db
      .from('credit_ledger')
      .select('endpoint, params, credits, cached, check_id, member, ts')
      .order('ts', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((r) => ({
      endpoint: r.endpoint as string,
      params: (r.params ?? {}) as Record<string, unknown>,
      credits: Number(r.credits),
      cached: Boolean(r.cached),
      checkId: (r.check_id as string | null) ?? null,
      member: r.member as BudgetPost,
      ts: r.ts as string,
    }));
  }
}
