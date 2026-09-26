import { createHash } from 'node:crypto';
import { z } from 'zod';
import { EvidenceSchema, type Claim, type Evidence } from '@cek-dulu/shared';
import type { ToolResult } from '@cek-dulu/sectors';

/** Metadata lokal adapter, bukan parameter/field REST Sectors. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
export const HunterMetaSchema = z.object({ metric: z.string(), symbol: z.string(),
  date: isoDate.optional(), year: z.number().int().min(1000).max(9999).optional(), peer: z.string().optional() });
export type HunterMeta = z.infer<typeof HunterMetaSchema>;
export function hunterEvidence(evidence: readonly Evidence[], claim: Claim, metric: string): Evidence[] {
  const unit = metric === 'valuation.year' ? 'years' : metric.startsWith('daily.') ? metric === 'daily.close' ? 'IDR' : 'shares'
    : metric.startsWith('valuation.') || metric === 'peer.pe' || metric === 'dividend.cash_payout_ratio' ? 'x'
    : ['dividend.yield_ttm', 'dividend.avg_yield'].includes(metric) ? '%'
    : ['dividend.payment', 'dividend.total'].includes(metric) ? 'IDR' : metric === 'dividend.avg_period' ? 'years' : undefined;
  return evidence.filter((e) => {
    const meta = HunterMetaSchema.safeParse(e.params.hunter);
    return e.claimId === claim.claimId && meta.success && meta.data.symbol === claim.ticker && meta.data.metric === metric
      && e.unit === unit;
  });
}
export function evidenceMeta(e: Evidence): HunterMeta { return HunterMetaSchema.parse(e.params.hunter); }

const number = z.number().finite().nullable().optional();
const dividendSchema = z.object({ historical_dividends: z.record(z.object({
  total_dividend: number, breakdown: z.array(z.object({ date: isoDate, total: z.number().finite(), yield: number })).nullable().optional(),
})).nullable().optional(), yield_ttm: number, cash_payout_ratio: number,
  dividend_yield_avg: z.object({ avg_yield: z.number().finite(), period: z.number().int().positive() }).nullable().optional() });
const reportSchema = z.object({ symbol: z.string(), dividend: dividendSchema.nullable().optional(),
  valuation: z.object({ historical_valuation: z.array(z.object({ year: z.number().int(), pe: number, pb: number, peg: number })).nullable().optional() }).nullable().optional(),
  peers: z.array(z.object({ symbol: z.string().optional(), pe: number })).nullable().optional() });
const actionsSchema = z.object({ symbol: z.string(), corporate_actions: z.object({ dividend: z.array(z.object({
  ex_date: isoDate, payment_date: isoDate.nullable(), dividend_amount: number,
})).nullable().optional() }) });
const dailySchema = z.array(z.object({ symbol: z.string(), date: isoDate, close: number, volume: number }));

/** Hanya membaca field tipe B; null tetap absen, tidak pernah diganti nol. */
export function flattenHunterToolResult(claim: Claim, result: ToolResult<unknown>, today: string): Evidence[] {
  const evidence: Evidence[] = [];
  const emit = (metric: string, value: number | string | null | undefined, unit?: string,
    extra: Omit<HunterMeta, 'metric' | 'symbol'> = {}): void => {
    if (value === null || value === undefined) return;
    const hunter = { metric, symbol: claim.ticker, ...extra };
    const id = createHash('sha256').update(JSON.stringify([claim.claimId, result.endpoint, result.params, hunter, value])).digest('hex').slice(0, 24);
    evidence.push(EvidenceSchema.parse({ evidenceId: `hunt-${id}`, claimId: claim.claimId,
      tool: result.endpoint, params: { ...result.params, hunter }, credits: result.credits, cached: result.cached,
      fetchedAt: result.fetchedAt, label: `${metric} ${extra.peer ?? claim.ticker} ${extra.date ?? extra.year ?? ''}`.trim(),
      value, ...(unit ? { unit } : {}) }));
  };
  if (result.endpoint === 'fetchCompanyReport') {
    const report = reportSchema.parse(result.data);
    if (report.symbol.replace(/\.JK$/i, '').toUpperCase() !== claim.ticker) throw new Error('Hunter: simbol berbeda.');
    const dividend = report.dividend;
    if (dividend) {
      emit('dividend.yield_ttm', dividend.yield_ttm, '%');
      emit('dividend.avg_yield', dividend.dividend_yield_avg?.avg_yield, '%');
      emit('dividend.avg_period', dividend.dividend_yield_avg?.period, 'years');
      emit('dividend.cash_payout_ratio', dividend.cash_payout_ratio, 'x');
      for (const [yearKey, row] of Object.entries(dividend.historical_dividends ?? {})) {
        if (!/^\d{4}$/.test(yearKey)) continue;
        const year = Number(yearKey);
        emit('dividend.total', row.total_dividend, 'IDR', { year });
        for (const payment of row.breakdown ?? []) emit('dividend.payment', payment.total, 'IDR', { date: payment.date, year });
      }
      const year = Number(today.slice(0, 4)), row = dividend.historical_dividends?.[year];
      const available = row && (typeof row.total_dividend === 'number' || (row.breakdown?.length ?? 0) > 0);
      emit('dividend.year_coverage', available ? 'available' : 'empty', undefined, { year });
    }
    for (const row of report.valuation?.historical_valuation ?? []) {
      emit('valuation.year', row.year, 'years', { year: row.year });
      emit('valuation.pe', row.pe, 'x', { year: row.year });
      emit('valuation.pb', row.pb, 'x', { year: row.year });
      emit('valuation.peg', row.peg, 'x', { year: row.year });
    }
    for (const peer of report.peers ?? []) {
      if (peer.symbol) emit('peer.pe', peer.pe, 'x', { peer: peer.symbol.replace(/\.JK$/i, '').toUpperCase() });
    }
  } else if (result.endpoint === 'fetchCorporateActions') {
    const actions = actionsSchema.parse(result.data);
    if (actions.symbol.replace(/\.JK$/i, '').toUpperCase() !== claim.ticker) throw new Error('Hunter: simbol berbeda.');
    const year = Number(today.slice(0, 4));
    const rows = actions.corporate_actions.dividend;
    const available = rows?.some((r) => r.payment_date && r.payment_date <= today
      && r.payment_date.startsWith(`${year}-`) && typeof r.dividend_amount === 'number');
    emit('dividend.actions_coverage', rows == null ? 'unknown' : available ? 'available' : 'empty', undefined, { year });
  } else if (result.endpoint === 'fetchDailyPrice') {
    for (const row of dailySchema.parse(result.data)) {
      if (row.symbol.replace(/\.JK$/i, '').toUpperCase() !== claim.ticker) throw new Error('Hunter: simbol berbeda.');
      emit('daily.close', row.close, 'IDR', { date: row.date });
      emit('daily.volume', row.volume, 'shares', { date: row.date });
    }
  } else throw new Error('Tool tidak didukung hunter.');
  return [...new Map(evidence.map((e) => [e.evidenceId, e])).values()];
}
