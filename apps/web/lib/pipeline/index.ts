import type { AliasEntry } from '@cek-dulu/shared';
import { BaselinePipeline } from './baseline.js';
import type { Pipeline } from './types.js';

export * from './types.js';
export { BaselinePipeline, normalize } from './baseline.js';
export { adjudicate, deriveMissingContext } from './adjudicate.js';
export { extractClaims } from './extract.js';

/**
 * Titik tukar antara B dan A (bab 10, baris "Pipeline agen lengkap").
 *
 * Ketika paket agen A siap, satu-satunya yang berubah di seluruh backend adalah
 * isi fungsi ini:
 *
 *   import { AgentPipeline } from '@cek-dulu/agent';
 *   return new AgentPipeline({ aliases });
 *
 * Route handler, streaming SSE, persistensi, dan buku kredit tidak perlu
 * disentuh karena semuanya hanya bicara lewat antarmuka `Pipeline`.
 */
export function createPipeline(opts: { aliases?: AliasEntry[] } = {}): Pipeline {
  return new BaselinePipeline(opts.aliases);
}
