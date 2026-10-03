import type { BudgetPost } from '../config.js';

export type LedgerEntry = {
  endpoint: string;
  params: Record<string, unknown>;
  /** Kredit yang benar-benar terpakai. Panggilan dari cache selalu 0. */
  credits: number;
  cached: boolean;
  checkId: string | null;
  member: BudgetPost;
  ts: string;
};

export type MemberSpend = Record<string, number>;

export interface LedgerStore {
  record(entry: LedgerEntry): Promise<void>;
  /** Total kredit terpakai per pos anggaran, sepanjang waktu. */
  spendByMember(): Promise<MemberSpend>;
  /** Kredit terpakai sejak waktu tertentu — dipakai laporan harian pukul 21:00. */
  spendSince(iso: string): Promise<MemberSpend>;
  recent(limit: number): Promise<LedgerEntry[]>;
}
