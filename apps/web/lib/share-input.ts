import { randomUUID } from 'node:crypto';
import { LlmAdapter } from '@cek-dulu/agent';
import { InputAdaptationSchema, type InputAdaptation } from '@cek-dulu/shared';
import { imageDataUrl, inputForm, inputUrl, readScreenshot, readVideoContentLink, InputError } from './input-adapter';

export async function readSharedInput(request: Request, deps: { readVideo?: typeof readVideoContentLink } = {}): Promise<InputAdaptation> {
  const form = await inputForm(request), images = form.getAll('image').filter(item => item instanceof Blob && item.size > 0);
  if (images.length > 1) throw new InputError(400, 'Bagikan satu screenshot setiap kali.');
  if (images[0] instanceof Blob) {
    await imageDataUrl(images[0]);
    return InputAdaptationSchema.parse({ ...await readScreenshot(images[0], new LlmAdapter(), request.signal), source: 'share_target' });
  }
  // Title tidak digunakan: bisa berisi nama kreator, bukan klaim.
  const text = typeof form.get('text') === 'string' ? String(form.get('text')).trim() : '';
  const explicitUrl = typeof form.get('url') === 'string' ? String(form.get('url')).trim() : '';
  if (text.length > 5000) throw new InputError(400, 'Teks maksimal 5000 karakter.');
  if (text && !/^https:\/\/\S+$/.test(text)) return InputAdaptationSchema.parse({ status: 'ready', rawText: text, source: 'share_target',
    ...(explicitUrl ? { url: inputUrl(explicitUrl).href } : {}), warnings: ['Periksa teks berbagi sebelum memulai cek.'] });
  const rawUrl = explicitUrl || (/^https:\/\/\S+$/.test(text) ? text : '');
  if (rawUrl) return InputAdaptationSchema.parse({ ...await (deps.readVideo ?? readVideoContentLink)(inputUrl(rawUrl).href, {}, request.signal), source: 'share_target' });
  return InputAdaptationSchema.parse({ status: text ? 'ready' : 'needs_text', rawText: text, source: 'share_target',
    warnings: ['Periksa teks berbagi sebelum memulai cek.'] });
}
/** POST navigation handoff; sessionStorage is per-tab, cleared by the workspace. */
export function shareHandoff(input: InputAdaptation): Response {
  const nonce = randomUUID();
  const json = JSON.stringify(InputAdaptationSchema.parse(input)).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return new Response(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cek Dulu</title><body><p>Membuka teks untuk ditinjau…</p><p id="error"></p><a href="/">Kembali ke Cek Dulu</a><footer><p>Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi. Status klaim menilai kesesuaian klaim dengan data yang tersedia, bukan kelayakan membeli atau menjual saham. Data bersumber dari Sectors dan dapat tertinggal dari kondisi terkini. Lakukan riset sendiri sebelum mengambil keputusan.</p></footer><script nonce="${nonce}">try {sessionStorage.setItem('cek-dulu-share-input', JSON.stringify(${json})); location.replace('/');} catch {document.getElementById('error').textContent='Input belum dapat dibuka. Tempel teks atau unggah screenshot dari halaman utama.';}</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`, 'Referrer-Policy': 'no-referrer' } });
}
