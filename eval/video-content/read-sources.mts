// Read the exact raw Sectors cache entries used by the video test. Never issue a live call.
import { readFile, writeFile } from 'node:fs/promises';
import { createSectorsClient, cacheKey } from '../../packages/sectors/src/index.js';
const inputPath = 'docs/measurements/video-content-audit-2026-10-08.json';
const report = JSON.parse(await readFile(inputPath, 'utf8'));
const { cache } = createSectorsClient({ config: { mode: 'cache_only', apiKey: '' } });
const entries = new Map<string, unknown>();
for (const test of report.cases) {
  for (const frame of test.check?.frames ?? []) {
    if (frame.event !== 'trace') continue;
    for (const call of frame.data?.data?.sourceCalls ?? []) {
      if (!['received', 'reused'].includes(call.status)) continue;
      const key = cacheKey(call.tool, call.params);
      if (entries.has(key)) continue;
      entries.set(key, await cache.get(key));
    }
  }
}
await writeFile('docs/measurements/video-content-sources-2026-10-08.json', JSON.stringify([...entries].map(([key, entry]) => ({ key, entry })), null, 2)+'\n');
console.log(JSON.stringify({ entries: entries.size, missing: [...entries.values()].filter(x => x == null).length, liveCalls: 0 }));
