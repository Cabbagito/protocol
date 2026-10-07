import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const apiTarget = process.env.API_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new service worker takes over by itself (skipWaiting + clientsClaim),
      // so no installed version can get stuck on an old build. main.tsx
      // registers it and decides when the page reloads into the new code:
      // at startup, or when the app goes to the background — never mid-task.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Protocol',
        short_name: 'Protocol',
        description: 'Personal fitness tracking - gym and nutrition',
        // Default (dark) theme's page background, --deep
        theme_color: '#070d15',
        background_color: '#070d15',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The ~1 MB ZXing barcode wasm is not precached for everyone; it is
        // cached on first use of the scanner instead (runtimeCaching below).
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm',
              expiration: { maxEntries: 4 },
            },
          },
        ],
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
