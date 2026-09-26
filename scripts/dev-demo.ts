import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../apps/web/', import.meta.url));
const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next', { paths: [cwd] });
console.error('Demo fixture eksplisit: pipeline backend aktif, mock offline, Sectors cache_only, tanpa API live.');
const child = spawn(process.execPath, [next, 'dev'], { cwd, stdio: 'inherit',
  env: { ...process.env, CHECK_FIXTURE_DEMO: '1', SECTORS_MODE: 'cache_only' } });
child.on('error', () => { console.error('Server demo tidak dapat dimulai.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
process.on('SIGINT', () => { child.kill('SIGINT'); });
