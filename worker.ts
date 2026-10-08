/**
 * Custom Worker: Bindet PackingSyncDO (Durable Object) ein und leitet
 * WebSocket-Anfragen an /api/packing-sync/ws an die DO weiter.
 * Alle anderen Anfragen gehen an die Next.js-App (OpenNext).
 */

import { default as handler } from './.open-next/worker.js'
import { PackingSyncDO } from './src/durable-objects/PackingSyncDO'
import { ingestBookingEmail } from './src/lib/booking-email-ingest'

export { PackingSyncDO }

const PACKING_SYNC_WS_PATH = '/api/packing-sync/ws'
const EQUIPMENT_ITEMS_PATH = '/api/equipment-items'
const EQUIPMENT_BY_TAGS_PATH = '/api/equipment-by-tags'
const PITCH_ORIENTATION_PATH = '/api/pitch-orientation'
const MAP_TILES_PREFIX = '/api/map-tiles/'
/** Cache-TTL in Sekunden – reduziert Worker-Aufrufe bei Equipment-Abfragen (500+ Einträge) */
const EQUIPMENT_CACHE_TTL = 300

/** Prüft, ob GET Equipment-API (listenförmig) gecacht werden soll */
function isCachedEquipmentRequest(request: Request, url: URL): boolean {
  if (request.method !== 'GET') return false
  const path = url.pathname
  return (
    (path === EQUIPMENT_ITEMS_PATH && !url.searchParams.has('id')) ||
    path === EQUIPMENT_BY_TAGS_PATH
  )
}

/** Cache-Key ohne Cookie/Auth – Daten sind haushaltsweit, nicht nutzerspezifisch */
function equipmentCacheKey(url: URL): Request {
  return new Request(url.toString(), { method: 'GET' })
}

/** Früher Edge-Cache für Sonnenausrichtung – spart OpenNext-CPU (Error 1102). */
function pitchOrientationCacheKey(url: URL): Request | null {
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const rLat = lat.toFixed(4)
  const rLng = lng.toFixed(4)
  return new Request(
    `https://camping-checkliste.pitch-cache/${rLat}/${rLng}`,
    { method: 'GET' }
  )
}

function mapTileCacheKey(url: URL): Request | null {
  // /api/map-tiles/:source/:z/:x/:y
  const parts = url.pathname.split('/')
  // ['', 'api', 'map-tiles', source, z, x, y]
  if (parts.length < 7) return null
  const source = parts[3]
  const z = parts[4]
  const x = parts[5]
  const y = parts[6]
  if (source !== 'satellite' && source !== 'osm') return null
  if (!z || !x || !y) return null
  return new Request(
    `https://camping-checkliste.tile-cache/${source}/${z}/${x}/${y}`,
    { method: 'GET' }
  )
}

interface WorkerEnv {
  PACKING_SYNC_DO: DurableObjectNamespace
  DB?: D1Database
  CAMPING_PHOTOS?: R2Bucket
  ASSETS?: Fetcher
  INTEGRATION_CRON_SECRET?: string
}

const CRON_DAILY_PATH = '/api/integrations/cron/daily'

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket-Upgrade für Packlisten-Sync: an DO weiterleiten
    if (url.pathname === PACKING_SYNC_WS_PATH) {
      const vacationId = url.searchParams.get('vacationId')
      if (!vacationId) {
        return new Response('vacationId required', { status: 400 })
      }
      const stub = env.PACKING_SYNC_DO.get(
        env.PACKING_SYNC_DO.idFromName(vacationId)
      )
      return stub.fetch(request)
    }

    // Cloudflare-spezifisch: caches.default (nicht im Standard CacheStorage-Typ)
    const cache = (caches as unknown as { default: Cache }).default

    // Sonnenausrichtung: Cache-HIT vor OpenNext (sonst oft Error 1102 durch Framework-CPU)
    if (request.method === 'GET' && url.pathname === PITCH_ORIENTATION_PATH) {
      const pitchKey = pitchOrientationCacheKey(url)
      if (pitchKey) {
        const cached = await cache.match(pitchKey)
        if (cached) {
          const headers = new Headers(cached.headers)
          headers.set('X-Pitch-Cache', 'HIT')
          return new Response(cached.body, { status: cached.status, headers })
        }
      }
    }

    // Kachel-Proxy: Cache-HIT vor OpenNext
    if (request.method === 'GET' && url.pathname.startsWith(MAP_TILES_PREFIX)) {
      const tileKey = mapTileCacheKey(url)
      if (tileKey) {
        const cached = await cache.match(tileKey)
        if (cached) {
          const headers = new Headers(cached.headers)
          headers.set('X-Tile-Cache', 'HIT')
          return new Response(cached.body, { status: cached.status, headers })
        }
      }
    }

    // Equipment-API cachen (reduziert Worker-Ressourcen, Error 1102)
    if (isCachedEquipmentRequest(request, url)) {
      const cacheKey = equipmentCacheKey(url)
      const cached = await cache.match(cacheKey)
      if (cached) {
        return cached
      }
      const response = await handler.fetch(request, env, ctx)
      if (response.ok) {
        const clone = response.clone()
        const headers = new Headers(clone.headers)
        headers.set(
          'Cache-Control',
          `public, max-age=${EQUIPMENT_CACHE_TTL}, s-maxage=${EQUIPMENT_CACHE_TTL}, stale-while-revalidate=600`
        )
        // Kein Vary: Cookie – sonst zerfällt der Edge-Cache pro Session
        headers.delete('Vary')
        const responseToCache = new Response(clone.body, {
          status: clone.status,
          statusText: clone.statusText,
          headers,
        })
        ctx.waitUntil(cache.put(cacheKey, responseToCache))
      }
      return response
    }

    return handler.fetch(request, env, ctx)
  },

  async email(
    message: ForwardableEmailMessage,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    if (!env.DB) {
      console.error('DB binding missing — cannot ingest booking email')
      return
    }
    ctx.waitUntil(
      ingestBookingEmail(message, env).catch((err) => {
        console.error('Booking email ingest failed:', err)
      })
    )
  },

  async scheduled(
    event: ScheduledEvent,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    const secret = env.INTEGRATION_CRON_SECRET?.trim()
    if (!secret) {
      console.warn('INTEGRATION_CRON_SECRET not set — skipping integration cron')
      return
    }
    const url = new URL(CRON_DAILY_PATH, 'https://cron.internal')
    ctx.waitUntil(
      handler.fetch(
        new Request(url.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${secret}` },
        }),
        env,
        ctx
      )
    )
  },
} satisfies ExportedHandler<WorkerEnv>
