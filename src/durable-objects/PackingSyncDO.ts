/**
 * Durable Object für Echtzeit-Sync der Packliste.
 * Pro Urlaub (vacationId) eine DO-Instanz – WebSocket-Clients erhalten sofortige Updates
 * wenn Packlisten-Einträge geändert werden.
 *
 * Zusätzlich: Debounce für Integrations-Webhooks (Alarm nach Pack-Burst).
 */
/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../../cloudflare-workers.d.ts" />
import { DurableObject } from 'cloudflare:workers'
import { processIntegrationEventsForVacation } from '@/lib/integration-events'

/** Trailing-Ruhe vor Webhook-Lauf; Max. Wartezeit ab erstem Event im Burst. */
const INTEGRATION_DEBOUNCE_MS = 10_000
const INTEGRATION_DEBOUNCE_MAX_MS = 30_000

export type PackingSyncEnv = {
  DB?: D1Database
}

type IntegrationPending = {
  vacationId: string
  packedDelta: number
  firstAt: number
}

export class PackingSyncDO extends DurableObject<PackingSyncEnv> {
  private sessions: Map<WebSocket, { id: string }> = new Map()

  constructor(ctx: DurableObjectState, env: PackingSyncEnv) {
    super(ctx, env)

    // Bereits bestehende (hibernierende) WebSockets beim Aufwachen wiederherstellen
    this.ctx.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment() as { id?: string } | null
      if (attachment?.id) {
        this.sessions.set(ws, { id: attachment.id })
      }
    })

    // Ping/Pong auf Protokoll-Ebene, ohne das DO zu wecken
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    )
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Interne Anfrage von API: Broadcast an alle verbundenen Clients
    if (url.pathname === '/internal/broadcast' && request.method === 'POST') {
      let message: object = { type: 'packing-list-changed' }
      try {
        const parsed = (await request.json()) as unknown
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          message = parsed as object
        }
      } catch {
        // leerer Body → Full-Reload-Signal
      }
      this.broadcastToAll(message)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Integrations-Deltas bündeln (Webhook-Debounce)
    if (url.pathname === '/internal/schedule-integration' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          vacationId?: string
          packedDelta?: number
        }
        if (!body.vacationId || body.packedDelta == null || body.packedDelta === 0) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const prev = await this.ctx.storage.get<IntegrationPending>('integrationPending')
        const firstAt = prev?.firstAt ?? Date.now()
        const packedDelta = (prev?.packedDelta ?? 0) + body.packedDelta
        await this.ctx.storage.put('integrationPending', {
          vacationId: body.vacationId,
          packedDelta,
          firstAt,
        } satisfies IntegrationPending)
        const trailing = Date.now() + INTEGRATION_DEBOUNCE_MS
        const maxWait = firstAt + INTEGRATION_DEBOUNCE_MAX_MS
        await this.ctx.storage.setAlarm(Math.min(trailing, maxWait))
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err) {
        console.warn('schedule-integration failed:', err)
        return new Response(JSON.stringify({ ok: false }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (url.pathname === '/internal/clear-integration' && request.method === 'POST') {
      try {
        await this.ctx.storage.deleteAlarm()
        await this.ctx.storage.delete('integrationPending')
      } catch (err) {
        console.warn('clear-integration failed:', err)
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // WebSocket-Upgrade von Clients
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('WebSocket upgrade expected', { status: 426 })
    }

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    if (!client || !server) {
      return new Response('Invalid WebSocket pair', { status: 500 })
    }

    // Hibernation-fähige WebSocket-Verbindung akzeptieren
    this.ctx.acceptWebSocket(server)

    const id = crypto.randomUUID()
    // Verbindung an das DO „anhängen“, damit sie nach Hibernation rekonstruierbar ist
    server.serializeAttachment({ id })
    this.sessions.set(server, { id })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  /** Nach Debounce: gebündelten packedDelta an Integrations-Pipeline übergeben. */
  async alarm(): Promise<void> {
    const pending = await this.ctx.storage.get<IntegrationPending>('integrationPending')
    await this.ctx.storage.delete('integrationPending')
    if (!pending?.vacationId || !pending.packedDelta || !this.env.DB) return

    try {
      await processIntegrationEventsForVacation(this.env.DB, pending.vacationId, {
        packedDelta: pending.packedDelta,
      })
    } catch (err) {
      console.warn('PackingSyncDO integration alarm failed:', err)
    }
  }

  // Broadcast-Nachricht an alle verbundenen WebSockets senden
  private broadcastToAll(message: object): void {
    const payload = JSON.stringify(message)
    this.sessions.forEach((_, ws) => {
      try {
        ws.send(payload)
      } catch {
        // Verbindung evtl. schon geschlossen
      }
    })
  }

  // Wird vom Runtime aufgerufen, wenn eine WebSocket-Verbindung sauber schließt
  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    ws.close()
    this.sessions.delete(ws)
  }
}
