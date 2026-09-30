"use client";
import { useEffect, useState, type DragEvent } from 'react';
import { FileText, Image, Link, Video, Upload, LoaderCircle, ScanText, RotateCcw } from 'lucide-react';
import { InputAdaptationSchema, type InputAdaptation } from '@cek-dulu/shared/schemas';

export type InputMode = 'text' | 'screenshot' | 'link' | 'video';
type Props = {
  disabled: boolean; mode: InputMode; prepared: boolean; needsText?: boolean;
  onModeChange: (mode: InputMode) => void; onReset: () => void;
  onPrepared: (input: InputAdaptation) => void; onBusyChange: (busy: boolean) => void;
};
const modes = [
  { id: 'text', label: 'Teks', icon: FileText }, { id: 'screenshot', label: 'Screenshot', icon: Image },
  { id: 'link', label: 'Link video', icon: Link }, { id: 'video', label: 'Unggah video', icon: Video },
] as const;

export default function InputAdapter({ disabled, mode, prepared, needsText = false, onModeChange, onReset, onPrepared, onBusyChange }: Props) {
  const [image, setImage] = useState<File | null>(null), [preview, setPreview] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!image) { setPreview(''); return; }
    const objectUrl = URL.createObjectURL(image); setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  function selectFile(file: File | null) {
    onReset(); setError('');
    const screenshot = mode === 'screenshot';
    const types = screenshot ? ['image/png', 'image/jpeg', 'image/webp'] : ['video/mp4', 'video/webm'];
    const limit = (screenshot ? 3 : 4) * 1024 * 1024;
    const valid = !file || (types.includes(file.type) && file.size <= limit && file.size > 0);
    if (!valid) setError(screenshot ? 'Pilih gambar PNG, JPEG, atau WebP maksimal 3 MB.' : 'Pilih video MP4 atau WebM maksimal 4 MB.');
    if (screenshot) setImage(valid ? file : null); else setVideo(valid ? file : null);
  }
  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false);
    if (disabled || busy) return;
    if (event.dataTransfer.files.length !== 1) { onReset(); setImage(null); setVideo(null); setError('Pilih satu berkas untuk dibaca.'); return; }
    selectFile(event.dataTransfer.files[0] ?? null);
  }
  async function prepare() {
    if (disabled || busy) return;
    setError(''); setBusy(true); onBusyChange(true);
    try {
      let body: FormData | string;
      if (mode === 'screenshot' || mode === 'video') {
        const file = mode === 'screenshot' ? image : video;
        if (!file) throw new Error('Pilih berkas terlebih dahulu.');
        body = new FormData(); body.set(mode === 'screenshot' ? 'image' : 'video', file);
      } else body = JSON.stringify({ url: url.trim() });
      const response = await fetch('/api/input', { method: 'POST', body,
        ...(typeof body === 'string' ? { headers: { 'Content-Type': 'application/json' } } : {}) });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : 'Input belum dapat dibaca.');
      onPrepared(InputAdaptationSchema.parse(result));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Input belum dapat dibaca.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  const screenshot = mode === 'screenshot';
  const file = screenshot ? image : video;
  const available = mode === 'link' ? !!url.trim() : !!file;
  return <div className="input-adapter">
    <div role="group" aria-label="Jenis input" className="input-modes">
      {modes.map(({ id, label, icon: Icon }) => <button type="button" key={id}
        aria-pressed={mode === id} disabled={disabled || busy}
        onClick={() => { onModeChange(id); setError(''); setDragging(false); }}>
        <Icon size={18} aria-hidden="true" />{label}
      </button>)}
    </div>
    {mode !== 'text' && <div className="media-panel" key={mode}>
      {mode === 'link' ? <>
        <label className="field-label" htmlFor="video-link">Tautan video publik</label>
        <input id="video-link" type="url" value={url} placeholder="Tempel link TikTok, YouTube, atau video publik lain"
          disabled={disabled || busy} onChange={event => { setUrl(event.target.value); setError(''); onReset(); }} />
        <p>Audio dan tulisan pada video dibaca menjadi teks. Akses yang dibatasi platform dapat memerlukan unggahan berkas.</p>
      </> : <>
        <label className={`upload-zone ${dragging ? 'is-dragging' : ''} ${disabled || busy ? 'is-disabled' : ''}`}
          htmlFor={screenshot ? 'screenshot-image' : 'video-file'} onDrop={drop}
          onDragOver={event => { event.preventDefault(); if (!disabled && !busy) setDragging(true); }}
          onDragLeave={() => setDragging(false)}>
          <Upload size={24} aria-hidden="true" />
          <strong>{file ? file.name : screenshot ? 'Pilih screenshot' : 'Pilih berkas video'}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MB · Klik untuk mengganti` : 'Klik untuk memilih atau seret berkas ke sini'}</span>
          <input className="sr-only" id={screenshot ? 'screenshot-image' : 'video-file'} type="file"
            aria-label={screenshot ? 'Unggah screenshot' : 'Unggah video dari perangkat'}
            accept={screenshot ? 'image/png,image/jpeg,image/webp' : 'video/mp4,video/webm'} disabled={disabled || busy}
            onChange={event => selectFile(event.target.files?.[0] ?? null)} />
        </label>
        {screenshot && preview && <img className="screenshot-preview" src={preview} alt="Pratinjau screenshot pilihan" />}
        <p>{screenshot ? 'PNG, JPEG, atau WebP · maksimal 3 MB.' : 'MP4 atau WebM · maksimal 4 MB.'}</p>
        <details className="media-privacy"><summary>Bagaimana berkas diproses?</summary><p>Konten dikirim ke penyedia AI untuk pembacaan dan tidak disimpan dalam riwayat. Hapus bagian pribadi sebelum mengunggah.</p></details>
      </>}
      <button type="button" className={`${prepared ? 'secondary-button' : 'primary-button'} media-read-button`}
        disabled={disabled || busy || !available} onClick={() => void prepare()}>
        {busy ? <LoaderCircle className="spin" size={20} /> : prepared ? <RotateCcw size={20} /> : <ScanText size={20} />}
        {busy ? screenshot ? 'Membaca screenshot…' : 'Membaca video…' : prepared ? 'Baca ulang' : screenshot ? 'Baca teks screenshot' : 'Baca isi video'}
      </button>
      <p className="media-next" role={busy ? 'status' : undefined}>{busy ? 'Pembacaan sedang berlangsung. Tunggu hasilnya di halaman ini.' : prepared ? needsText ? 'Pembacaan belum lengkap. Tempel teks klaim di bawah untuk melanjutkan.' : 'Hasil pembacaan tersedia di bawah. Periksa dan koreksi sebelum melanjutkan.' : 'Setelah dibaca, tinjau teksnya sebelum memeriksa klaim.'}</p>
    </div>}
    {error && <p className="integration-error" role="alert">{error}</p>}
  </div>;
}
