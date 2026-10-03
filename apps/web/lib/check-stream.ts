import { CheckResultSchema, TraceEventSchema, type CheckResult, type TraceEvent } from '@cek-dulu/shared/schemas';
import { z } from 'zod';

export type CheckStreamEvent = { kind: 'trace'; value: TraceEvent } | { kind: 'result'; value: CheckResult }
  | { kind: 'error'; value: { checkId: string; message: string } };
const errorSchema = z.object({ checkId: z.string(), message: z.string() });

/** POST SSE memakai fetch, bukan EventSource (EventSource hanya GET). */
export async function readCheckStream(response: Response, onEvent: (event: CheckStreamEvent) => void): Promise<void> {
  if (!response.ok) throw new Error('Permintaan pemeriksaan ditolak.');
  if (!response.headers.get('content-type')?.startsWith('text/event-stream') || !response.body)
    throw new Error('Respons pemeriksaan bukan SSE.');
  const checkId = response.headers.get('x-check-id');
  if (!checkId) throw new Error('Identitas pemeriksaan tidak tersedia.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', terminal = false;
  const frame = (text: string): void => {
    const lines = text.split(/\r?\n/);
    const name = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
    if (name !== 'trace' && name !== 'result' && name !== 'error') return;
    if (terminal) throw new Error('Event diterima setelah hasil akhir.');
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    const raw: unknown = JSON.parse(data);
    const event: CheckStreamEvent = name === 'trace' ? { kind: name, value: TraceEventSchema.parse(raw) }
      : name === 'result' ? { kind: name, value: CheckResultSchema.parse(raw) }
      : { kind: name, value: errorSchema.parse(raw) };
    if (event.value.checkId !== checkId) throw new Error('Identitas event tidak cocok dengan pemeriksaan.');
    // Trace stage done bukan event terminal: rapor baru tersedia pada event result.
    if (name !== 'trace') terminal = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        frame(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (done) break;
    }
    if (buffer.trim()) throw new Error('Event SSE terpotong.');
    if (!terminal) throw new Error('Koneksi terputus sebelum hasil akhir.');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
