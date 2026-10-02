import { z } from 'zod';
import { CheckResultSchema, TraceEventSchema, CheckSourceSchema, type Verdict, type Evidence } from '@cek-dulu/shared/schemas';

export const examples = [
  { id: 'dividend', ticker: 'ADRO', category: 'Dividen', text: 'ADRO yield 25,5% setahun', number: '01' },
  { id: 'valuation', ticker: 'BBCA', category: 'Valuasi', text: 'BBCA PER cuma 3x', number: '02' },
  { id: 'prediction', ticker: 'BBRI', category: 'Prediksi', text: 'BBRI bakal naik 80%', number: '03' },
] as const;
export type DemoId = typeof examples[number]['id'];
export const verdictLabels: Record<Verdict, string> = { supported: 'Didukung', refuted: 'Dibantah',
  misleading: 'Benar tapi menyesatkan', unverifiable: 'Tidak bisa diverifikasi', out_of_scope: 'Di luar cakupan' };
export const verdictTone: Record<Verdict, string> = { supported: 'green', refuted: 'red', misleading: 'amber', unverifiable: 'neutral', out_of_scope: 'neutral' };
export const HistoryItemSchema = z.object({ id: z.string(), text: z.string(), createdAt: z.string().datetime(), saved: z.boolean(),
  demo: z.boolean(), source: CheckSourceSchema.optional(), url: z.string().url().optional(), result: CheckResultSchema, traces: z.array(TraceEventSchema) }).superRefine((item, context) => {
  if (item.id !== item.result.checkId || item.traces.some(trace => trace.checkId !== item.id))
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Identitas rapor tidak cocok.' });
});
export type HistoryItem = z.infer<typeof HistoryItemSchema>;
export const storageKey = 'cek-dulu-results-v2';
export function readHistory(storage?: Pick<Storage, 'getItem'>): HistoryItem[] {
  try {
    const store = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    const raw: unknown = JSON.parse(store?.getItem(storageKey) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap(item => { const parsed = HistoryItemSchema.safeParse(item); return parsed.success ? [parsed.data] : []; }).slice(0, 50);
  } catch { return []; }
}
export function historyMatches(item: HistoryItem, query: string, filter: string, savedOnly: boolean): boolean {
  return (!savedOnly || item.saved) && item.text.toLowerCase().includes(query.toLowerCase())
    && (filter === 'Semua' || item.result.verdicts.some(verdict => verdictLabels[verdict.verdict] === filter));
}
export function formatEvidence(evidence: Pick<Evidence, 'value' | 'unit'>, maximumFractionDigits = 2): string {
  if (typeof evidence.value !== 'number') return ({ empty: 'Data belum tersedia', available: 'Data tersedia', unknown: 'Belum diketahui' } as Record<string, string>)[evidence.value] ?? evidence.value;
  // Pipeline normalizes % to fractions; formatting only, never ask LLM to calculate.
  // Intl's decimal scaling avoids binary multiplication artifacts in full-precision percentages.
  if (evidence.unit === '%') return new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits }).format(evidence.value);
  const text = new Intl.NumberFormat('id-ID', { maximumFractionDigits }).format(evidence.value);
  return evidence.unit === 'IDR' ? `Rp${text}` : `${text}${evidence.unit === 'x' ? '×' : evidence.unit ? ` ${evidence.unit}` : ''}`;
}

/** Present documented fixture field names as prose without changing evidence or values. */
export function readableSourceText(text: string): string {
  const labels: Record<string, string> = {
    'Angka Sectors dividend_yield_avg.avg_yield': 'Rata-rata yield dividen yang dilaporkan',
    'sum(total_yield per tahun) / jumlah tahun': 'Jumlah yield tahunan dibagi jumlah tahun',
    'Cash payout ratio': 'Rasio pembayaran dividen terhadap kas',
    'Rata-rata mandiri sekitar 23,6%; ringkasan AGENTS.md, bukan dihitung ulang dari data tahunan di fixture':
      'Rata-rata mandiri sekitar 23,6%; diringkas dari dokumentasi proyek. Data tahunan tidak disertakan dalam contoh ini.',
  };
  if (labels[text]) return labels[text];
  const metrics: Record<string, string> = {
    'dividend.yield_ttm': 'Yield dividen TTM', 'dividend.avg_yield': 'Rata-rata yield dividen',
    'dividend.avg_period': 'Periode rata-rata dividen', 'dividend.cash_payout_ratio': 'Rasio pembayaran dividen terhadap kas',
    'dividend.total': 'Total dividen', 'dividend.payment': 'Pembayaran dividen',
    'dividend.year_coverage': 'Ketersediaan data dividen', 'dividend.actions_coverage': 'Ketersediaan aksi korporasi dividen',
    'valuation.year': 'Tahun valuasi', 'valuation.pe': 'PER', 'valuation.pb': 'PBV', 'valuation.peg': 'PEG',
    'peer.pe': 'PER pembanding', 'daily.close': 'Harga penutupan', 'daily.volume': 'Volume transaksi',
  };
  const [metric, ...context] = text.split(' ');
  return metric && metrics[metric] ? [metrics[metric], ...context].join(' ') : text;
}
