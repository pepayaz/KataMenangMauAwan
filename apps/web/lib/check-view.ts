import { z } from 'zod';
import { CheckResultSchema, TraceEventSchema, type Verdict, type Evidence } from '@cek-dulu/shared/schemas';

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
  demo: z.boolean(), result: CheckResultSchema, traces: z.array(TraceEventSchema) }).superRefine((item, context) => {
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
export function formatEvidence(evidence: Pick<Evidence, 'value' | 'unit'>): string {
  if (typeof evidence.value !== 'number') return evidence.value === 'empty' ? 'Data belum tersedia' : evidence.value;
  // Pipeline normalizes % to fractions; formatting only, never ask LLM to calculate.
  const value = evidence.unit === '%' ? evidence.value * 100 : evidence.value;
  const text = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(value);
  return evidence.unit === 'IDR' ? `Rp${text}` : `${text}${evidence.unit === '%' ? '%' : evidence.unit === 'x' ? '×' : evidence.unit ? ` ${evidence.unit}` : ''}`;
}
