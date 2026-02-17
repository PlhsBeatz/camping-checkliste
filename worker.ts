/**
 * Custom Worker: Bindet PackingSyncDO (Durable Object) ein und leitet
 * WebSocket-Anfragen an /api/packing-sync/ws an die DO weiter.
 * Alle anderen Anfragen gehen an die Next.js-App (OpenNext).
 */

// @ts-expect-error .open-next/worker.js wird beim Build erzeugt
import { default as handler } from './.open-next/worker.js'
import { PackingSyncDO } from './src/durable-objects/PackingSyncDO'

export { PackingSyncDO }

const PACKING_SYNC_WS_PATH = '/api/packing-sync/ws'
const EQUIPMENT_ITEMS_PATH = '/api/equipment-items'
const EQUIPMENT_BY_TAGS_PATH = '/api/equipment-by-tags'
/** Cache-TTL in Sekunden – reduziert Worker-Aufrufe bei Equipment-Abfragen (500+ Einträge) */
const EQUIPMENT_CACHE_TTL = 60

/** Prüft, ob GET Equipment-API (listenförmig) gecacht werden soll */
function isCachedEquipmentRequest(request: Request, url: URL): boolean {
  if (request.method !== 'GET') return false
  const path = url.pathname
  return (
    (path === EQUIPMENT_ITEMS_PATH && !url.searchParams.has('id')) ||
    path === EQUIPMENT_BY_TAGS_PATH
  )
}

interface WorkerEnv {
  PACKING_SYNC_DO: DurableObjectNamespace
  DB?: unknown
  ASSETS?: Fetcher
}

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

    // Equipment-API cachen (reduziert Worker-Ressourcen, Error 1102)
    if (isCachedEquipmentRequest(request, url)) {
      const cache = caches.default
      const cached = await cache.match(request)
      if (cached) {
        return cached
      }
      const response = await handler.fetch(request, env, ctx)
      if (response.ok) {
        const clone = response.clone()
        const headers = new Headers(clone.headers)
        headers.set(
          'Cache-Control',
          `public, max-age=${EQUIPMENT_CACHE_TTL}, s-maxage=${EQUIPMENT_CACHE_TTL}, stale-while-revalidate=120`
        )
        const responseToCache = new Response(clone.body, {
          status: clone.status,
          statusText: clone.statusText,
          headers,
        })
        ctx.waitUntil(cache.put(request, responseToCache))
      }
      return response
    }

    return handler.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<WorkerEnv>
