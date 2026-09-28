import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseLedgerStore } from '../src/ledger/supabase.js';

function fakeDb(results: Array<{ error: { code: string; message: string } | null }>) {
  const rows: Array<Record<string, unknown>> = [];
  const insert = vi.fn(async (row: Record<string, unknown>) => { rows.push(row); return results.shift() ?? { error: null }; });
  return { db: { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient, rows, insert };
}

const entry = { endpoint: 'fetchDailyPrice' as const, params: { symbol: 'ADRO' }, credits: 1, cached: false,
  checkId: '00000000-0000-4000-8000-000000000001', member: 'B' as const, ts: '2026-09-28T00:00:00.000Z' };

describe('SupabaseLedgerStore', () => {
  it('cek tanpa baris checks tetap tercatat tanpa FK', async () => {
    const { db, rows } = fakeDb([{ error: { code: '23503', message: 'fk' } }]);
    await new SupabaseLedgerStore(db).record(entry);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ check_id: null, credits: 1,
      params: { symbol: 'ADRO', unlinked_check_id: entry.checkId } });
  });

  it('galat lain tidak diulang', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { db, insert } = fakeDb([{ error: { code: '42501', message: 'rls' } }]);
    await new SupabaseLedgerStore(db).record(entry);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
