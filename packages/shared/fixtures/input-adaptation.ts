import { InputAdaptationSchema } from '../src/schemas.js';
export const inputAdaptationFixtures = [
  { status: 'ready', rawText: 'ADRO yield 25,5% setahun', source: 'screenshot', warnings: ['Periksa teks hasil OCR.'] },
  { status: 'ready', rawText: 'BBCA PER cuma 3x', source: 'paste', url: 'https://www.tiktok.com/@contoh/video/123', warnings: ['Hanya caption.'] },
  { status: 'needs_text', rawText: '', source: 'share_target', warnings: ['Tempel teks atau unggah screenshot.'] },
].map(input => InputAdaptationSchema.parse(input));
