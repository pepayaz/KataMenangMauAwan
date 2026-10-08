// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Workspace from '../components/workspace';
import CheckReport from '../components/check-report';
import EvidenceExplorer from '../components/evidence-explorer';
import TraceTimeline from '../components/trace-timeline';
import InvestigationPreview from '../components/investigation-preview';
import { storageKey } from '../lib/check-view';
import { checkFixtures } from '../../../packages/shared/fixtures';

const fixture = checkFixtures[0]!;
const prepared = { status: 'ready', source: 'paste', rawText: fixture.input.rawText, warnings: [], url: 'https://example.com/video' };
const network = vi.fn<typeof fetch>();
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return { get length() { return entries.size; }, clear: () => entries.clear(),
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); },
    removeItem: key => { entries.delete(key); }, key: index => [...entries.keys()][index] ?? null };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage()); vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  vi.stubGlobal('fetch', network);
  network.mockReset().mockImplementation(async (url, init) => {
    if (url === '/api/check' && !init?.method) return Response.json({ llmConfigured: true });
    if (url === '/api/input') return Response.json(prepared);
    if (url === '/api/check') return new Response(
      `event: result\ndata: ${JSON.stringify(fixture.result)}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'x-check-id': fixture.result.checkId } });
    throw new Error('Unexpected request');
  });
  vi.stubGlobal('URL', class extends URL {
    static override createObjectURL() { return 'blob:fixture'; }
    static override revokeObjectURL() {}
  });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function openLink() {
  render(createElement(Workspace, { fixtureDemo: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Link video' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Baca isi video' })).toBeDefined());
}
it('rapor terakhir membuka hasil tersimpan tanpa meminta pemeriksaan baru', async () => {
  const item = { id: fixture.result.checkId, text: fixture.input.rawText, createdAt: fixture.input.createdAt,
    demo: true, saved: false, result: fixture.result, traces: fixture.traces };
  localStorage.setItem(storageKey, JSON.stringify([item]));
  render(createElement(Workspace, { fixtureDemo: true }));
  fireEvent.click(await screen.findByRole('button', { name: /Rapor terakhir/ }));
  await screen.findByRole('heading', { name: 'Hasil pemeriksaan' });
  expect(screen.getByLabelText('Teks klaim saham').getAttribute('disabled')).toBeNull();
  expect(screen.queryByRole('button', { name: /Rapor terakhir/ })).toBeNull();
  expect(network.mock.calls.some(([url, init]) => url === '/api/check' && init?.method === 'POST')).toBe(false);
});
it('Tentang tidak meminta AI atau mengambil input share yang belum ditinjau', () => {
  sessionStorage.setItem('cek-dulu-share-input', JSON.stringify(prepared));
  render(createElement(Workspace, { fixtureDemo: true, initialPage: 'about' }));
  expect(screen.getAllByRole('link', { name: 'Tentang Cek Dulu' })).toHaveLength(1);
  expect(network).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('cek-dulu-share-input')).toBe(JSON.stringify(prepared));
});
it('navigasi memperbarui URL agar reload tidak kembali ke tampilan sebelumnya', () => {
  render(createElement(Workspace, { fixtureDemo: true, initialPage: 'saved' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cara kerja' }));
  expect(window.location.search).toBe('?view=guide');
  fireEvent.click(screen.getByRole('button', { name: 'Cek klaim' }));
  expect(window.location.pathname + window.location.search).toBe('/check');
});
describe('alur pembacaan media', () => {
  it('menampilkan tindakan baca dan menyembunyikan cek sampai teks dapat ditinjau', async () => {
    await openLink();
    expect(screen.queryByRole('textbox', { name: 'Teks klaim saham' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cek klaim ini' })).toBeNull();
    const read = screen.getByRole('button', { name: 'Baca isi video' }) as HTMLButtonElement;
    expect(read.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: prepared.url } });
    fireEvent.click(read);
    const editor = await screen.findByLabelText('Tinjau hasil pembacaan') as HTMLTextAreaElement;
    expect(editor.value).toBe(prepared.rawText);
    expect(document.activeElement).toBe(editor);
    fireEvent.change(editor, { target: { value: 'ADRO yield 25,5% setahun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cek klaim ini' }));
    await screen.findByRole('heading', { name: 'Hasil pemeriksaan' });
    await waitFor(() => expect(document.activeElement?.classList.contains('report-section')).toBe(true));
    const request = network.mock.calls.find(([url, init]) => url === '/api/check' && init?.method === 'POST')!;
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({ text: editor.value, url: prepared.url, demo: false });
    fireEvent.change(editor, { target: { value: 'Klaim baru untuk diperiksa' } });
    expect(screen.queryByRole('heading', { name: 'Hasil pemeriksaan' })).toBeNull();
  });
  it('mengunci pemilihan mode selama membaca dan menampilkan status tanpa progres palsu', async () => {
    let complete!: (response: Response) => void;
    network.mockImplementation(async (url) => url === '/api/input'
      ? new Promise<Response>(resolve => { complete = resolve; }) : Response.json({ llmConfigured: true }));
    await openLink();
    fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: prepared.url } });
    fireEvent.click(screen.getByRole('button', { name: 'Baca isi video' }));
    expect((screen.getByRole('button', { name: 'Teks' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Pembacaan sedang berlangsung. Tunggu hasilnya di halaman ini.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cek klaim ini' })).toBeNull();
    await act(async () => complete(Response.json(prepared)));
    fireEvent.click(screen.getByText('Ganti input atau baca ulang'));
    expect(screen.getByRole('button', { name: 'Baca ulang' })).toBeDefined();
  });
  it('mengganti link menghapus kesiapan transkripsi sebelumnya', async () => {
    await openLink();
    fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: prepared.url } });
    fireEvent.click(screen.getByRole('button', { name: 'Baca isi video' }));
    await screen.findByLabelText('Tinjau hasil pembacaan');
    fireEvent.click(screen.getByText('Ganti input atau baca ulang'));
    fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: 'https://example.com/other-video' } });
    expect(screen.queryByLabelText('Tinjau hasil pembacaan')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cek klaim ini' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Baca isi video' })).toBeDefined();
  });
  it('kegagalan pembacaan dapat dicoba ulang tanpa mengaktifkan cek', async () => {
    await openLink();
    network.mockResolvedValueOnce(Response.json({ error: 'Video tidak dapat diakses.' }, { status: 422 }));
    fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: prepared.url } });
    fireEvent.click(screen.getByRole('button', { name: 'Baca isi video' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Video tidak dapat diakses.');
    expect(screen.queryByRole('button', { name: 'Cek klaim ini' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Baca isi video' }));
    await screen.findByLabelText('Tinjau hasil pembacaan');
  });
  it('needs_text memberi editor manual dengan cek kosong tetap terkunci', async () => {
    await openLink();
    network.mockResolvedValueOnce(Response.json({ ...prepared, status: 'needs_text', rawText: '', warnings: ['Audio tidak terbaca. Tempel teks klaim.'] }));
    fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: prepared.url } });
    fireEvent.click(screen.getByRole('button', { name: 'Baca isi video' }));
    const editor = await screen.findByLabelText('Tinjau hasil pembacaan');
    expect(screen.getByText('Pembacaan belum lengkap. Tempel teks klaim di bawah untuk melanjutkan.')).toBeDefined();
    expect((screen.getByRole('button', { name: 'Cek klaim ini' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(editor, { target: { value: fixture.input.rawText } });
    expect((screen.getByRole('button', { name: 'Cek klaim ini' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('pilihan contoh mengembalikan mode teks sehingga tab dan editor konsisten', async () => {
    await openLink();
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan contoh ADRO' }));
    expect(screen.getByRole('button', { name: 'Teks' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Teks klaim saham') as HTMLTextAreaElement).value).toBe(fixture.input.rawText);
    expect(screen.queryByRole('button', { name: 'Baca isi video' })).toBeNull();
  });
  it('upload dan drag-drop memvalidasi tipe, ukuran serta hanya satu berkas', async () => {
    render(createElement(Workspace, { fixtureDemo: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Screenshot' }));
    const upload = screen.getByLabelText('Unggah screenshot');
    fireEvent.change(upload, { target: { files: [new File(['x'], 'bad.txt', { type: 'text/plain' })] } });
    expect(screen.getByRole('alert').textContent).toContain('maksimal 3 MB');
    expect((screen.getByRole('button', { name: 'Baca teks screenshot' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(upload, { target: { files: [new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })] } });
    expect(screen.getByRole('alert').textContent).toContain('maksimal 3 MB');
    const zone = upload.closest('label')!;
    const file = new File(['fixture'], 'fixture.png', { type: 'image/png' });
    fireEvent.drop(zone, { dataTransfer: { files: [file, file] } });
    expect(screen.getByRole('alert').textContent).toContain('satu berkas');
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(screen.getByText('fixture.png')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Baca teks screenshot' }));
    await screen.findByLabelText('Tinjau hasil pembacaan');
    const request = network.mock.calls.find(([url]) => url === '/api/input')!;
    expect((request[1]?.body as FormData).get('image')).toBe(file);
    fireEvent.click(screen.getByText('Ganti input atau baca ulang'));
    fireEvent.change(upload, { target: { files: [new File(['other'], 'other.png', { type: 'image/png' })] } });
    expect(screen.queryByLabelText('Tinjau hasil pembacaan')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cek klaim ini' })).toBeNull();
  });
  it('video yang terlalu besar ditolak sebelum permintaan pembacaan', async () => {
    render(createElement(Workspace, { fixtureDemo: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Unggah video' }));
    fireEvent.change(screen.getByLabelText('Unggah video dari perangkat'), { target: { files: [
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.mp4', { type: 'video/mp4' }),
    ] } });
    expect(screen.getByRole('alert').textContent).toContain('maksimal 4 MB');
    expect(network.mock.calls.some(([url]) => url === '/api/input')).toBe(false);
  });
});
it('catatan pembacaan tetap dapat dibuka dan semua peringatan dipertahankan', async () => {
  await openLink();
  const warnings = ['Audio dan frame dibaca. Periksa kembali angka.', 'Ada bagian video yang tidak jelas.'];
  network.mockResolvedValueOnce(Response.json({ ...prepared, warnings }));
  fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: prepared.url } });
  fireEvent.click(screen.getByRole('button', { name: 'Baca isi video' }));
  await screen.findByLabelText('Tinjau hasil pembacaan');
  expect(screen.getByText('Periksa saham dan angka')).toBeDefined();
  const notes = screen.getByText('Catatan pembacaan').closest('details')!;
  expect(notes.open).toBe(false); fireEvent.click(notes.querySelector('summary')!);
  expect(notes.open).toBe(true); warnings.forEach(warning => expect(screen.getByText(warning)).toBeDefined());
  expect((screen.getByLabelText('Tautan video publik').closest('details') as HTMLDetailsElement).open).toBe(false);
});
it('rapor ringkas mempertahankan penjelasan lengkap dan semua bukti dapat dicari', () => {
  const item = { id: fixture.result.checkId, text: fixture.input.rawText, createdAt: fixture.input.createdAt,
    demo: true, saved: false, result: fixture.result, traces: fixture.traces };
  render(createElement(CheckReport, { item }));
  const explanation = screen.getByText('Baca penjelasan lengkap').closest('details')!;
  expect(explanation.open).toBe(false); fireEvent.click(explanation.querySelector('summary')!);
  expect(explanation.open).toBe(true);
  expect([...explanation.querySelectorAll('.explanation-parts > li')].map(p => p.textContent).join(' ')).toBe(fixture.result.verdicts[0]!.explanation);
  expect(document.querySelector('.report-main > p, .claim-conclusion > p')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Lihat sumber/ }));
  expect(screen.getByRole('figure', { name: 'Perbandingan yield' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Semua sumber/ }));
  expect(document.querySelectorAll('.evidence-record')).toHaveLength(fixture.result.evidence.length);
  fireEvent.change(screen.getByLabelText('Cari sumber'), { target: { value: 'no-such-metric' } });
  expect(screen.getByText('Tidak ada sumber yang cocok. Coba kata lain.')).toBeDefined();
  fireEvent.change(screen.getByLabelText('Cari sumber'), { target: { value: '' } });
  const record = document.querySelector<HTMLDetailsElement>('.evidence-record')!;
  fireEvent.click(record.querySelector('summary')!); expect(record.open).toBe(true);
  expect(record.textContent).toContain('Nilai lengkap'); expect(record.textContent).toContain('Diambil');
});
it('grafik riwayat sumber memakai periode dan nilai evidence, termasuk angka negatif', () => {
  const observations = [2024, 2025].map((year, index) => ({ ...fixture.result.evidence[0]!,
    evidenceId: `synthetic-chart-${year}`, label: `PER sintetis ${year}`, value: index === 0 ? -2 : 6, unit: 'x',
    params: { synthetic: true, hunter: { metric: 'valuation.pe', symbol: 'ADRO', year } },
  }));
  render(createElement(EvidenceExplorer, { evidence: observations, verdict: fixture.result.verdicts[0]!, demo: true, onClose: vi.fn() }));
  const chart = screen.getByRole('figure', { name: 'Rasio harga terhadap laba (PER) ADRO' });
  expect(chart.textContent).toContain('2024'); expect(chart.textContent).toContain('-2×');
  expect(chart.textContent).toContain('2025'); expect(chart.textContent).toContain('6×');
  expect(chart.querySelector('.chart-column.is-negative')?.getAttribute('width')).toBe('125');
  expect(chart.querySelector('.chart-axis')?.getAttribute('x1')).toBe('125');
});
it('source charts appear without historical periods and observations are interactive', () => {
  const item = { id: fixture.result.checkId, text: fixture.input.rawText, createdAt: fixture.input.createdAt,
    demo: true, saved: false, result: fixture.result, traces: fixture.traces };
  render(createElement(CheckReport, { item }));
  fireEvent.click(screen.getByRole('button', { name: /Lihat sumber/ }));
  const drawer = screen.getByRole('dialog');
  const graph = screen.getByRole('figure', { name: 'Perbandingan yield' });
  expect(graph.querySelectorAll('rect')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: '12 bulan terakhir 5,56%' }));
  expect(graph.querySelector('[role=status]')?.textContent).toContain('Yield TTM');
  const record = screen.getByRole('region', { name: 'Bukti angka terpilih' });
  expect(record.textContent).toContain('Yield TTM');
  expect(record.textContent).toContain('5,56%');
  expect(record.textContent).toContain('Diambil');
  expect(record.textContent).toContain('Data contoh');
  expect(drawer.querySelector('.source-conclusion')?.textContent).toContain('Benar tapi menyesatkan');
  fireEvent.change(screen.getByLabelText('Pilih grafik'), { target: { value: 'claim-comparison' } });
  expect(screen.getByRole('figure', { name: 'Klaim vs data' })).toBeDefined();
  expect(screen.queryByRole('region', { name: 'Bukti angka terpilih' })).toBeNull();
});
it('lapisan contoh memakai fixture, tetap historis, dan hanya tombol gunakan yang meneruskan input', () => {
  const onExplore = vi.fn();
  render(createElement(InvestigationPreview, { onExplore }));
  expect(screen.getByText(`“${fixture.input.rawText}”`)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Data/ }));
  expect(screen.getByRole('figure', { name: 'Yield dividen' }).textContent).toContain('5,56%');
  fireEvent.click(screen.getByRole('button', { name: /Konteks/ }));
  expect(screen.getByText('45,2%')).toBeDefined();
  expect(screen.getByText('Rp1.358,18 per saham')).toBeDefined();
  expect(screen.getByText('23 Sep 2026 · data contoh')).toBeDefined();
  expect(onExplore).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Gunakan contoh ADRO' }));
  expect(onExplore).toHaveBeenCalledOnce();
});
it('bukti konteks langsung membuka evidence terkait dan menutup panel mengembalikan fokus', () => {
  const item = { id: fixture.result.checkId, text: fixture.input.rawText, createdAt: fixture.input.createdAt,
    demo: true, saved: false, result: fixture.result, traces: fixture.traces };
  render(createElement(CheckReport, { item }));
  const trigger = screen.getByRole('button', { name: 'Buka bukti Pembayaran khusus' });
  trigger.focus(); fireEvent.click(trigger);
  const record = screen.getByRole('region', { name: 'Bukti angka terpilih' });
  expect(record.textContent).toContain('pemisahan AADI');
  expect(record.textContent).toContain('Rp1.358,18');
  fireEvent.click(screen.getByRole('button', { name: 'Tutup sumber' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('hover grafik hanya menunjukkan nilai; klik membuka bukti asli beserta periode dan rumus', () => {
  render(createElement(EvidenceExplorer, { evidence: fixture.result.evidence,
    verdict: fixture.result.verdicts[0]!, claim: fixture.result.claims[0], demo: true, onClose: vi.fn() }));
  const observation = screen.getByRole('button', { name: 'Rata-rata hitung ulang 23,6%' });
  fireEvent.mouseEnter(observation);
  expect(screen.queryByRole('region', { name: 'Bukti angka terpilih' })).toBeNull();
  fireEvent.click(observation);
  const record = screen.getByRole('region', { name: 'Bukti angka terpilih' });
  expect(record.textContent).toContain('2021–2025');
  expect(record.textContent).toContain('Rumus');
  expect(record.textContent).toContain('Data contoh');
  expect(record.textContent).toContain('23,6%');
});
it('clicking a transcript number selects its exact span in the original text', async () => {
  await openLink();
  const text = '📊 ADRO yield 25,5% setahun dan pembayaran Rp1.358,18';
  network.mockResolvedValueOnce(Response.json({ ...prepared, rawText: text }));
  fireEvent.change(screen.getByLabelText('Tautan video publik'), { target: { value: prepared.url } });
  fireEvent.click(screen.getByRole('button', { name: 'Baca isi video' }));
  const editor = await screen.findByLabelText('Tinjau hasil pembacaan') as HTMLTextAreaElement;
  fireEvent.click(screen.getByRole('button', { name: 'Tinjau angka 25,5%' }));
  expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe('25,5%');
  expect(editor.value).toBe(text); expect(document.activeElement).toBe(editor);
});
it('sumber dan trace menampilkan data yang terbaca tanpa JSON atau blok kode', () => {
  const item = { id: fixture.result.checkId, text: fixture.input.rawText, createdAt: fixture.input.createdAt,
    demo: true, saved: false, result: fixture.result, traces: fixture.traces };
  render(createElement(CheckReport, { item }));
  const trigger = screen.getByRole('button', { name: /Lihat sumber/ });
  trigger.focus(); fireEvent.click(trigger);
  expect(screen.getByRole('heading', { name: 'Sumber pemeriksaan' })).toBeDefined();
  expect(document.querySelector('pre, code')).toBeNull();
  fireEvent(screen.getByRole('dialog'), new Event('cancel'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  cleanup();
  render(createElement(TraceTimeline, { events: [{ checkId: 'c', ts: fixture.input.createdAt,
    stage: 'verify', message: 'Data ditemukan', data: { privateTechnicalValue: 1 }, credits: 0 }] }));
  expect(screen.getByText('Data ditemukan')).toBeDefined();
  expect(screen.queryByText('privateTechnicalValue')).toBeNull();
  expect(document.querySelector('pre, code')).toBeNull();
});
