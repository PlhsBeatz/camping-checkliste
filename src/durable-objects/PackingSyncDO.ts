/**
 * Durable Object für Echtzeit-Sync der Packliste.
 * Pro Urlaub (vacationId) eine DO-Instanz – WebSocket-Clients erhalten sofortige Updates
 * wenn Packlisten-Einträge geändert werden.
 */
/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../../cloudflare-workers.d.ts" />
import { DurableObject } from 'cloudflare:workers'

/** Umgebung für PackingSyncDO – keine zusätzlichen Bindings nötig */
export type PackingSyncEnv = Record<string, never>

export class PackingSyncDO extends DurableObject<PackingSyncEnv> {
  private sessions: Map<WebSocket, { id: string }> = new Map()

  constructor(ctx: DurableObjectState, _env: PackingSyncEnv) {
    super(ctx, _env)

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
      this.broadcastToAll({ type: 'packing-list-changed' })
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
