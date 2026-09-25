import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CheckSourceSchema, type CheckInput, type TraceEvent } from '@cek-dulu/shared';
import { createSectorsClient } from '@cek-dulu/sectors';
import { loadAliases } from '@/lib/aliases';
import { getUser } from '@/lib/auth';
import { loadFlags } from '@/lib/flags';
import {
  createCheckRow,
  markCheckFailed,
  saveCheckResult,
  saveTraceEvent,
} from '@/lib/persistence';
import { createPipeline } from '@/lib/pipeline';
import { SSE_HEADERS, createTraceEmitter, encodeSse, startHeartbeat } from '@/lib/sse';

/**
 * POST /api/check — memulai satu cek dan mengalirkan jejaknya (bab 8.1 B nomor 4).
 *
 * Bab 3.7: satu cek memakan 15-40 detik, jadi respons berupa Server-Sent Events,
 * bukan satu JSON di akhir. Urutan event: beberapa `trace`, lalu tepat satu
 * `result` atau `error`.
 */

export const runtime = 'nodejs';
// Sesuaikan dengan nilai maksimum yang diizinkan paket Vercel yang dipakai.
// Bila masih kurang, orkestrasi pindah ke job latar dengan polling tabel checks.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  text: z.string().min(1, 'Teks kosong.').max(5000, 'Teks terlalu panjang.'),
  url: z.string().url().optional(),
  source: CheckSourceSchema.default('paste'),
  /** Ticker yang dipilih pengguna saat resolusi ambigu (bab 3.3 nomor 4). */
  ticker: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: 'Permintaan tidak valid.', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const user = await getUser(req);
  const { client, db } = createSectorsClient();
  const [flags, aliases] = await Promise.all([loadFlags(db), loadAliases(db)]);

  const checkId = randomUUID();
  const input: CheckInput = {
    checkId,
    source: body.source,
    rawText: body.text,
    createdAt: new Date().toISOString(),
  };
  if (user) input.userId = user.id;
  if (body.url !== undefined) input.url = body.url;

  // Baris checks dibuat lebih dulu supaya trace_events punya induk yang sah.
  if (db) await createCheckRow(db, input);

  const pipeline = createPipeline({ aliases });
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stopHeartbeat = startHeartbeat(controller);
      const pending: Array<Promise<unknown>> = [];

      const emitter = createTraceEmitter(controller, checkId, (event: TraceEvent) => {
        // Penulisan jejak tidak ditunggu: latensi Postgres tidak boleh menahan UI.
        if (db) pending.push(saveTraceEvent(db, event));
      });

      try {
        const result = await pipeline.run(input, {
          client,
          emit: emitter.emit,
          today: new Date().toISOString().slice(0, 10),
          flags,
          signal: abort.signal,
        });

        if (db) await saveCheckResult(db, result);
        controller.enqueue(encodeSse('result', result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[api/check] pipeline gagal:', message);
        if (db) await markCheckFailed(db, checkId);
        controller.enqueue(encodeSse('error', { checkId, message }));
      } finally {
        emitter.close();
        stopHeartbeat();
        // Tunggu penulisan jejak yang masih berjalan supaya riwayat tidak bolong.
        await Promise.allSettled(pending);
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, { headers: { ...SSE_HEADERS, 'X-Check-Id': checkId } });
}

/** Pemeriksaan kesehatan ringan untuk smoke test integrasi harian pukul 21:00. */
export async function GET(): Promise<Response> {
  const { client, db } = createSectorsClient();
  return Response.json({
    ok: true,
    mode: client.mode,
    database: db ? 'supabase' : 'tidak tersambung',
    pipeline: createPipeline().name,
  });
}
