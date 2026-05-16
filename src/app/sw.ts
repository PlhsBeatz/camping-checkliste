import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

/**
 * Eigene Runtime-Caching-Regeln, die VOR den Serwist-Defaults greifen.
 *
 * - `/icons/*` (dynamisch generierte PWA-Icons): Stale-While-Revalidate, lange Lebensdauer.
 *   Ohne diese Regel würde defaultCache sie via NetworkFirst behandeln, weil sie keine
 *   Bild-Extension haben.
 * - HTML-Dokumente: NetworkFirst mit eigener Cache-Bezeichnung; Antwort wird sowohl unter
 *   Original-URL als auch unter `?_rsc`-Variante abgelegt, damit RSC-/HTML-Navigationen
 *   denselben Cache nutzen.
 * - `/manifest.json`: SWR, damit die PWA-Manifest-Daten offline sofort verfügbar sind.
 */
const customRuntimeCaching: RuntimeCaching[] = [
  /** Mutationen unter /api/ nie aus dem SW-Daten-Cache bedienen (vermeidet falsche/HTML-Fallbacks). */
  {
    matcher: ({ url, request }) =>
      url.pathname.startsWith('/api/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url }) => url.pathname.startsWith('/icons/'),
    handler: new StaleWhileRevalidate({
      cacheName: 'pwa-icons',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 Jahr
        }),
      ],
    }),
  },
  {
    matcher: ({ url, request }) =>
      request.destination === 'document' || url.pathname === '/manifest.json',
    handler: new NetworkFirst({
      cacheName: 'app-html',
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        }),
      ],
    }),
  },
  {
    // RSC-Antworten (Next.js App Router): durch denselben Cache-Namen wie HTML
    // sind beide Pfade nach erstem Online-Besuch offline-fähig.
    matcher: ({ url }) =>
      url.searchParams.has('_rsc') || url.pathname.endsWith('.rsc'),
    handler: new StaleWhileRevalidate({
      cacheName: 'app-rsc',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        }),
      ],
    }),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...customRuntimeCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (event.data?.type === 'PROCESS_SYNC_QUEUE') {
    // Wenn der Client Hilfe bei der Outbox-Verarbeitung will, geben wir Bescheid.
    // (Die eigentliche Verarbeitung läuft im UI-Thread, weil dort die Cookies eingelogged sind.)
    void Promise.resolve().then(() => {
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const c of clients) {
            c.postMessage({ type: 'PROCESS_SYNC_QUEUE' })
          }
        })
    })
  }
})

// Background-Sync-Auslöser: Wenn der Browser Background Sync unterstützt und ein
// 'process-sync-queue'-Tag registriert wurde, bitten wir alle offenen Clients,
// ihre Outbox abzuarbeiten.
self.addEventListener('sync', (event: ExtendableEvent & { tag?: string }) => {
  if (event.tag !== 'process-sync-queue') return
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clients) => {
        for (const c of clients) {
          c.postMessage({ type: 'PROCESS_SYNC_QUEUE' })
        }
      })
  )
})
