import type { TraceEvent } from '@cek-dulu/shared';

/**
 * Server-Sent Events untuk panel jejak (bab 3.7).
 *
 * Satu cek memakan 15-40 detik. Tanpa aliran event, UI hanya bisa menampilkan
 * pemintal selama itu dan pengguna akan menyangka aplikasinya macet. Setiap
 * tahap karena itu mengirim event sebelum dan sesudah kerjanya.
 */

export type SseEventName = 'trace' | 'result' | 'error' | 'ping';

export function encodeSse(name: SseEventName, payload: unknown): Uint8Array {
  const data = JSON.stringify(payload);
  return new TextEncoder().encode(`event: ${name}\ndata: ${data}\n\n`);
}

export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Mematikan buffering proxy; tanpa ini event menumpuk dan baru sampai di akhir.
  'X-Accel-Buffering': 'no',
};

export type TraceEmitter = {
  emit: (event: Omit<TraceEvent, 'checkId' | 'ts'> & Partial<Pick<TraceEvent, 'ts'>>) => void;
  close: () => void;
};

/**
 * Membungkus controller stream menjadi pemancar jejak.
 *
 * `onEvent` dipakai route handler untuk menulis event yang sama ke tabel
 * trace_events; penulisannya sengaja tidak ditunggu supaya latensi basis data
 * tidak menahan aliran ke UI.
 */
export function createTraceEmitter(
  controller: ReadableStreamDefaultController<Uint8Array>,
  checkId: string,
  onEvent?: (event: TraceEvent) => void,
): TraceEmitter {
  let closed = false;

  return {
    emit(partial) {
      if (closed) return;
      const event: TraceEvent = { ...partial, checkId, ts: partial.ts ?? new Date().toISOString() };
      try {
        controller.enqueue(encodeSse('trace', event));
      } catch {
        // Klien menutup koneksi lebih dulu; cek tetap diselesaikan dan disimpan.
        closed = true;
        return;
      }
      onEvent?.(event);
    },
    close() {
      closed = true;
    },
  };
}

/**
 * Detak berkala supaya perantara tidak memutus koneksi yang diam.
 * Verifier bisa menunggu Sectors lebih dari 30 detik tanpa satu pun event.
 */
export function startHeartbeat(
  controller: ReadableStreamDefaultController<Uint8Array>,
  intervalMs = 15_000,
): () => void {
  const timer = setInterval(() => {
    try {
      controller.enqueue(encodeSse('ping', { ts: new Date().toISOString() }));
    } catch {
      clearInterval(timer);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
