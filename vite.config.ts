import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images-v1',
              expiration: {
                maxEntries: 240,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'El Triunfo ERP',
        short_name: 'TriunfoERP',
        description: 'Sistema ERP de alto rendimiento para Retail',
        lang: 'es-MX',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#0070b2',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  base:
    process.env.VITE_BASE_PATH ||
    (process.env.NODE_ENV === 'production' ? '/Punto-de-venta/' : '/'),
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
