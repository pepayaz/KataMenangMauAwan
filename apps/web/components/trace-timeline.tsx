import { Check, Circle, CircleX, LoaderCircle } from 'lucide-react';
import type { TraceEvent } from '@cek-dulu/shared/schemas';

const stageLabels: Record<TraceEvent['stage'], string> = {
  normalize: 'Mengenali saham', extract: 'Memisahkan klaim', route: 'Menentukan data pembanding',
  verify: 'Memeriksa angka', hunt: 'Mencari konteks', adjudicate: 'Menyusun rapor',
  done: 'Pemeriksaan selesai', error: 'Ada kendala',
};

export default function TraceTimeline({ events, running = false }: { events: TraceEvent[]; running?: boolean }) {
  return <section className="trace-console" aria-label="Jejak pemeriksaan">
    <div className="console-heading"><span>Proses pemeriksaan</span><span>{running ? 'Sedang bekerja' : `${events.length} catatan`}</span></div>
    <ol className="trace-list">
      {events.map((event, index) => {
        const current = running && index === events.length - 1 && event.stage !== 'error';
        const Icon = event.stage === 'error' ? CircleX : current ? LoaderCircle : Check;
        return <li className={event.stage === 'error' ? 'trace-error' : current ? 'trace-active' : ''} key={`${event.ts}-${index}`}>
          <span className="trace-icon"><Icon size={15} className={current ? 'spin' : ''} aria-hidden="true" /></span>
          <div><strong>{stageLabels[event.stage]}</strong><p>{event.message}</p>
          </div>
          <time>{new Date(event.ts).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
        </li>;
      })}
      {running && !events.length && <li className="trace-active"><span className="trace-icon"><Circle size={13} /></span><div><strong>Memulai pemeriksaan</strong><p>Menunggu respons server.</p></div></li>}
    </ol>
    <details className="console-metadata"><summary>Penggunaan data</summary><p>{events.reduce((total, event) => total + (event.credits ?? 0), 0)} kredit Sectors tercatat dalam jejak ini.</p></details>
  </section>;
}
