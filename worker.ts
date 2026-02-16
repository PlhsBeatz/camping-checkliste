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

    return handler.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<WorkerEnv>
