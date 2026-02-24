'use client'

import { useEffect, useRef } from 'react'

/** Kurzer Debounce nur um nahezu gleichzeitige Broadcasts zu bündeln (z.B. Batch-API) */
const SYNC_DEBOUNCE_MS = 80
const PING_INTERVAL_MS = 30_000

/**
 * WebSocket-Hook für Echtzeit-Sync der Packliste via Durable Object.
 * Verbindet sich mit dem PackingSync-DO und löst onUpdate aus, wenn
 * Änderungen von anderen Clients eintreffen.
 */
export function usePackingSync(
  vacationId: string | null,
  onUpdate: () => void
): void {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!vacationId) return

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const base = typeof window !== 'undefined' ? window.location.host : ''
    const wsUrl = `${protocol}//${base}/api/packing-sync/ws?vacationId=${encodeURIComponent(vacationId)}`

    let ws: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout>
    let pingInterval: ReturnType<typeof setInterval> | null = null
    let reconnectDelay = 3000
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null

    const scheduleUpdate = () => {
      if (debounceTimeout) clearTimeout(debounceTimeout)
      debounceTimeout = setTimeout(() => {
        debounceTimeout = null
        onUpdateRef.current()
      }, SYNC_DEBOUNCE_MS)
    }

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        reconnectDelay = 3000
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as { type?: string }
            if (data?.type === 'packing-list-changed') {
              scheduleUpdate()
            }
          } catch {
            // Kein JSON – ignorieren
          }
        }
        ws.onclose = () => {
          ws = null
          if (pingInterval) {
            clearInterval(pingInterval)
            pingInterval = null
          }
          // Reconnect mit einfachem Backoff + Jitter
          const jitter = Math.floor(Math.random() * 500)
          reconnectTimeout = setTimeout(connect, reconnectDelay + jitter)
          reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
        }
        ws.onerror = () => {
          ws?.close()
        }

        if (!pingInterval) {
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send('ping')
              } catch {
                // Ignorieren, der Reconnect kümmert sich
              }
            }
          }, PING_INTERVAL_MS)
        }
      } catch (err) {
        console.warn('PackingSync WebSocket connect failed:', err)
        const jitter = Math.floor(Math.random() * 500)
        reconnectTimeout = setTimeout(connect, reconnectDelay + jitter)
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
       if (pingInterval) {
        clearInterval(pingInterval)
      }
      if (debounceTimeout) clearTimeout(debounceTimeout)
      ws?.close()
    }
  }, [vacationId])
}
