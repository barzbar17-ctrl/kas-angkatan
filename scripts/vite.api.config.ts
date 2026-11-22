import { defineConfig } from 'vite';

// Membundel skrip server (dev-api, e2e-seed) menjadi ESM Node. Dependensi tetap diimpor dari node_modules.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: true,
    outDir: '.dev-api',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: {
      input: {
        'dev-api': 'scripts/dev-api.ts',
        'e2e-seed': 'scripts/e2e-seed.ts',
        'create-ketua': 'scripts/create-ketua.ts',
      },
    },
  },
});
