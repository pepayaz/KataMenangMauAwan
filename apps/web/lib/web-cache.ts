import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Next lokal berjalan di apps/web, CLI di root; keduanya memakai cache root yang sama. */
export function webCacheDirectory(cwd = process.cwd(), configured = process.env.SECTORS_CACHE_DIR): string {
  if (configured) return resolve(cwd, configured);
  const root = existsSync(resolve(cwd, 'pnpm-workspace.yaml')) ? cwd : resolve(cwd, '../..');
  return resolve(root, '.cache/sectors');
}
