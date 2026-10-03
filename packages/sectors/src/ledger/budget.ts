import { MEMBER_BUDGETS, type BudgetPost } from '../config.js';
import { SectorsError } from '../errors.js';
import type { LedgerStore } from './types.js';

/**
 * Penegak anggaran (bab 6.3).
 *
 * Dua batas berlaku sekaligus:
 *  - anggaran satu cek, supaya satu postingan aneh tidak menghabiskan jatah tim;
 *  - anggaran pos anggota, supaya pos A tidak memakan jatah pos D.
 *
 * Kredit dipesan sebelum panggilan (`reserve`) memakai estimasi, lalu
 * disesuaikan setelah respons datang (`settle`) dengan biaya sebenarnya.
 * Pemesanan di muka penting karena tanpa itu satu panggilan laporan 8 section
 * bisa melewati batas sebelum sempat ketahuan.
 */
export class CreditBudget {
  private perCheck = new Map<string, number>();
  private memberSpend: Record<string, number> = {};
  private loaded = false;

  constructor(
    private readonly store: LedgerStore,
    private readonly budgetPerCheck: number,
    private readonly memberBudgets: Record<string, number> = MEMBER_BUDGETS,
  ) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.memberSpend = await this.store.spendByMember();
    this.loaded = true;
  }

  async remainingForMember(member: BudgetPost): Promise<number> {
    await this.ensureLoaded();
    const budget = this.memberBudgets[member] ?? 0;
    return budget - (this.memberSpend[member] ?? 0);
  }

  usedByCheck(checkId: string | null): number {
    if (checkId === null) return 0;
    return this.perCheck.get(checkId) ?? 0;
  }

  remainingForCheck(checkId: string | null): number {
    return this.budgetPerCheck - this.usedByCheck(checkId);
  }

  /**
   * Menolak panggilan yang akan melewati anggaran. Dilempar sebelum jaringan
   * disentuh, jadi kredit tidak pernah terbakar karena kelebihan batas.
   */
  async reserve(opts: {
    credits: number;
    checkId: string | null;
    member: BudgetPost;
    endpoint: string;
  }): Promise<void> {
    const { credits, checkId, member, endpoint } = opts;
    if (credits <= 0) return;

    if (checkId !== null) {
      const used = this.usedByCheck(checkId);
      if (used + credits > this.budgetPerCheck) {
        throw new SectorsError(
          'BUDGET_EXCEEDED',
          `Anggaran cek habis: ${used}/${this.budgetPerCheck} kredit terpakai, ${endpoint} butuh ${credits}.`,
          { endpoint, terminal: true },
        );
      }
    }

    const remaining = await this.remainingForMember(member);
    if (credits > remaining) {
      throw new SectorsError(
        'BUDGET_EXCEEDED',
        `Anggaran pos ${member} habis: sisa ${remaining} kredit, ${endpoint} butuh ${credits}.`,
        { endpoint, terminal: true },
      );
    }

    if (checkId !== null) this.perCheck.set(checkId, this.usedByCheck(checkId) + credits);
    this.memberSpend[member] = (this.memberSpend[member] ?? 0) + credits;
  }

  /** Mengembalikan selisih bila biaya sebenarnya lebih kecil dari estimasi. */
  settle(opts: {
    reserved: number;
    actual: number;
    checkId: string | null;
    member: BudgetPost;
  }): void {
    const delta = opts.actual - opts.reserved;
    if (delta === 0) return;
    if (opts.checkId !== null) {
      this.perCheck.set(opts.checkId, Math.max(0, this.usedByCheck(opts.checkId) + delta));
    }
    this.memberSpend[opts.member] = Math.max(0, (this.memberSpend[opts.member] ?? 0) + delta);
  }

  /** Untuk dasbor /admin/credits. */
  async snapshot(): Promise<Array<{ member: string; budget: number; used: number; left: number }>> {
    await this.ensureLoaded();
    return Object.entries(this.memberBudgets).map(([member, budget]) => {
      const used = this.memberSpend[member] ?? 0;
      return { member, budget, used, left: budget - used };
    });
  }
}
