import { normalizeTicker } from '@cek-dulu/shared';
import { cacheKey, isFresh, type CacheStore } from './cache/types.js';
import { MemoryCacheStore } from './cache/memory.js';
import { loadConfig, type BudgetPost, type SectorsConfig } from './config.js';
import {
  ENDPOINTS,
  REPORT_SECTIONS,
  estimateCredits,
  type EndpointName,
  type ReportSection,
} from './endpoints.js';
import { SectorsError } from './errors.js';
import { CreditBudget } from './ledger/budget.js';
import { MemoryLedgerStore } from './ledger/memory.js';
import type { LedgerStore } from './ledger/types.js';
import { Recorder } from './recorder.js';
import type * as T from './types.js';
import { splitWindow, type DateWindow } from './windows.js';

export type CallOptions = {
  /** Diikutkan ke buku kredit dan dipakai menegakkan anggaran per cek. */
  checkId?: string | null;
  /** Lewati cache sekalipun masih segar. Hanya untuk skrip pemanasan. */
  forceRefresh?: boolean;
};

/** Hasil satu panggilan alat, lengkap dengan asal-usulnya untuk membangun Evidence. */
export type ToolResult<D> = {
  data: D;
  endpoint: EndpointName;
  params: Record<string, unknown>;
  credits: number;
  cached: boolean;
  fetchedAt: string;
};

export type SectorsClientDeps = {
  config?: Partial<SectorsConfig>;
  cache?: CacheStore;
  ledger?: LedgerStore;
  /** Disuntik di uji unit; bawaannya `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  recorder?: Recorder;
};

/**
 * Satu-satunya jalan ke Sectors (bab 6.1).
 *
 * Urutan setiap panggilan: cache -> mode -> anggaran -> jaringan -> catat.
 * Tidak ada jalan pintas; itu yang membuat sisa kredit bisa dipercaya.
 */
export class SectorsClient {
  readonly config: SectorsConfig;
  readonly budget: CreditBudget;
  private readonly cache: CacheStore;
  private readonly ledger: LedgerStore;
  private readonly fetchImpl: typeof fetch;
  private readonly recorder: Recorder;

  constructor(deps: SectorsClientDeps = {}) {
    this.config = loadConfig(deps.config ?? {});
    this.cache = deps.cache ?? new MemoryCacheStore();
    this.ledger = deps.ledger ?? new MemoryLedgerStore();
    this.budget = new CreditBudget(this.ledger, this.config.budgetPerCheck);
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.recorder =
      deps.recorder ??
      new Recorder(
        this.config.recordingPath,
        this.config.mode === 'replay' ? 'replay' : this.config.mode === 'live' ? 'record' : 'off',
      );
  }

  get mode(): SectorsConfig['mode'] {
    return this.config.mode;
  }

  // ----------------------------------------------------------------- inti

  private async call<D>(
    endpoint: EndpointName,
    pathParams: Record<string, string>,
    query: Record<string, unknown>,
    opts: CallOptions,
  ): Promise<ToolResult<D>> {
    const spec = ENDPOINTS[endpoint];
    const allParams = { ...pathParams, ...query };
    const key = cacheKey(endpoint, allParams);
    const checkId = opts.checkId ?? null;
    const member: BudgetPost = this.config.member;

    // 1. Cache lebih dulu — selalu, di mode apa pun.
    if (opts.forceRefresh !== true) {
      const hit = await this.cache.get(key);
      if (hit && isFresh(hit)) {
        await this.ledger.record({
          endpoint,
          params: allParams,
          credits: 0,
          cached: true,
          checkId,
          member,
          ts: new Date().toISOString(),
        });
        return {
          data: hit.response as D,
          endpoint,
          params: allParams,
          credits: 0,
          cached: true,
          fetchedAt: hit.fetchedAt,
        };
      }
    }

    // 2. Mode yang tidak boleh menyentuh jaringan.
    if (this.config.mode === 'cache_only') {
      throw new SectorsError(
        'CACHE_MISS',
        `Mode cache_only: ${endpoint} belum ada di cache (${key}). Jalankan npm run pull:demo.`,
        { endpoint },
      );
    }

    if (this.config.mode === 'replay') {
      const recorded = await this.recorder.lookup(key);
      if (!recorded) {
        throw new SectorsError('REPLAY_MISS', `Mode replay: ${key} tidak ada di rekaman.`, {
          endpoint,
        });
      }
      await this.cache.set({
        key,
        endpoint,
        params: allParams,
        response: recorded.response,
        fetchedAt: recorded.ts,
        ttlSeconds: spec.ttlSeconds,
      });
      await this.ledger.record({
        endpoint,
        params: allParams,
        credits: 0,
        cached: true,
        checkId,
        member,
        ts: new Date().toISOString(),
      });
      return {
        data: recorded.response as D,
        endpoint,
        params: allParams,
        credits: 0,
        cached: true,
        fetchedAt: recorded.ts,
      };
    }

    // 3. Live: pesan kredit sebelum jaringan disentuh.
    if (this.config.apiKey === '') {
      throw new SectorsError('UNAUTHORIZED', 'SECTORS_API_KEY belum diisi.', { endpoint });
    }
    const reserved = estimateCredits(endpoint, allParams);
    await this.budget.reserve({ credits: reserved, checkId, member, endpoint });

    let data: D;
    try {
      data = await this.request<D>(spec.path, pathParams, query, endpoint);
    } catch (err) {
      // 4xx/5xx yang tidak menagih kredit dikembalikan ke anggaran; 404 tetap menagih 1.
      const billed = err instanceof SectorsError && err.code === 'NOT_FOUND' ? 1 : 0;
      this.budget.settle({ reserved, actual: billed, checkId, member });
      await this.ledger.record({
        endpoint,
        params: allParams,
        credits: billed,
        cached: false,
        checkId,
        member,
        ts: new Date().toISOString(),
      });
      throw err;
    }

    const actual = actualCredits(endpoint, allParams, data, reserved);
    this.budget.settle({ reserved, actual, checkId, member });

    const fetchedAt = new Date().toISOString();
    await this.cache.set({
      key,
      endpoint,
      params: allParams,
      response: data,
      fetchedAt,
      ttlSeconds: spec.ttlSeconds,
    });
    await this.recorder.append({ key, endpoint, params: allParams, response: data, ts: fetchedAt });
    await this.ledger.record({
      endpoint,
      params: allParams,
      credits: actual,
      cached: false,
      checkId,
      member,
      ts: fetchedAt,
    });

    return { data, endpoint, params: allParams, credits: actual, cached: false, fetchedAt };
  }

  private async request<D>(
    pathTemplate: string,
    pathParams: Record<string, string>,
    query: Record<string, unknown>,
    endpoint: EndpointName,
  ): Promise<D> {
    let path = pathTemplate;
    for (const [k, v] of Object.entries(pathParams)) {
      path = path.replace(`{${k}}`, encodeURIComponent(v));
    }
    const url = new URL(this.config.baseUrl + path);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const res = await this.fetchImpl(url.toString(), {
          method: 'GET',
          headers: { Authorization: this.config.apiKey, Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) return (await res.json()) as D;

        const body = await res.text().catch(() => '');
        const err = httpError(res.status, body, endpoint);
        // 429 dan 5xx gratis; layak dicoba lagi dengan jeda.
        if (!err.terminal && attempt < this.config.maxRetries) {
          lastErr = err;
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw err;
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof SectorsError) {
          if (err.terminal || attempt >= this.config.maxRetries) throw err;
          lastErr = err;
        } else {
          lastErr = new SectorsError('NETWORK', `Gagal memanggil ${endpoint}: ${String(err)}`, {
            endpoint,
          });
          if (attempt >= this.config.maxRetries) throw lastErr;
        }
        await sleep(400 * 2 ** attempt);
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new SectorsError('NETWORK', `Gagal memanggil ${endpoint}.`, { endpoint });
  }

  // ------------------------------------------------------------- endpoint

  /** Bab 6.3: minta hanya section yang dibutuhkan; setiap section 1 kredit. */
  async fetchCompanyReport(
    symbol: string,
    sections: ReportSection[] = [...REPORT_SECTIONS],
    opts: CallOptions = {},
  ): Promise<ToolResult<T.CompanyReport>> {
    return this.call<T.CompanyReport>(
      'fetchCompanyReport',
      { symbol: normalizeTicker(symbol) },
      { sections: [...sections].sort() },
      opts,
    );
  }

  async fetchQuarterlyFinancials(
    symbol: string,
    params: { report_date?: string; n_quarters?: number; approx?: boolean } = {},
    opts: CallOptions = {},
  ): Promise<ToolResult<T.QuarterlyFinancialItem[]>> {
    return this.call<T.QuarterlyFinancialItem[]>(
      'fetchQuarterlyFinancials',
      { symbol: normalizeTicker(symbol) },
      { ...params },
      opts,
    );
  }

  async fetchQuarterlyFinancialDates(
    symbol: string,
    opts: CallOptions = {},
  ): Promise<ToolResult<T.QuarterlyDates>> {
    return this.call<T.QuarterlyDates>(
      'fetchQuarterlyFinancialDates',
      { symbol: normalizeTicker(symbol) },
      {},
      opts,
    );
  }

  /** Jendela lebih dari 90 hari dipecah otomatis; hasilnya digabung berurutan. */
  async fetchDailyPrice(
    symbol: string,
    window: DateWindow,
    opts: CallOptions = {},
  ): Promise<ToolResult<T.DailyDataItem[]>> {
    const sym = normalizeTicker(symbol);
    const chunks = splitWindow(window, ENDPOINTS.fetchDailyPrice.maxWindowDays ?? 90);
    const results: Array<ToolResult<T.DailyDataItem[]>> = [];
    for (const chunk of chunks) {
      results.push(
        await this.call<T.DailyDataItem[]>(
          'fetchDailyPrice',
          { symbol: sym },
          { start: chunk.start, end: chunk.end },
          opts,
        ),
      );
    }
    return mergeResults(results, 'fetchDailyPrice', { symbol: sym, ...window }, (rs) =>
      dedupeByDate(rs.flatMap((r) => r.data ?? [])),
    );
  }

  async fetchForeignFlow(
    symbol: string,
    window: DateWindow,
    opts: CallOptions = {},
  ): Promise<ToolResult<T.ForeignFlowResponse>> {
    const sym = normalizeTicker(symbol);
    const chunks = splitWindow(window, ENDPOINTS.fetchForeignFlow.maxWindowDays ?? 90);
    const results: Array<ToolResult<T.ForeignFlowResponse>> = [];
    for (const chunk of chunks) {
      results.push(
        await this.call<T.ForeignFlowResponse>(
          'fetchForeignFlow',
          { symbol: sym },
          { start: chunk.start, end: chunk.end },
          opts,
        ),
      );
    }
    return mergeResults(results, 'fetchForeignFlow', { symbol: sym, ...window }, (rs) => ({
      symbol: rs[0]?.data.symbol ?? sym,
      start: window.start,
      end: window.end,
      data: dedupeByDate(rs.flatMap((r) => r.data.data ?? [])),
    }));
  }

  async fetchCorporateActions(
    symbol: string,
    opts: CallOptions = {},
  ): Promise<ToolResult<T.CorporateActions>> {
    return this.call<T.CorporateActions>(
      'fetchCorporateActions',
      { symbol: normalizeTicker(symbol) },
      {},
      opts,
    );
  }

  async fetchShareholdersComposition(
    symbol: string,
    year: number,
    opts: CallOptions = {},
  ): Promise<ToolResult<T.ShareholdersComposition>> {
    return this.call<T.ShareholdersComposition>(
      'fetchShareholdersComposition',
      { symbol: normalizeTicker(symbol) },
      { year },
      opts,
    );
  }

  /**
   * Free float hanya tersedia sebagai daftar; tidak ada varian per simbol.
   * Karena itu hasilnya di-cache 7 hari dan disaring di sisi kita.
   */
  async fetchFreeFloat(
    filter: { sector?: string; sub_sector?: string; industry?: string; sub_industry?: string } = {},
    opts: CallOptions = {},
  ): Promise<ToolResult<T.FreeFloatItem[]>> {
    return this.call<T.FreeFloatItem[]>('fetchFreeFloat', {}, { ...filter }, opts);
  }

  /** Jendela broker summary maksimal 14 hari per panggilan. */
  async fetchBrokerSummary(
    symbol: string,
    window: DateWindow,
    opts: CallOptions = {},
  ): Promise<ToolResult<T.BrokerSummaryResponse>> {
    const sym = normalizeTicker(symbol);
    const chunks = splitWindow(window, ENDPOINTS.fetchBrokerSummary.maxWindowDays ?? 14);
    const results: Array<ToolResult<T.BrokerSummaryResponse>> = [];
    for (const chunk of chunks) {
      results.push(
        await this.call<T.BrokerSummaryResponse>(
          'fetchBrokerSummary',
          { symbol: sym },
          { start: chunk.start, end: chunk.end },
          opts,
        ),
      );
    }
    return mergeResults(results, 'fetchBrokerSummary', { symbol: sym, ...window }, (rs) => ({
      symbol: rs[0]?.data.symbol ?? sym,
      start: window.start,
      end: window.end,
      data: dedupeByDate(rs.flatMap((r) => r.data.data ?? [])),
    }));
  }

  async fetchSuspensions(
    params: { symbol?: string; start?: string; end?: string; limit?: number } = {},
    opts: CallOptions = {},
  ): Promise<ToolResult<T.SuspensionsResponse>> {
    const query: Record<string, unknown> = { ...params, limit: params.limit ?? 30 };
    if (params.symbol !== undefined) query.symbol = normalizeTicker(params.symbol);
    return this.call<T.SuspensionsResponse>('fetchSuspensions', {}, query, opts);
  }

  async fetchListingPerformance(
    symbol: string,
    opts: CallOptions = {},
  ): Promise<ToolResult<T.ListingPerformance>> {
    return this.call<T.ListingPerformance>(
      'fetchListingPerformance',
      { symbol: normalizeTicker(symbol) },
      {},
      opts,
    );
  }

  /** Daftar emiten untuk mengisi kamus alias (bab 3.3). Sekali tarik. */
  async fetchCompanies(
    params: { limit?: number; offset?: number; order_by?: string } = {},
    opts: CallOptions = {},
  ): Promise<ToolResult<T.CompaniesResponse>> {
    return this.call<T.CompaniesResponse>(
      'fetchCompanies',
      {},
      {
        limit: params.limit ?? 1000,
        offset: params.offset ?? 0,
        order_by: params.order_by ?? 'symbol',
      },
      opts,
    );
  }
}

// ---------------------------------------------------------------- bantuan

function httpError(status: number, body: string, endpoint: EndpointName): SectorsError {
  const snippet = body.slice(0, 200);
  if (status === 404) {
    return new SectorsError('NOT_FOUND', `${endpoint}: data tidak ditemukan. ${snippet}`, {
      status,
      endpoint,
      terminal: true,
    });
  }
  if (status === 400) {
    return new SectorsError('BAD_REQUEST', `${endpoint}: permintaan tidak valid. ${snippet}`, {
      status,
      endpoint,
      terminal: true,
    });
  }
  if (status === 401 || status === 403) {
    return new SectorsError('UNAUTHORIZED', `${endpoint}: kunci API ditolak. ${snippet}`, {
      status,
      endpoint,
      terminal: true,
    });
  }
  if (status === 429) {
    return new SectorsError('RATE_LIMIT', `${endpoint}: kena batas laju. ${snippet}`, {
      status,
      endpoint,
      terminal: false,
    });
  }
  return new SectorsError('SERVER_ERROR', `${endpoint}: galat server ${status}. ${snippet}`, {
    status,
    endpoint,
    terminal: false,
  });
}

/**
 * Biaya sebenarnya setelah respons datang. Untuk endpoint yang menagih per
 * baris, estimasi di muka sengaja longgar; di sini dikembalikan ke angka nyata.
 */
function actualCredits(
  endpoint: EndpointName,
  params: Record<string, unknown>,
  data: unknown,
  reserved: number,
): number {
  switch (endpoint) {
    case 'fetchQuarterlyFinancials':
      return Array.isArray(data) ? Math.max(1, data.length) : reserved;
    case 'fetchFreeFloat':
      return Array.isArray(data) ? Math.max(1, Math.ceil(data.length / 100)) : reserved;
    case 'fetchCompanyReport': {
      const sections = params.sections;
      return Array.isArray(sections) && sections.length > 0 ? sections.length : reserved;
    }
    default:
      return reserved;
  }
}

function mergeResults<A, B>(
  results: Array<ToolResult<A>>,
  endpoint: EndpointName,
  params: Record<string, unknown>,
  merge: (rs: Array<ToolResult<A>>) => B,
): ToolResult<B> {
  return {
    data: merge(results),
    endpoint,
    params,
    credits: results.reduce((s, r) => s + r.credits, 0),
    // Gabungan dianggap dari cache hanya bila setiap potongannya dari cache.
    cached: results.length > 0 && results.every((r) => r.cached),
    fetchedAt:
      results
        .map((r) => r.fetchedAt)
        .sort()
        .at(-1) ?? new Date().toISOString(),
  };
}

function dedupeByDate<R extends { date: string }>(rows: R[]): R[] {
  const byDate = new Map<string, R>();
  for (const row of rows) byDate.set(row.date, row);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
