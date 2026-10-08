import { parseFinancialPeriod, unsupportedFinancialMetric, ClaimSchema, type Claim, type ClaimType, type ToolCall } from '@cek-dulu/shared';
import { ENDPOINTS, estimateCredits, splitWindow, parseWindowPhrase, normalizeWindowPhrase, sampledWindows, windowEndingToday,
  type DateWindow, type EndpointName, type ReportSection } from '@cek-dulu/sectors';

export type RoutePlan = { claimId: string; tools: ToolCall[]; estimatedCredits: number;
  status: 'ready' | 'out_of_scope' | 'needs_user_choice' | 'unsupported'; notes: string[] };
export type RouterOptions = { today: string; window?: DateWindow;
  /** Hit cache = 0; key/TTL diperiksa caller lewat cache B, tanpa I/O di router. */
  isCached?: (call: ToolCall) => boolean; subSector?: string };
type RouteSpec = { sections?: readonly ReportSection[]; tools?: readonly EndpointName[];
  /** defaultDays tidak diisi berarti klaim tanpa jendela tidak boleh ditebak jendelanya. */
  windowTool?: EndpointName; defaultDays?: number };
/** Rencana verifier dasar. Hipotesis Context Hunter menambahkan requiredTools secara terpisah. */
export const CLAIM_ROUTE_TABLE: Readonly<Record<ClaimType, RouteSpec>> = {
  valuation: { sections: ['valuation'] },
  dividend: { sections: ['dividend'] },
  // Tanpa bawaan: "turun 45%" sejak ATH tidak boleh dibandingkan dengan 30 hari terakhir.
  price_move: { windowTool: 'fetchDailyPrice' },
  earnings_growth: { tools: ['fetchQuarterlyFinancials'] },
  foreign_flow: { windowTool: 'fetchForeignFlow', defaultDays: 20 },
  accumulation: { windowTool: 'fetchBrokerSummary', defaultDays: 14, tools: ['fetchShareholdersComposition'] },
  safety: { sections: ['overview'], tools: ['fetchSuspensions', 'fetchCorporateActions', 'fetchFreeFloat'] },
};

function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function resolveWindow(claim: Claim, options: RouterOptions, defaultDays: number | undefined): DateWindow | null {
  if (options.window) return options.window;
  const phrase = claim.asserted.window && normalizeWindowPhrase(claim.asserted.window);
  if (!phrase) return defaultDays ? windowEndingToday(defaultDays, options.today) : null;
  const explicit = /^(\d{4}-\d{2}-\d{2})\s*(?:sampai|hingga|s\.d\.|\.\.)\s*(\d{4}-\d{2}-\d{2})$/.exec(phrase);
  if (explicit) return { start: explicit[1]!, end: explicit[2]! };
  if (/^(ytd|tahun ini)$/.test(phrase)) return { start: `${options.today.slice(0, 4)}-01-01`, end: options.today };
  // Jangan menafsirkan frasa bebas/negatif/pecahan dengan pencocokan sebagian milik B.
  if (!/^(?:sehari|hari ini|seminggu|sepekan|sebulan|sekuartal|triwulan|setahun|[1-9]\d*\s*(?:hari|minggu|bulan|tahun))(?:\s+(?:terakhir|lalu|ini))?$/.test(phrase)) return null;
  const days = parseWindowPhrase(phrase);
  if (!days || !Number.isSafeInteger(days)) return null;
  return windowEndingToday(days, options.today);
}

/**
 * Klaim yang tidak bisa dinilai verifier tipenya ditolak sebelum kredit terpakai,
 * bukan dibandingkan dengan angka yang maknanya berbeda.
 */
function unsupportedReason(claim: Claim): string | null {
  const { unit, value, metric, window } = claim.asserted;
  if (claim.type === 'price_move' && unit !== '%')
    return 'Klaim harga ini bukan persentase perubahan, jadi tidak dibandingkan dengan perubahan harga.';
  if (claim.type === 'earnings_growth' && unsupportedFinancialMetric(metric))
    return 'Metrik ini memerlukan data khusus dan tidak boleh dibandingkan dengan total laba atau pendapatan.';
  if (claim.type === 'earnings_growth' && unit !== '%')
    return 'Klaim ini menyebut nilai laba, bukan persentase pertumbuhan; pemeriksaan saat ini membandingkan pertumbuhan YoY atau QoQ.';
  if (claim.type === 'earnings_growth' && /\b(?:mom|month[ -]on[ -]month|bulanan|bulan ke bulan)\b/i.test(`${metric} ${window ?? ''}`))
    return 'Pertumbuhan bulanan tidak tersedia dari laporan kuartalan.';
  if (claim.type === 'safety' && value !== undefined)
    return 'Klaim angka ini belum didukung; pemeriksaan risiko hanya menilai pernyataan umum soal keamanan saham.';
  return null;
}

const GROWTH_MODE = /^(?:yoy|qoq|y-o-y|q-o-q|year[ -]on[ -]year|quarter[ -]on[ -]quarter|tahunan|kuartalan|secara tahunan|secara kuartalan)$/i;

/** Compatibility helper: a semester is not a single quarter. */
export function parseQuarter(period: string): { q: number; year: number } | null {
  const parsed = parseFinancialPeriod(period);
  return parsed?.kind === 'quarter' ? { q: parsed.q, year: parsed.year } : null;
}

/** Murni: tanggal wajib disuntikkan agar rencana reproducible, tanpa LLM maupun fetch. */
export function routeClaim(input: Claim, options: RouterOptions): RoutePlan {
  const claim = ClaimSchema.parse(input);
  const plan: RoutePlan = { claimId: claim.claimId, tools: [], estimatedCredits: 0, status: 'ready', notes: [] };
  if (!claim.inScope) return { ...plan, status: 'out_of_scope' };
  if (!validDate(options.today)) throw new Error('Tanggal router tidak valid.');
  const spec = CLAIM_ROUTE_TABLE[claim.type], symbol = claim.ticker;
  const add = (tool: EndpointName, params: Record<string, unknown>): void => {
    const call = { tool, params };
    plan.tools.push(call);
    plan.estimatedCredits += options.isCached?.(call) ? 0 : estimateCredits(tool, params);
  };
  const unsupported = unsupportedReason(claim);
  if (unsupported) return { ...plan, status: 'unsupported', notes: [unsupported] };
  let window: DateWindow | null = null;
  if (spec.windowTool) {
    window = resolveWindow(claim, options, spec.defaultDays);
    if (!window && !claim.asserted.window && !options.window) {
      return { ...plan, status: 'needs_user_choice', notes: ['Klaim tidak menyebut jangka waktu; pilih tanggal awal dan akhir.'] };
    }
    if (!window || !validDate(window.start) || !validDate(window.end) || window.start > window.end || window.end > options.today) {
      return { ...plan, status: 'needs_user_choice', notes: ['Jendela tidak valid atau belum jelas; pilih tanggal awal dan akhir.'] };
    }
    const limit = ENDPOINTS[spec.windowTool].maxWindowDays;
    if (!limit) throw new Error('Endpoint jendela tidak memiliki batas.');
    const probes = spec.windowTool === 'fetchDailyPrice' ? sampledWindows(window, limit) : null;
    if (probes) {
      for (const probe of probes) add(spec.windowTool, { symbol, ...probe });
      plan.notes.push(`Jendela panjang ${window.start} s.d. ${window.end}: harga awal dan akhir diambil dari dua cuplikan.`);
    } else for (const chunk of splitWindow(window, limit)) add(spec.windowTool, { symbol, ...chunk });
    if (!claim.asserted.window && !options.window) plan.notes.push(`Jendela bawaan: ${spec.defaultDays} hari kalender inklusif.`);
  }
  if (spec.sections) add('fetchCompanyReport', { symbol, sections: [...spec.sections] });
  for (const tool of spec.tools ?? []) {
    if (tool === 'fetchQuarterlyFinancials') {
      // B memerlukan lima kuartal untuk YoY; periode eksplisit tidak boleh diabaikan.
      // "YoY"/"QoQ" adalah mode pertumbuhan yang sering tertukar ke period, bukan periode laporan.
      const rawPeriod = claim.asserted.period?.trim();
      const period = rawPeriod && GROWTH_MODE.test(rawPeriod) ? undefined : rawPeriod;
      let reportDate: string | undefined;
      const financialPeriod = period ? parseFinancialPeriod(period) : null;
      if (financialPeriod) reportDate = financialPeriod.reportDate;
      else if (period && validDate(period)) reportDate = period;
      else if (period) return { ...plan, status: 'needs_user_choice', notes: ['Periode laporan belum jelas.'], tools: [], estimatedCredits: 0 };
      if (reportDate && reportDate > options.today) return { ...plan, status: 'needs_user_choice', notes: ['Periode laporan belum selesai.'], tools: [], estimatedCredits: 0 };
      add(tool, { symbol, n_quarters: financialPeriod?.kind === 'semester' ? financialPeriod.q + 4 : 5, ...(reportDate ? { report_date: reportDate } : {}) });
    } else if (tool === 'fetchShareholdersComposition') {
      const firstYear = Number(window!.start.slice(0, 4)), lastYear = Number(window!.end.slice(0, 4));
      for (let year = firstYear; year <= lastYear; year += 1) add(tool, { symbol, year });
    } else if (tool === 'fetchSuspensions') add(tool, { symbol,
      ...windowEndingToday(730, options.today), limit: 30 });
    else if (tool === 'fetchFreeFloat') add(tool, options.subSector ? { sub_sector: options.subSector } : {});
    else add(tool, { symbol });
  }
  return plan;
}
