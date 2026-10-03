import type { LedgerEntry, LedgerStore, MemberSpend } from './types.js';

export class MemoryLedgerStore implements LedgerStore {
  private readonly rows: LedgerEntry[] = [];

  async record(entry: LedgerEntry): Promise<void> {
    this.rows.push(entry);
  }

  async spendByMember(): Promise<MemberSpend> {
    return tally(this.rows);
  }

  async spendSince(iso: string): Promise<MemberSpend> {
    return tally(this.rows.filter((r) => r.ts >= iso));
  }

  async recent(limit: number): Promise<LedgerEntry[]> {
    return this.rows.slice(-limit).reverse();
  }

  all(): LedgerEntry[] {
    return [...this.rows];
  }
}

function tally(rows: LedgerEntry[]): MemberSpend {
  const out: MemberSpend = {};
  for (const r of rows) out[r.member] = (out[r.member] ?? 0) + r.credits;
  return out;
}
