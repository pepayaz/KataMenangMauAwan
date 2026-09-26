import type { UserTickerSelection } from '@cek-dulu/agent';
import type { CheckInput, CheckResult, TraceEvent } from '@cek-dulu/shared';
import type { SectorsClient } from '@cek-dulu/sectors';

export type PipelineContext = {
  client: SectorsClient;
  userSelections?: readonly UserTickerSelection[];
  /** Mengirim satu event jejak ke SSE dan ke tabel trace_events. */
  emit: (event: Omit<TraceEvent, 'checkId' | 'ts'>) => void;
  /** Tanggal acuan ISO; disuntik supaya evaluasi bisa diulang. */
  today: string;
  /** Feature flag aktif (bab 2.1). */
  flags: Record<string, boolean>;
  signal?: AbortSignal;
};

/**
 * Kontrak antara route handler (B) dan pipeline agen (A).
 *
 * Bab 10: route memanggil pipeline; sebelum pipeline A siap, route memakai
 * implementasi dasar di `baseline.ts`. Yang berubah saat agen A mendarat hanya
 * satu baris di `index.ts` — route handler, persistensi, dan streaming tidak
 * perlu disentuh.
 */
export interface Pipeline {
  readonly name: string;
  run(input: CheckInput, ctx: PipelineContext): Promise<CheckResult>;
}
