import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Bentuk larik dipakai, bukan objek, supaya prefiks `@/` di apps/web
      // benar-benar diganti dan bukan dicocokkan persis.
      { find: /^@\//, replacement: `${r('./apps/web/')}/` },
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
