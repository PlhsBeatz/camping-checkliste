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

    server.accept()

    const id = crypto.randomUUID()
    this.sessions.set(server, { id })

    server.addEventListener('message', (event: MessageEvent) => {
      // Echo oder Pong für Keepalive – Clients können optional Ping senden
      try {
        const data = typeof event.data === 'string' ? event.data : ''
        if (data === 'ping') {
          server.send('pong')
        }
      } catch {
        // Ignorieren bei Fehlern
      }
    })

    server.addEventListener('close', () => {
      this.sessions.delete(server)
    })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

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
}
