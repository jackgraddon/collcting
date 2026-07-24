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
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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
        { rel: 'apple-touch-icon', sizes: '512x512', href: '/icon-512x512.png' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  image: { provider: 'vercel' },

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
          urlPattern: /^https:\/\/.*\/_vercel\/image\?url=.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'collct-images',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 30 * 24 * 60 * 60
            }
          }
        },
        {
          urlPattern: /^https:\/\/.*\.blob\.vercel-storage\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'collct-photos-raw',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 30 * 24 * 60 * 60
            },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: /^https:\/\/.*\/api\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'collct-api',
            networkTimeoutSeconds: 3,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 24 * 60 * 60
            }
          }
        },
        {
          urlPattern: /^https:\/\/.*\/api\/notifications/,
          handler: 'NetworkOnly'
        }
      ]
    }
  }
})
