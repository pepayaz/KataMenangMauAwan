import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      // `frontend/` masih memiliki instalasi Vite mandiri. Paksa satu salinan
      // React saat komponen desainnya diuji sebagai bagian aplikasi Next.
      { find: /^react$/, replacement: r('./apps/web/node_modules/react/index.js') },
      { find: /^react-dom$/, replacement: r('./apps/web/node_modules/react-dom/index.js') },
      // Bentuk larik dipakai, bukan objek, supaya prefiks `@/` di apps/web
      // benar-benar diganti dan bukan dicocokkan persis.
      { find: /^@\//, replacement: `${r('./apps/web/')}/` },
      { find: '@cek-dulu/shared/schemas', replacement: r('./packages/shared/src/schemas.ts') },
      { find: '@cek-dulu/shared', replacement: r('./packages/shared/src/index.ts') },
      { find: '@cek-dulu/agent', replacement: r('./packages/agent/src/index.ts') },
      { find: '@cek-dulu/sectors', replacement: r('./packages/sectors/src/index.ts') },
      { find: '@cek-dulu/verifiers', replacement: r('./packages/verifiers/src/index.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['packages/**/test/**/*.test.ts', 'apps/web/test/**/*.test.ts'],
    // Uji tidak boleh menyentuh jaringan; mode cache_only adalah bawaannya
    // (bab 8.1 B, definisi selesai).
    env: {
      SECTORS_MODE: 'cache_only',
      SECTORS_API_KEY: '',
    },
  },
});
