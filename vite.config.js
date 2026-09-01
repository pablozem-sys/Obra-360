import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const brandName = env.VITE_BRAND_NAME || 'VAION'
  const supabaseHost = env.VITE_SUPABASE_URL
    ? new URL(env.VITE_SUPABASE_URL).host
    : 'ffxexpasoneowquvtouz.supabase.co'
  // Identificador de build para app_errors.app_version — no existía ninguno
  // antes de esto. Versión de package.json + timestamp del build (no
  // depende de git estar disponible en el entorno de build de Vercel).
  const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version
  const appVersion = `${pkgVersion}+${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`

  return {
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // registro manual en main.jsx (virtual:pwa-register) — necesario para recargar la app al detectar una versión nueva
      includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: `${brandName} — Control de Obras`,
        short_name: brandName,
        description: 'Gestión de obras de construcción',
        theme_color: '#060709',
        background_color: '#060709',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: new RegExp(`^https://${supabaseHost.replace(/\./g, '\\.')}/.*`, 'i'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  }
})
