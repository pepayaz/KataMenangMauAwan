import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { HistoryItemSchema, type HistoryItem } from './check-view';
import { TraceEventSchema, CheckResultSchema, CheckSourceSchema } from '@cek-dulu/shared/schemas';

const checkSchema = z.object({ checkId: z.string(), excerpt: z.string(), claimCount: z.number(), createdAt: z.string(), tickers: z.array(z.string()) });
export type RemoteCheck = z.infer<typeof checkSchema>;
let authClient: SupabaseClient | undefined;
export async function sessionHeaders(): Promise<Record<string, string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  authClient ??= createClient(url, key);
  const { data } = await authClient.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
export async function fetchRemoteHistory(): Promise<{ checks: RemoteCheck[]; message: string }> {
  try {
    const response = await fetch('/api/history', { headers: await sessionHeaders() });
    if (response.status === 401) return { checks: [], message: 'Belum ada sesi akun. Riwayat anonim di bawah tersimpan hanya di perangkat ini.' };
    if (!response.ok) return { checks: [], message: 'Riwayat server belum tersedia. Rapor di perangkat tetap dapat dibuka.' };
    const body = z.object({ checks: z.array(checkSchema), changes: z.array(z.unknown()) }).parse(await response.json());
    return { checks: body.checks, message: `${body.checks.length} pemeriksaan server · ${body.changes.length} perubahan status.` };
  } catch { return { checks: [], message: 'Riwayat server tidak dapat dimuat. Rapor lokal tetap tersedia.' }; }
}
export async function fetchRemoteReport(checkId: string): Promise<HistoryItem> {
  const response = await fetch(`/api/history/${encodeURIComponent(checkId)}`, { headers: await sessionHeaders() });
  if (!response.ok) throw new Error('Rapor server tidak tersedia.');
  const body = z.object({ check: z.object({ rawText: z.string(), createdAt: z.string(), source: CheckSourceSchema.optional(), url: z.string().url().nullable().optional() }), result: CheckResultSchema,
    trace: z.array(TraceEventSchema) }).parse(await response.json());
  return HistoryItemSchema.parse({ id: body.result.checkId, text: body.check.rawText, createdAt: body.check.createdAt,
    saved: false, demo: false, source: body.check.source, url: body.check.url ?? undefined, result: body.result, traces: body.trace });
}
