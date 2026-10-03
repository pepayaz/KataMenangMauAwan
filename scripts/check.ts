import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createSectorsClient } from '@cek-dulu/sectors';
import { LlmAdapter, runCheck } from '@cek-dulu/agent';
import type { TraceEvent } from '@cek-dulu/shared';
import { fixtureCheckDeps } from './check-fixture.js';

export async function checkMain(args: readonly string[]): Promise<number> {
  const isFixture = args[0] === '--fixture';
  const text = (isFixture ? args.slice(1) : args).join(' ').trim();
  if (!text) { process.stderr.write('Pemakaian: pnpm check "<teks>"; demo: pnpm check --fixture "<teks fixture>"\n'); return 1; }
  try {
    const demo = isFixture ? fixtureCheckDeps(text) : undefined;
    // Cache yang sama dengan web: Supabase bila dikonfigurasi, selain itu berkas. Selalu cache_only.
    const deps = demo?.deps ?? { client: createSectorsClient({ config: { mode: 'cache_only', apiKey: '' } }).client, llm: new LlmAdapter() };
    const traces: TraceEvent[] = [];
    const result = await runCheck({ checkId: randomUUID(), source: 'paste', rawText: text, createdAt: new Date().toISOString() }, deps,
      (event) => { traces.push(event); });
    process.stdout.write(`${JSON.stringify(result.verdicts, null, 2)}\n`);
    if (demo) process.stderr.write(`DEMO FIXTURE: ${demo.fixture.provenance}\n`);
    process.stderr.write('Trace (Sectors cache_only):\n');
    for (const event of traces) process.stderr.write(`${event.stage}: ${event.message} [kredit ${event.credits ?? 0}]\n`);
    process.stderr.write(`Total kredit: ${result.creditsUsed}\n`);
    process.stderr.write('Cek Dulu adalah alat informasi dan analisis, bukan nasihat investasi.\n');
    for (const event of traces) {
      const data = event.data as { pendingTools?: unknown[]; choices?: unknown[] } | undefined;
      if (data?.pendingTools?.length) process.stderr.write(`Data diperlukan (tanpa panggilan live): ${JSON.stringify(data.pendingTools)}\n`);
      if (data?.choices?.length) process.stderr.write(`Pilihan saham diperlukan: ${JSON.stringify(data.choices)}\n`);
    }
    return traces.some((e) => e.stage === 'error') && result.claims.length === 0 ? 1 : 0;
  } catch { process.stderr.write('Pemeriksaan gagal secara terkontrol. Periksa konfigurasi LLM dan input; Sectors tetap cache_only.\n'); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Node 20.11 mendukung --env-file; argumen array menghindari interpretasi shell.
  const envFile = ['.env.local', '.env'].find((file) => existsSync(file));
  if (envFile && process.env.CEK_DULU_ENV_LOADED !== '1') {
    const child = spawnSync(process.execPath, [`--env-file=${envFile}`, '--import', 'tsx', process.argv[1], ...process.argv.slice(2)],
      { stdio: 'inherit', env: { ...process.env, CEK_DULU_ENV_LOADED: '1' }, windowsHide: true });
    process.exitCode = child.status ?? 1;
  } else checkMain(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
