// https://nuxt.com/docs/api/configuration/nuxt-config
const instanceName = 'Collct'
const instanceDescription = 'A friends-first photo sharing app. No algorithm. No tracking. No strangers.'

export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/icon',
    '@nuxt/ui'
  ],
  ssr: false,

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: instanceName },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'theme-color', content: '#fba903' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'apple-touch-icon', sizes: '512x512', href: '/icon-512x512.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/splash-750x1334.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)', href: '/splash/splash-1334x750.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/splash-1179x2556.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)', href: '/splash/splash-2556x1179.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)', href: '/splash/splash-1290x2796.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)', href: '/splash/splash-2796x1290.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/splash-1536x2048.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)', href: '/splash/splash-2048x1536.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/splash-1640x2360.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)', href: '/splash/splash-2360x1640.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/splash-1668x2388.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)', href: '/splash/splash-2388x1668.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)', href: '/splash/splash-2048x2732.png' },
        { rel: 'apple-touch-startup-image', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)', href: '/splash/splash-2732x2048.png' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      isBeta: process.env.IS_BETA === 'true'
    }
  },
  compatibilityDate: '2026-06-30',

  vite: {
    server: {
      proxy: {
        '/api/blob': {
          target: 'https://localhost:3000',
          secure: false,
          changeOrigin: true
        }
      }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  image: {
    // No optimizer: the API serves original bytes with immutable caching and
    // explicitly asks clients to render blob URLs directly. This also keeps
    // images working on self-hosted clients and Capacitor builds, where
    // `/_vercel/image` does not exist.
    provider: 'none',
    screens: {
      'xs': 320,
      'sm': 640,
      'md': 768,
      'lg': 1024,
      'xl': 1280,
      '2xl': 1536
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    client: {
      installPrompt: true
    },
    manifest: {
      id: '/',
      name: instanceName,
      short_name: instanceName,
      description: instanceDescription,
      theme_color: '#fba903',
      background_color: '#fba903',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait-primary',
      start_url: '/',
      scope: '/',
      lang: 'en',
      dir: 'ltr',
      categories: ['social', 'photo'],
      icons: [
        {
          src: '/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/icon-192x192-maskable.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable'
        },
        {
          src: '/icon-512x512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ],
      shortcuts: [
        {
          name: 'Upload Photo',
          short_name: 'Upload',
          description: 'Upload a new photo',
          url: '/?upload=true',
          icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
        },
        {
          name: 'Groups',
          short_name: 'Groups',
          description: 'View your groups',
          url: '/groups',
          icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
        }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      importScripts: ['/push-handler.js'],
      runtimeCaching: [
        {
          // Server blob URLs are immutable (max-age=1y) — cache permanently.
          urlPattern: /^https?:\/\/.*\/api\/blob\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'collct-media',
            expiration: {
              maxEntries: 150,
              maxAgeSeconds: 365 * 24 * 60 * 60,
              purgeOnQuotaError: true
            },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          // Must precede the generic /api/ rule: Workbox matches first-win.
          urlPattern: /^https?:\/\/.*\/api\/notifications/,
          handler: 'NetworkOnly'
        },
        {
          // Heavy photo reads render instantly from cache and revalidate in
          // the background — repeat visits feel fast even on slow networks.
          // Mutations are never GETs, so no stale-write risk.
          urlPattern: /^https?:\/\/.*\/api\/(photos([/?]|$)|users\/[^/]+\/photos)/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'collct-feed',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 24 * 60 * 60,
              purgeOnQuotaError: true
            }
          }
        },
        {
          urlPattern: /^https?:\/\/.*\/api\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'collct-api',
            networkTimeoutSeconds: 3,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 24 * 60 * 60,
              purgeOnQuotaError: true
            }
          }
        }
      ]
    }
  }
})
