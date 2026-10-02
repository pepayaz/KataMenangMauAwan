import { execFileSync } from 'node:child_process';

// Public commit identifier only; helps distinguish a stale server from a new build.
let sourceRevision = 'tidak tersedia';
try { sourceRevision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Source archives may not contain Git metadata. */ }

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_SOURCE_REVISION: sourceRevision },
  // Isolated UI previews can run alongside the team's development server.
  distDir: process.env.CHECK_UI_PREVIEW === '1' ? '.next-ui-preview' : '.next',
  // Paket workspace di-ekspor sebagai TypeScript mentah supaya tidak ada langkah
  // build antar-paket; Next yang mentranspilasinya.
  transpilePackages: ['@cek-dulu/agent', '@cek-dulu/shared', '@cek-dulu/sectors', '@cek-dulu/verifiers'],
  serverExternalPackages: ['youtube-dl-exec'],

  outputFileTracingIncludes: {
    '/api/check': ['../../packages/agent/prompts/*.md'],
    '/api/input': ['../../node_modules/.pnpm/youtube-dl-exec@*/node_modules/youtube-dl-exec/bin/*'],
    '/share': ['../../node_modules/.pnpm/youtube-dl-exec@*/node_modules/youtube-dl-exec/bin/*'],
  },

  experimental: {
    // Bab 3.7: satu cek bisa 15-40 detik. Route handler mengalirkan SSE selama itu.
    proxyTimeout: 120_000,
  },

  webpack(config) {
    // Impor relatif ditulis dengan akhiran `.js` sesuai aturan ESM TypeScript
    // (`moduleResolution: Bundler` menerimanya, begitu juga Node dan Vitest).
    // Webpack tidak tahu aturan itu, jadi pemetaannya dinyatakan di sini.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },

  turbopack: {
    resolveAlias: {},
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
};

export default nextConfig;
