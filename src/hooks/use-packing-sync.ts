'use client'

import { useEffect, useRef } from 'react'

/** Kurzer Debounce nur um nahezu gleichzeitige Broadcasts zu bündeln (z.B. Batch-API) */
const SYNC_DEBOUNCE_MS = 80

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
          // Reconnect nach 3 Sekunden
          reconnectTimeout = setTimeout(connect, 3000)
        }
        ws.onerror = () => {
          ws?.close()
        }
      } catch (err) {
        console.warn('PackingSync WebSocket connect failed:', err)
        reconnectTimeout = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      if (debounceTimeout) clearTimeout(debounceTimeout)
      ws?.close()
    }
  }, [vacationId])
}
