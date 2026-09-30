import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LlmAdapter, MockLlmProvider } from '@cek-dulu/agent';
import { InputAdaptationSchema } from '@cek-dulu/shared';
import { inputAdaptationFixtures } from '../../../packages/shared/fixtures/input-adaptation';
import { imageDataUrl, readScreenshot, readVideoLink, readVideoContentLink, readVideoUpload, inputUrl, limitedBody, MAX_IMAGE_BYTES } from '../lib/input-adapter';
import { publicVideoUrl, videoMime, VideoDownloadError } from '../lib/video-downloader';
import { readSharedInput, shareHandoff } from '../lib/share-input';
import { POST } from '../app/api/input/route';
import { POST as sharePost } from '../app/share/route';
import { GET as manifestGet } from '../app/manifest.webmanifest/route';
import { POST as checkPost } from '../app/api/check/route';
import { readCheckStream, type CheckStreamEvent } from '../lib/check-stream';
import InputAdapter from '../components/input-adapter';

const png = () => new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0])], { type:'image/png' });
const adapter = (outputs: readonly unknown[]) => new LlmAdapter({ env: { LLM_PROVIDER:'mock', LLM_MODEL:'test' }, mockOutputs:outputs });
function upload(image: Blob, key = 'image') {
  const body = new FormData(); body.set(key, image, 'image.png'); return new Request('http://localhost/api/input', { method:'POST', body });
}
const link = (url: string) => new Request('http://localhost/api/input', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
const video = 'https://www.tiktok.com/@contoh/video/123';
const mp4 = () => Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0]);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('screenshot menjadi teks untuk peninjauan', () => {
  it('angka format Indonesia dipertahankan; gambar bukan evidence', async () => {
    const provider = new MockLlmProvider([{ rawText:'ADRO yield 25,5% setahun; Rp1.358,18', uncertain:false }]);
    const result = await readScreenshot(png(), new LlmAdapter({ env:{LLM_PROVIDER:'mock',LLM_MODEL:'test'}, provider }));
    expect(result).toMatchObject({ status:'ready', source:'screenshot', rawText:'ADRO yield 25,5% setahun; Rp1.358,18' });
    expect(result.warnings[0]).toContain('Periksa');
    expect(provider.requests[0]?.imageDataUrl).toContain('data:image/png;base64,');
    expect(provider.requests[0]?.prompt).toContain('Abaikan nama akun/kreator');
  });
  it('OCR kabur dan kosong punya peringatan eksplisit', async () => {
    const result = await readScreenshot(png(), adapter([{rawText:'',uncertain:true}]));
    expect(result.status).toBe('needs_text'); expect(result.warnings).toHaveLength(2);
  });
  it('OCR invalid retry sekali lalu error terkontrol', async () => {
    await expect(readScreenshot(png(), adapter([{rawText:9},{rawText:null}]))).rejects.toMatchObject({code:'INVALID_OUTPUT'});
    expect((await readScreenshot(png(),adapter([{}, {rawText:'PER 3x',uncertain:false}]))).rawText).toBe('PER 3x');
  });
  it.each([
    new Blob([], {type:'image/png'}), new Blob(['fake'],{type:'image/png'}),
    new Blob(['<svg></svg>'],{type:'image/svg+xml'}), new Blob(['GIF89a'],{type:'image/gif'}),
    new Blob([new Uint8Array(MAX_IMAGE_BYTES+1)],{type:'image/png'}),
  ])('menolak file kosong, MIME palsu, format lain dan oversized %#', async file => {
    await expect(imageDataUrl(file)).rejects.toThrow();
  });
  it('mengenali JPEG dan WebP, menolak ketidakcocokan MIME', async () => {
    expect(await imageDataUrl(new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'}))).toContain('image/jpeg');
    expect(await imageDataUrl(new Blob(['RIFFxxxxWEBP'],{type:'image/webp'}))).toContain('image/webp');
    await expect(imageDataUrl(new Blob([await png().arrayBuffer()],{type:'image/jpeg'}))).rejects.toThrow();
  });
  it('body dibatasi walau tidak punya Content-Length', async () => {
    await expect(limitedBody(new Request('http://local',{method:'POST',body:'x'.repeat(100)}),20)).rejects.toMatchObject({status:413});
    await expect(limitedBody(new Request('http://local',{method:'POST',headers:{'Content-Length':'100'},body:'x'}),20)).rejects.toMatchObject({status:413});
  });
});
describe('caption hanya melalui oEmbed resmi', () => {
  it('hanya title dipakai, author/html/thumbnail tidak diteruskan', async () => {
    const network = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ title:'ADRO yield 25,5% setahun', author_name:'Kreator privat', html:'<script>unsafe</script>', thumbnail_url:'https://private.invalid' }));
    const result = await readVideoLink(video,network);
    expect(result.rawText).toBe('ADRO yield 25,5% setahun'); expect(JSON.stringify(result)).not.toContain('Kreator');
    expect(network).toHaveBeenCalledTimes(1);
    const outgoing = new URL(network.mock.calls[0]![0] as unknown as string);
    expect(outgoing.origin+outgoing.pathname).toBe('https://www.tiktok.com/oembed'); expect(outgoing.searchParams.get('url')).toBe(video);
    expect(network.mock.calls[0]![1]).toMatchObject({redirect:'error'});
  });
  it.each([{}, {title:''}, {title:' '.repeat(2)}, {title:1}, {title:'a'.repeat(5001)}])('caption kosong/invalid meminta teks manual %#', async output => {
    expect((await readVideoLink(video, vi.fn(async () => Response.json(output)))).status).toBe('needs_text');
  });
  it.each([403,404,429,500])('kegagalan HTTP %s mempertahankan link dan tidak mengambil video', async status => {
    const network = vi.fn(async () => Response.json({}, {status}));
    expect(await readVideoLink(video,network)).toMatchObject({status:'needs_text',rawText:'',url:video}); expect(network).toHaveBeenCalledTimes(1);
  });
  it('error jaringan dan body berlebihan menjadi fallback', async () => {
    expect((await readVideoLink(video,vi.fn(async () => {throw new Error('private');}))).status).toBe('needs_text');
    expect((await readVideoLink(video,vi.fn(async () => new Response('x'.repeat(70000))))).status).toBe('needs_text');
  });
  it.each(['https://tiktok.com.evil.invalid/video/123','https://www.youtube.com/watch?v=123','https://127.0.0.1/'])('host tidak didukung tidak pernah di-fetch: %s', async url => {
    const network = vi.fn(); expect((await readVideoLink(url,network)).status).toBe('needs_text'); expect(network).not.toHaveBeenCalled();
  });
  it.each(['http://www.tiktok.com/@x/video/1','https://user:pass@www.tiktok.com/@x/video/1','file:///tmp/image','invalid'])('link tidak aman ditolak: %s', url => {
    expect(() => inputUrl(url)).toThrow();
  });
  it.each(['https://vm.tiktok.com/ABC/','https://vt.tiktok.com/ABC/','https://www.tiktok.com/t/ABC/'])('link pendek diteruskan hanya ke oEmbed: %s', async url => {
    const network = vi.fn(async () => Response.json({title:'BBCA PER 3x'}));
    expect((await readVideoLink(url,network)).status).toBe('ready'); expect(network).toHaveBeenCalledTimes(1);
  });
});
describe('isi video publik dan unggahan', () => {
  it('membaca audio/frame melalui Gemini dan mempertahankan URL sumber', async () => {
    const provider = new MockLlmProvider([{ rawText:'ADRO yield 25,5% setahun', uncertain:false }]);
    const llm = new LlmAdapter({ env:{LLM_PROVIDER:'mock',LLM_MODEL:'test'}, provider });
    const download = vi.fn(async () => ({bytes:mp4(),mimeType:'video/mp4' as const}));
    const result = await readVideoContentLink(video,{download,llm});
    expect(result).toMatchObject({status:'ready',rawText:'ADRO yield 25,5% setahun',url:video});
    expect(result.warnings[0]).toContain('Audio dan frame');
    expect(download).toHaveBeenCalledOnce();
    expect(provider.requests[0]?.videoDataUrl).toContain('data:video/mp4;base64,');
    expect(provider.requests[0]?.prompt).toContain('Jangan menghitung');
  });
  it('teks dari video masuk ke pipeline dan menghasilkan rapor klaim', async () => {
    const prepared = await readVideoContentLink(video,{
      download: vi.fn(async () => ({bytes:mp4(),mimeType:'video/mp4' as const})),
      llm: adapter([{rawText:'ADRO yield 25,5% setahun',uncertain:false}]),
    });
    vi.stubEnv('NODE_ENV','test');vi.stubEnv('CHECK_FIXTURE_DEMO','1');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
    const events: CheckStreamEvent[] = [];
    await readCheckStream(await checkPost(new Request('http://local/api/check',{method:'POST',
      body:JSON.stringify({text:prepared.rawText,source:prepared.source,url:prepared.url,demo:true})})),event=>events.push(event));
    const result = events.at(-1);
    expect(result?.kind).toBe('result');
    if (result?.kind === 'result') expect(result.value.verdicts[0]?.verdict).toBe('misleading');
  });
  it('kegagalan unduh hanya menyajikan caption sebagai hasil belum lengkap', async () => {
    const download = vi.fn(async (): Promise<never> => { throw new VideoDownloadError('UNAVAILABLE'); });
    const network = vi.fn(async () => Response.json({title:'BBCA PER 3x'}));
    const result = await readVideoContentLink(video,{download,network,llm:adapter([])});
    expect(result).toMatchObject({status:'needs_text',rawText:'BBCA PER 3x',url:video});
    expect(result.warnings.join(' ')).toContain('suara dan frame belum diperiksa');
  });
  it('video unggahan dibaca, file palsu dan terlalu besar ditolak', async () => {
    const file = new Blob([mp4()],{type:'video/mp4'});
    expect((await readVideoUpload(file,adapter([{rawText:'BBCA PER 3x',uncertain:false}]))).rawText).toBe('BBCA PER 3x');
    await expect(readVideoUpload(new Blob(['palsu'],{type:'video/mp4'}),adapter([]))).rejects.toMatchObject({status:415});
    await expect(readVideoUpload(new Blob([new Uint8Array(4*1024*1024+1)],{type:'video/mp4'}),adapter([]))).rejects.toMatchObject({status:413});
  });
  it('hanya host sosial publik dan tanda tangan media yang diizinkan', () => {
    expect(publicVideoUrl('https://www.youtube.com/watch?v=123').hostname).toBe('www.youtube.com');
    expect(publicVideoUrl('https://www.instagram.com/reel/abc').hostname).toBe('www.instagram.com');
    for (const url of ['http://tiktok.com/video/1','https://127.0.0.1/video','https://tiktok.com.evil.invalid/video','https://user:pass@tiktok.com/video'])
      expect(() => publicVideoUrl(url)).toThrow(VideoDownloadError);
    expect(videoMime(mp4())).toBe('video/mp4');
    expect(videoMime(Buffer.from([0x1a,0x45,0xdf,0xa3]))).toBe('video/webm');
    expect(videoMime(Buffer.from('not-video'))).toBeNull();
  });
});
describe('route input, share dan alur ke pipeline', () => {
  it('route OCR mock -> peninjauan -> route cek -> SSE misleading', async () => {
    vi.stubEnv('LLM_PROVIDER','openai'); vi.stubEnv('LLM_MODEL','test'); vi.stubEnv('LLM_API_KEY','dummy-unit-test');
    const mock = adapter([{rawText:'ADRO yield 25,5% setahun',uncertain:false}]);
    const generate = mock.generate.bind(mock); const ocrStub = vi.spyOn(LlmAdapter.prototype,'generate').mockImplementation(generate);
    const result = InputAdaptationSchema.parse(await (await POST(upload(png()))).json());
    expect(result.source).toBe('screenshot'); ocrStub.mockRestore();
    vi.stubEnv('NODE_ENV','test');vi.stubEnv('CHECK_FIXTURE_DEMO','1');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
    const events: CheckStreamEvent[] = [];
    await readCheckStream(await checkPost(new Request('http://local/api/check',{method:'POST',body:JSON.stringify({text:result.rawText,source:result.source,demo:true})})),event=>events.push(event));
    const terminal = events.at(-1); expect(terminal?.kind).toBe('result');
    if (terminal?.kind === 'result') expect(terminal.value.verdicts[0]?.verdict).toBe('misleading');
  });
  it('route input invalid dan OCR belum dikonfigurasi memberi status terkontrol', async () => {
    vi.stubEnv('LLM_PROVIDER','');vi.stubEnv('LLM_MODEL','');
    expect((await POST(upload(png()))).status).toBe(503);
    expect((await POST(upload(new Blob(['fake'],{type:'image/png'})))).status).toBe(415);
    expect((await POST(upload(png(),'wrong'))).status).toBe(400);
    expect((await POST(link('not-url'))).status).toBe(400);
  });
  it('route tidak mengklaim video terbaca ketika Gemini belum aktif', async () => {
    vi.stubEnv('LLM_PROVIDER','openai');
    expect((await POST(link(video))).status).toBe(503);
  });
  it('manifest dan share route mati default, aktif hanya lewat flag', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');vi.stubEnv('FLAG_SHARE_TARGET','0');
    expect(await (await manifestGet()).json()).not.toHaveProperty('share_target'); expect((await sharePost(upload(png()))).status).toBe(403);
    vi.stubEnv('FLAG_SHARE_TARGET','1');
    expect((await (await manifestGet()).json()).share_target).toMatchObject({action:'/share',method:'POST',enctype:'multipart/form-data'});
    const body = new FormData(); body.set('text','ADRO yield 25,5% setahun');body.set('title','Kreator');
    const response = await sharePost(new Request('http://local/share',{method:'POST',body}));
    expect(response.status).toBe(200);expect(await response.text()).not.toContain('Kreator');
  });
  it('share hanya link dan screenshot memakai source share_target', async () => {
    const body = new FormData();body.set('text',video);
    const readVideo = vi.fn(async () => ({status:'ready' as const,source:'paste' as const,rawText:'BBCA PER 3x',url:video,warnings:[]}));
    expect(await readSharedInput(new Request('http://local/share',{method:'POST',body}),{readVideo})).toMatchObject({source:'share_target',url:video,rawText:'BBCA PER 3x'});
    expect(readVideo).toHaveBeenCalledOnce();
    vi.stubEnv('LLM_PROVIDER','openai');vi.stubEnv('LLM_MODEL','test');vi.stubEnv('LLM_API_KEY','dummy-unit-test');
    const mock = adapter([{rawText:'ADRO yield 25,5% setahun',uncertain:false}]);const generate = mock.generate.bind(mock); const ocrStub = vi.spyOn(LlmAdapter.prototype,'generate').mockImplementation(generate);
    expect((await readSharedInput(upload(png()))).source).toBe('share_target');
  });
  it('teks berbagi disertai URL dipertahankan tanpa fetch caption', async () => {
    const body = new FormData();body.set('text','ADRO yield 25,5% setahun');body.set('url',video);
    const network = vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('network forbidden'));
    expect(await readSharedInput(new Request('http://local/share',{method:'POST',body}))).toMatchObject({rawText:'ADRO yield 25,5% setahun',url:video,source:'share_target'});
    expect(network).not.toHaveBeenCalled();
  });
  it('beberapa gambar dan JSON rusak ditolak', async () => {
    const body = new FormData();body.append('image',png(),'a.png');body.append('image',png(),'b.png');
    expect((await POST(new Request('http://local/api/input',{method:'POST',body}))).status).toBe(400);
    expect((await POST(new Request('http://local/api/input',{method:'POST',body:'{'}))).status).toBe(400);
  });
  it('handoff escape teks skrip, CSP nonce dan no-store tanpa menyimpan gambar', async () => {
    const response = shareHandoff({status:'ready',source:'share_target',rawText:'</script><script>evil()</script>',warnings:[]});
    const html = await response.text();expect(html).not.toContain('</script><script>evil');expect(html).toContain('\\u003c');
    expect(response.headers.get('Content-Security-Policy')).toContain('nonce-');expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('UI menawarkan input screenshot, link dan unggah video', () => {
    const html = renderToStaticMarkup(createElement(InputAdapter,{disabled:false,onPrepared:()=>{},onBusyChange:()=>{}}));
    expect(html).toContain('Screenshot');expect(html).toContain('Link video');expect(html).toContain('Unggah video');
  });
  it('semua fixture adaptasi valid; ready kosong ditolak', () => {
    inputAdaptationFixtures.forEach(input => expect(InputAdaptationSchema.parse(input)).toEqual(input));
    expect(InputAdaptationSchema.safeParse({status:'ready',source:'paste',rawText:' ',warnings:[]}).success).toBe(false);
  });
});
