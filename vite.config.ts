import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // 'script' menghasilkan registerSW.js sebagai berkas terpisah; mode inline melanggar CSP script-src 'self'.
      injectRegister: 'script',
      manifest: {
        name: 'Kas Angkatan',
        short_name: 'Kas',
        description: 'Buku kas angkatan yang bisa dilihat semua anggota.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f3fa',
        theme_color: '#f4f3fa',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Hanya aset statis hasil build. Respons API tidak pernah disimpan (D-19, CCH-10).
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
