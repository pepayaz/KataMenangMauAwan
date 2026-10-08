import type { CheckResult, TraceEvent } from '@cek-dulu/shared/schemas';

export function checkOutcome(result: CheckResult, traces: readonly TraceEvent[]) {
  if (result.verdicts.length) return { kind: 'complete' as const, message: 'Pemeriksaan selesai.' };
  const error = traces.find(event => event.stage === 'error');
  if (error) return { kind: 'error' as const, message: error.message };
  const choice = traces.find(event => event.stage === 'normalize' && event.data && typeof event.data === 'object'
    && 'status' in event.data && event.data.status === 'needs_user_choice');
  if (choice) return { kind: 'needs_user_choice' as const, message: 'Konfirmasikan saham yang dimaksud sebelum melanjutkan.' };
  return { kind: 'empty' as const, message: 'Belum ada klaim yang dapat diperiksa. Tinjau ticker, angka, dan periode pada teks.' };
}

/** Human-readable diagnostics; never display raw provider payloads or source text. */
export function traceDetails(event: TraceEvent): string[] {
  const data = event.data && typeof event.data === 'object' ? event.data as Record<string, unknown> : {};
  if (event.stage === 'normalize') {
    const entities = Array.isArray(data.entities) ? data.entities : [];
    const tickers = entities.flatMap(entity => entity && typeof entity === 'object' && typeof entity.ticker === 'string' ? [entity.ticker] : []);
    return [tickers.length ? `Saham dikenali: ${[...new Set(tickers)].join(', ')}` : 'Belum ada saham dikenali.',
      data.status === 'needs_user_choice' ? 'Menunggu konfirmasi saham.' : 'Tidak memerlukan konfirmasi saham.'];
  }
  if (event.stage === 'extract') {
    const claims = Array.isArray(data.claimIds) ? data.claimIds.length : 0;
    const rejected = Array.isArray(data.rejected) ? data.rejected.length : 0;
    const reasons: Record<string, string> = { INVALID_SPAN: 'Posisi kutipan tidak valid', INVALID_QUOTE: 'Kutipan tidak cocok dengan teks',
      UNKNOWN_TICKER: 'Ticker belum dikenali', LOW_CONFIDENCE_ENTITY: 'Pengenalan saham belum pasti', NO_TICKER: 'Tidak ada ticker',
      VALUE_NOT_WRITTEN: 'Angka tidak tertulis persis', UNIT_NOT_WRITTEN: 'Satuan tidak cocok', PERIOD_NOT_WRITTEN: 'Periode tidak tertulis', DUPLICATE_CLAIM: 'Klaim duplikat' };
    return [`${claims} klaim diterima · ${rejected} kandidat ditolak`, ...new Set((Array.isArray(data.rejected) ? data.rejected : [])
      .flatMap(item => item && typeof item === 'object' && typeof item.reason === 'string' ? [reasons[item.reason] ?? 'Kandidat tidak lolos validasi'] : []))];
  }
  if (event.stage === 'verify') return [data.status === 'out_of_scope' ? 'Di luar cakupan pemeriksaan.'
    : data.status === 'needs_data_or_flag' ? 'Jenis klaim, periode, atau data belum dapat diproses.'
    : `${Array.isArray(data.evidenceIds) ? data.evidenceIds.length : 0} bukti diperoleh`, `${event.credits ?? 0} kredit Sectors`, ...(Array.isArray(data.sourceCalls) ? data.sourceCalls.map((source: { tool?: string; status?: string; cached?: boolean; code?: string }) => `${source.tool}: ${source.status === 'failed' ? `gagal (${source.code})` : source.status === 'reused' ? 'respons Sectors dipakai bersama dalam pemeriksaan ini' : source.cached ? 'data Sectors dari cache' : 'respons langsung Sectors'}`) : []), ...(typeof data.note === 'string' && data.note ? [data.note] : [])];
  return [];
}
