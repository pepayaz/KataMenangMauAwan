export type SectorsMode = 'live' | 'cache_only' | 'replay';

export type BudgetPost = 'A' | 'B' | 'C' | 'D' | 'demo' | 'cadangan';

export type SectorsConfig = {
  apiKey: string;
  baseUrl: string;
  mode: SectorsMode;
  recordingPath: string;
  /** Anggaran kredit untuk satu cek. Bab 3.4: maksimal 8 kredit per klaim. */
  budgetPerCheck: number;
  member: BudgetPost;
  timeoutMs: number;
  maxRetries: number;
};

/** Anggaran 1.000 kredit per pos — bab 6.3. */
export const MEMBER_BUDGETS: Record<BudgetPost, number> = {
  B: 250,
  A: 150,
  C: 30,
  D: 220,
  demo: 100,
  cadangan: 250,
};

export const TOTAL_BUDGET = 1000;

function envOr(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

export function loadConfig(overrides: Partial<SectorsConfig> = {}): SectorsConfig {
  const rawMode = envOr('SECTORS_MODE', 'cache_only');
  const mode: SectorsMode =
    rawMode === 'live' || rawMode === 'replay' || rawMode === 'cache_only'
      ? rawMode
      : 'cache_only';

  const rawMember = envOr('SECTORS_MEMBER', 'B');
  const member = (rawMember in MEMBER_BUDGETS ? rawMember : 'B') as BudgetPost;

  return {
    apiKey: envOr('SECTORS_API_KEY', ''),
    baseUrl: envOr('SECTORS_BASE_URL', 'https://api.sectors.app').replace(/\/+$/, ''),
    mode,
    recordingPath: envOr('SECTORS_RECORDING', './recordings/demo.jsonl'),
    budgetPerCheck: Number(envOr('SECTORS_BUDGET_PER_CHECK', '40')),
    member,
    timeoutMs: Number(envOr('SECTORS_TIMEOUT_MS', '20000')),
    maxRetries: Number(envOr('SECTORS_MAX_RETRIES', '2')),
    ...overrides,
  };
}
