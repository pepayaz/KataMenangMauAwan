import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AliasEntry } from '@cek-dulu/shared';
import { LlmAdapter, createFixtureTickerDirectory, runCheck, type PipelineDeps } from '@cek-dulu/agent';
import type { Pipeline } from './types.js';

export * from './types.js';
export { BaselinePipeline, normalize } from './baseline.js';
export { adjudicate, deriveMissingContext } from './adjudicate.js';
export { extractClaims } from './extract.js';

/** Adapter A ke antarmuka B; nama event SSE dan bentuk CheckResult tetap sama. */
export function createPipeline(opts: { aliases?: AliasEntry[]; deps?: PipelineDeps } = {}): Pipeline {
  return {
    name: 'agent',
    async run(input, ctx) {
      const deps: PipelineDeps = opts.deps ?? {
        client: ctx.client,
        llm: new LlmAdapter(),
        directory: createFixtureTickerDirectory({
          // Alias resmi B juga memperluas daftar ticker seed; tanpa panggilan live.
          tickers: [...new Set([...createFixtureTickerDirectory().tickers, ...(opts.aliases ?? []).map(a => a.ticker)])],
          aliases: opts.aliases,
        }),
      };
      const prompts = await loadWebPrompts();
      return runCheck(input, { ...deps, prompts, flags: ctx.flags }, event => ctx.emit(event));
    },
  };
}

/** Next menulis URL asset markdown; fs membutuhkan lokasi sumber yang ikut file tracing. */
export async function loadWebPrompts(cwd = process.cwd()): Promise<{ extractor: string; explainer: string }> {
  for (const root of [cwd, resolve(cwd, '../..')]) {
    try {
      const [extractor, explainer] = await Promise.all(['extractor', 'explainer'].map(name =>
        readFile(resolve(root, 'packages/agent/prompts', `${name}.md`), 'utf8')));
      return { extractor: extractor!, explainer: explainer! };
    } catch { /* Cwd Next lokal adalah apps/web; deployment standalone memakai root. */ }
  }
  throw new Error('Prompt agen tidak tersedia.');
}
