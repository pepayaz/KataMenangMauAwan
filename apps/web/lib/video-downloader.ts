import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import youtubeDl from 'youtube-dl-exec';

export const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 45_000;
const SOCIAL_HOSTS = [
  'tiktok.com', 'youtube.com', 'youtu.be', 'instagram.com', 'facebook.com',
  'fb.watch', 'x.com', 'twitter.com', 'threads.net', 'reddit.com',
  'v.redd.it', 'vimeo.com', 'dailymotion.com', 'bilibili.com',
];

export class VideoDownloadError extends Error {
  constructor(readonly reason: 'URL' | 'UNAVAILABLE' | 'TOO_LARGE' | 'TIMEOUT' | 'FORMAT' | 'CONFIG') {
    super(reason);
    this.name = 'VideoDownloadError';
  }
}

/** Only public social hosts are passed to yt-dlp; no arbitrary user-supplied URL. */
export function publicVideoUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw.trim()); }
  catch { throw new VideoDownloadError('URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !SOCIAL_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new VideoDownloadError('URL');
  }
  url.hash = '';
  return url;
}

export function videoMime(bytes: Uint8Array): 'video/mp4' | 'video/webm' | null {
  if (bytes.length >= 12 && Buffer.from(bytes).toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  return null;
}

export type DownloadedVideo = { bytes: Buffer; mimeType: 'video/mp4' | 'video/webm' };

/** Bounded download of one public clip. Media and yt-dlp stderr never reach logs. */
export async function downloadPublicVideo(raw: string, signal?: AbortSignal): Promise<DownloadedVideo> {
  const url = publicVideoUrl(raw);
  const packaged = youtubeDl as unknown as { constants?: { YOUTUBE_DL_PATH?: string } };
  const filename = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const binary = [process.env.YT_DLP_PATH, packaged.constants?.YOUTUBE_DL_PATH,
    resolve(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', filename)]
    .find(candidate => candidate && existsSync(candidate));
  if (!binary) throw new VideoDownloadError('CONFIG');

  const args = [
    '--ignore-config', '--no-playlist', '--quiet', '--no-warnings', '--no-progress',
    '--socket-timeout', '10', '--retries', '1', '--fragment-retries', '1',
    '--max-filesize', '8M', '--match-filter', 'duration <= 180 & !is_live',
    '--format', 'b[ext=mp4]/b[ext=webm]/b', '--output', '-', '--', url.href,
  ];
  return new Promise<DownloadedVideo>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    const chunks: Buffer[] = [];
    let size = 0, failure: VideoDownloadError | null = null;
    const fail = (error: VideoDownloadError): void => { failure ??= error; child.kill(); };
    const timer = setTimeout(() => fail(new VideoDownloadError('TIMEOUT')), DOWNLOAD_TIMEOUT_MS);
    const onAbort = (): void => fail(new VideoDownloadError('UNAVAILABLE'));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_VIDEO_BYTES) { fail(new VideoDownloadError('TOO_LARGE')); return; }
      chunks.push(chunk);
    });
    child.on('error', () => { failure ??= new VideoDownloadError('CONFIG'); });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
      if (failure) { reject(failure); return; }
      if (code !== 0 || size === 0) { reject(new VideoDownloadError('UNAVAILABLE')); return; }
      const bytes = Buffer.concat(chunks);
      const mimeType = videoMime(bytes);
      if (!mimeType) { reject(new VideoDownloadError('FORMAT')); return; }
      resolve({ bytes, mimeType });
    });
  });
}
