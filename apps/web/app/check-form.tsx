"use client";

import { useState, type FormEvent } from 'react';
import type { CheckResult, TraceEvent } from '@cek-dulu/shared';
import { readTickerChoices, tickerSelections, type UiTickerChoice } from '../lib/ticker-choices';
import { readCheckStream } from '../lib/check-stream';

const labels = { supported: 'Sesuai data', refuted: 'Tidak sesuai data', misleading: 'Benar tapi menyesatkan',
  unverifiable: 'Belum dapat diverifikasi', out_of_scope: 'Di luar cakupan' };

/** UI sambungan sementara hingga komponen rapor C tersedia di repo. */
export default function CheckForm({ fixtureDemo, demoText }: { fixtureDemo: boolean; demoText: string }) {
  const [text, setText] = useState(demoText), [busy, setBusy] = useState(false);
  const [traces, setTraces] = useState<TraceEvent[]>([]), [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState(''), [demo, setDemo] = useState(false);
  const [choices, setChoices] = useState<UiTickerChoice[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  async function submit(event: FormEvent) {
    event.preventDefault(); setChoices([]); setBusy(true); setTraces([]); setResult(null); setError('');
    try {
      const response = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userSelections: tickerSelections(choices, selections), source: 'paste', demo }) });
      await readCheckStream(response, event => {
        if (event.kind === 'trace') {
          setTraces(previous => [...previous, event.value]);
          if (event.value.stage === 'normalize') setChoices(readTickerChoices(event.value));
        }
        else if (event.kind === 'result') setResult(event.value);
        else setError(event.value.message);
      });
    } catch { setError('Pemeriksaan tidak selesai. Periksa konfigurasi LLM, cache, atau koneksi.'); }
    finally { setBusy(false); }
  }
  return <>
    <form onSubmit={submit}>
      <label htmlFor="claim-text">Teks klaim saham</label>
      <textarea id="claim-text" value={text} onChange={event => { setText(event.target.value); setChoices([]); setSelections({}); }} required maxLength={5000}
        disabled={busy} rows={4} style={{ display: 'block', width: '100%', margin: '1rem 0', padding: 10 }} />
      {fixtureDemo && <label style={{ display: 'block', marginBottom: 16 }}>
        <input type="checkbox" checked={demo} disabled={busy} onChange={event => { setDemo(event.target.checked); setChoices([]); setSelections({}); }} />
        Demo fixture offline (bukan cache API asli)
      </label>}
      {choices.length > 0 && <fieldset disabled={busy}>
        <legend>Konfirmasi saham (opsional)</legend>
        {choices.map(choice => <label key={choice.surface} style={{ display: 'block', margin: '1rem 0' }}>
          Sebutan “{choice.surface}”{' '}
          {choice.candidates.length ? <select aria-label={`Saham untuk ${choice.surface}`}
            value={selections[choice.surface] ?? ''}
            onChange={event => setSelections(previous => ({ ...previous, [choice.surface]: event.target.value }))}>
            <option value="">Lewati sebutan ini</option>
            {choice.candidates.map(candidate => <option key={candidate.ticker} value={candidate.ticker}>
              {candidate.ticker} — {candidate.label}
            </option>)}
          </select> : <span>Tidak ada kandidat. Perbaiki teks dengan kode saham yang benar.</span>}
        </label>)}
      </fieldset>}
      <button disabled={busy || !text.trim()} type="submit">{busy ? 'Memeriksa…' : 'Cek klaim'}</button>
    </form>
    {demo && <p>Mode contoh · menggunakan data tersimpan · tanpa mengambil data baru.</p>}
    {error && <p role="alert">{error}</p>}
    <section aria-label="Jejak pemeriksaan" aria-live="polite">
      <h2>Jejak pemeriksaan</h2>
      <ol>{traces.map((trace, index) => <li key={index}>
        <strong>{trace.stage}</strong>: {trace.message} · {trace.credits ?? 0} kredit
        {trace.stage === 'normalize' && <pre>{JSON.stringify(trace.data, null, 2)}</pre>}
        {trace.stage === 'error' && <pre>{JSON.stringify(trace.data, null, 2)}</pre>}
      </li>)}</ol>
    </section>
    {result && <section aria-label="Rapor klaim">
      <h2>Rapor klaim</h2>
      <p>{result.verdicts.length} klaim · {result.creditsUsed} kredit</p>
      {!result.verdicts.length && <p>Tidak ada rapor. Lihat jejak untuk kegagalan ekstraksi atau saham yang perlu dipilih.</p>}
      {result.verdicts.map(verdict => <article key={verdict.claimId}>
        <h3>{result.claims.find(claim => claim.claimId === verdict.claimId)?.ticker} — {labels[verdict.verdict]}</h3>
        <p>Status: <code>{verdict.verdict}</code></p><p>{verdict.explanation}</p>
        {verdict.missingContext.map(context => <p key={context.hypId}>{context.summary}</p>)}
        <details><summary>Evidence dan sumber</summary><pre style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(result.evidence.filter(evidence => verdict.evidenceIds.includes(evidence.evidenceId)), null, 2)}
        </pre></details>
      </article>)}
    </section>}
  </>;
}
