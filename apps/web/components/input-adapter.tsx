"use client";
import { useEffect, useState } from 'react';
import { InputAdaptationSchema, type InputAdaptation } from '@cek-dulu/shared/schemas';

export default function InputAdapter({ disabled, onPrepared, onBusyChange }: { disabled: boolean; onPrepared: (input: InputAdaptation) => void; onBusyChange: (busy: boolean) => void }) {
  const [mode, setMode] = useState<'text' | 'screenshot' | 'link'>('text');
  const [image, setImage] = useState<File | null>(null), [preview, setPreview] = useState('');
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!image) { setPreview(''); return; }
    const objectUrl = URL.createObjectURL(image); setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  async function prepare() {
    setError(''); setBusy(true); onBusyChange(true);
    try {
      let body: FormData | string;
      if (mode === 'screenshot') {
        if (!image || image.size > 3 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(image.type))
          throw new Error('Pilih gambar PNG, JPEG, atau WebP maksimal 3 MB.');
        body = new FormData(); body.set('image', image);
      } else body = JSON.stringify({ url });
      const response = await fetch('/api/input', { method: 'POST', body,
        ...(typeof body === 'string' ? { headers: { 'Content-Type': 'application/json' } } : {}) });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : 'Input belum dapat dibaca.');
      onPrepared(InputAdaptationSchema.parse(result));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Input belum dapat dibaca.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <div className="input-adapter">
    <div role="group" aria-label="Jenis input" className="integration-controls">
      {([['text','Teks'], ['screenshot','Screenshot'], ['link','Link video']] as const).map(([id,label]) =>
        <button type="button" className={`example-chip ${mode === id ? 'selected' : ''}`} aria-pressed={mode === id}
          disabled={disabled || busy} key={id} onClick={() => { setMode(id); setError(''); }}>{label}</button>)}
    </div>
    {mode === 'screenshot' && <div>
      <label htmlFor="screenshot-image">Unggah screenshot</label>
      <input id="screenshot-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || busy}
        onChange={event => { setImage(event.target.files?.[0] ?? null); setError(''); }} />
      {preview && <img className="screenshot-preview" src={preview} alt="Pratinjau screenshot pilihan" />}
      <p>PNG, JPEG, atau WebP · maksimal 3 MB. Gambar dikirim ke penyedia LLM untuk membaca teks dan tidak disimpan dalam riwayat. Potong bagian pribadi sebelum unggah.</p>
      <button type="button" className="text-button" disabled={disabled || busy || !image} onClick={() => void prepare()}>{busy ? 'Membaca gambar…' : 'Baca teks screenshot'}</button>
    </div>}
    {mode === 'link' && <div>
      <label htmlFor="video-link">Link video TikTok</label>
      <input id="video-link" type="url" value={url} placeholder="https://www.tiktok.com/@akun/video/..." disabled={disabled || busy}
        onChange={event => setUrl(event.target.value)} />
      <p>Caption melalui oEmbed resmi. Ucapan dan tulisan dalam video tidak dibaca; gunakan screenshot untuk bagian tersebut.</p>
      <button type="button" className="text-button" disabled={disabled || busy || !url.trim()} onClick={() => void prepare()}>{busy ? 'Memuat caption…' : 'Ambil caption'}</button>
    </div>}
    {error && <p className="integration-error" role="alert">{error}</p>}
  </div>;
}
