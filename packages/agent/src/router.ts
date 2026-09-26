import { ClaimSchema, type Claim, type ClaimType, type ToolCall } from '@cek-dulu/shared';
import { ENDPOINTS, estimateCredits, splitWindow, parseWindowPhrase, windowEndingToday,
  type DateWindow, type EndpointName, type ReportSection } from '@cek-dulu/sectors';

export type RoutePlan = { claimId: string; tools: ToolCall[]; estimatedCredits: number;
  status: 'ready' | 'out_of_scope' | 'needs_user_choice'; notes: string[] };
export type RouterOptions = { today: string; window?: DateWindow;
  /** Hit cache = 0; key/TTL diperiksa caller lewat cache B, tanpa I/O di router. */
  isCached?: (call: ToolCall) => boolean; subSector?: string };
type RouteSpec = { sections?: readonly ReportSection[]; tools?: readonly EndpointName[];
  windowTool?: EndpointName; defaultDays?: number };
/** Rencana verifier dasar. Hipotesis Context Hunter menambahkan requiredTools secara terpisah. */
export const CLAIM_ROUTE_TABLE: Readonly<Record<ClaimType, RouteSpec>> = {
  valuation: { sections: ['valuation'] },
  dividend: { sections: ['dividend'] },
  price_move: { windowTool: 'fetchDailyPrice', defaultDays: 30 },
  earnings_growth: { tools: ['fetchQuarterlyFinancials'] },
  foreign_flow: { windowTool: 'fetchForeignFlow', defaultDays: 20 },
  accumulation: { windowTool: 'fetchBrokerSummary', defaultDays: 14, tools: ['fetchShareholdersComposition'] },
  safety: { sections: ['overview'], tools: ['fetchSuspensions', 'fetchCorporateActions', 'fetchFreeFloat'] },
};

function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function resolveWindow(claim: Claim, options: RouterOptions, defaultDays: number): DateWindow | null {
  if (options.window) return options.window;
  const phrase = claim.asserted.window?.trim().toLowerCase();
  if (!phrase) return windowEndingToday(defaultDays, options.today);
  const explicit = /^(\d{4}-\d{2}-\d{2})\s*(?:sampai|hingga|s\.d\.|\.\.)\s*(\d{4}-\d{2}-\d{2})$/.exec(phrase);
  if (explicit) return { start: explicit[1]!, end: explicit[2]! };
  if (/^(ytd|tahun ini)$/.test(phrase)) return { start: `${options.today.slice(0, 4)}-01-01`, end: options.today };
  // Jangan menafsirkan frasa bebas/negatif/pecahan dengan pencocokan sebagian milik B.
  if (!/^(?:sehari|hari ini|seminggu|sepekan|sebulan|sekuartal|triwulan|setahun|[1-9]\d*\s*(?:hari|minggu|bulan|tahun))(?:\s+(?:terakhir|lalu))?$/.test(phrase)) return null;
  const days = parseWindowPhrase(phrase);
  if (!days || !Number.isSafeInteger(days)) return null;
  return windowEndingToday(days, options.today);
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
  let window: DateWindow | null = null;
  if (spec.windowTool) {
    window = resolveWindow(claim, options, spec.defaultDays!);
    if (!window || !validDate(window.start) || !validDate(window.end) || window.start > window.end || window.end > options.today) {
      return { ...plan, status: 'needs_user_choice', notes: ['Jendela tidak valid atau belum jelas; pilih tanggal awal dan akhir.'] };
    }
    const limit = ENDPOINTS[spec.windowTool].maxWindowDays;
    if (!limit) throw new Error('Endpoint jendela tidak memiliki batas.');
    for (const chunk of splitWindow(window, limit)) add(spec.windowTool, { symbol, ...chunk });
    if (!claim.asserted.window && !options.window) plan.notes.push(`Jendela bawaan: ${spec.defaultDays} hari kalender inklusif.`);
  }
  if (spec.sections) add('fetchCompanyReport', { symbol, sections: [...spec.sections] });
  for (const tool of spec.tools ?? []) {
    if (tool === 'fetchQuarterlyFinancials') {
      // B memerlukan lima kuartal untuk YoY; periode eksplisit tidak boleh diabaikan.
      const period = claim.asserted.period?.trim();
      let reportDate: string | undefined;
      const quarter = period && /^Q([1-4])\s+(\d{4})$/i.exec(period);
      if (quarter) reportDate = `${quarter[2]}-${['03-31', '06-30', '09-30', '12-31'][Number(quarter[1]) - 1]}`;
      else if (period && validDate(period)) reportDate = period;
      else if (period) return { ...plan, status: 'needs_user_choice', notes: ['Periode laporan belum jelas.'], tools: [], estimatedCredits: 0 };
      if (reportDate && reportDate > options.today) return { ...plan, status: 'needs_user_choice', notes: ['Periode laporan belum selesai.'], tools: [], estimatedCredits: 0 };
      add(tool, { symbol, n_quarters: 5, ...(reportDate ? { report_date: reportDate } : {}) });
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
