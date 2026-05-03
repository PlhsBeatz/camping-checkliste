'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  enqueueSync,
  processSyncQueue,
  subscribeToOnlineStatus,
  getSyncQueueCount,
  type SyncAction,
} from '@/lib/offline-sync'

interface MutationOptions {
  /**
   * Stabile Bezeichnung der Tabelle/des API-Routings (siehe `resolveRoute` in `offline-sync.ts`).
   * Beispiele: `'packing-items'`, `'packing-items-toggle-mitreisender'`.
   */
  table: string
  /**
   * Logischer Schlüssel: Entitäts-ID o. ä. Wird beim Routing als Pfad-/Query-Parameter genutzt.
   */
  key: string
  /** HTTP-Aktion. */
  action: SyncAction
  /** Body, der an die API geschickt wird. Wird beim Senden zu JSON serialisiert. */
  payload?: unknown
  /** Zusätzliche Routing-Kontextfelder (z. B. parent-IDs für nested Endpoints). */
  context?: Record<string, string>
  /**
   * Optionaler Custom-Sender. Wenn gesetzt, ersetzt er das Standard-Routing aus
   * `offline-sync.ts` und wird auch online ausgeführt. Muss bei Erfolg `true` und bei
   * temporären Fehlern (5xx, Netzwerk) `false` zurückgeben.
   */
  send?: () => Promise<{ ok: boolean; status?: number }>
}

export interface MutationResult {
  /** `true` wenn die Mutation bereits beim Server bestätigt wurde. */
  ok: boolean
  /** `true` wenn sie in die Outbox gelegt und bei Reconnect gesendet wird. */
  queued: boolean
  /** Optional: Fehlermeldung. */
  error?: string
}

/**
 * Zentrale Mutationsschicht: probiert den API-Call online; bei Offline / 5xx wird die
 * Mutation in die Outbox (IndexedDB syncQueue) gelegt und bei Reconnect wiedergespielt.
 *
 * Optimistisches UI bleibt in der Verantwortung des Aufrufers (state vor `mutate()`
 * setzen, bei `error` zurückrollen).
 *
 * Außerdem zählt der Hook offene Outbox-Einträge und triggert beim Reconnect automatisch
 * `processSyncQueue()`.
 */
export function useOptimisticMutation() {
  const [pending, setPending] = useState(0)
  const [syncQueueCount, setSyncQueueCount] = useState(0)
  const refreshCount = useCallback(async () => {
    try {
      const c = await getSyncQueueCount()
      setSyncQueueCount(c)
    } catch {
      /* ignore */
    }
  }, [])

  // Beim Mount sowie nach jeder Mutation Outbox-Größe aktualisieren.
  useEffect(() => {
    void refreshCount()
  }, [refreshCount])

  // Bei Reconnect Outbox abarbeiten und Zähler aktualisieren.
  useEffect(() => {
    let initial = true
    let lastOnline =
      typeof navigator !== 'undefined' ? navigator.onLine : true

    return subscribeToOnlineStatus((online) => {
      if (initial) {
        initial = false
        lastOnline = online
        return
      }
      if (online && !lastOnline) {
        void (async () => {
          await processSyncQueue()
          await refreshCount()
        })()
      }
      lastOnline = online
    })
  }, [refreshCount])

  // Auch der Service-Worker kann Background-Sync auslösen → wir hören auf Messages.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const handler = async (e: MessageEvent) => {
      if (e.data?.type === 'PROCESS_SYNC_QUEUE') {
        await processSyncQueue()
        await refreshCount()
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [refreshCount])

  const isOnlineRef = useRef(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  useEffect(() => {
    return subscribeToOnlineStatus((online) => {
      isOnlineRef.current = online
    })
  }, [])

  const mutate = useCallback(
    async (opts: MutationOptions): Promise<MutationResult> => {
      setPending((n) => n + 1)
      try {
        if (!isOnlineRef.current) {
          // Offline: direkt queue-en
          await enqueueSync(opts.table, opts.action, opts.key, opts.payload, opts.context)
          await refreshCount()
          // Background Sync registrieren, falls verfügbar (best effort)
          await registerBackgroundSync()
          return { ok: false, queued: true }
        }
        const result = opts.send
          ? await opts.send()
          : await defaultSend(opts)
        if (result.ok) {
          return { ok: true, queued: false }
        }
        // Online aber Server-Fehler → bei 5xx queue, bei 4xx aufgeben.
        if (result.status && result.status >= 400 && result.status < 500) {
          return { ok: false, queued: false, error: `HTTP ${result.status}` }
        }
        await enqueueSync(opts.table, opts.action, opts.key, opts.payload, opts.context)
        await refreshCount()
        await registerBackgroundSync()
        return { ok: false, queued: true }
      } catch {
        // Netzwerkfehler → Queue
        await enqueueSync(opts.table, opts.action, opts.key, opts.payload, opts.context)
        await refreshCount()
        await registerBackgroundSync()
        return { ok: false, queued: true }
      } finally {
        setPending((n) => Math.max(0, n - 1))
      }
    },
    [refreshCount]
  )

  return { mutate, pending, syncQueueCount, refreshCount }
}

async function defaultSend(opts: MutationOptions): Promise<{ ok: boolean; status?: number }> {
  // Spiegel der Routen-Logik in offline-sync.ts/resolveRoute → bewusst dupliziert,
  // damit der Online-Pfad NICHT erst über den syncQueue gehen muss.
  const ctx = opts.context ?? {}
  let method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
  let url = ''
  let body: unknown = undefined
  switch (opts.table) {
    case 'packing-items':
      if (opts.action === 'put' || opts.action === 'patch') {
        method = 'PUT'
        url = '/api/packing-items'
        body = { id: opts.key, ...(opts.payload as object) }
      } else if (opts.action === 'post') {
        method = 'POST'
        url = '/api/packing-items'
        body = opts.payload
      } else if (opts.action === 'delete') {
        method = 'DELETE'
        url = `/api/packing-items?id=${encodeURIComponent(opts.key)}`
      }
      break
    case 'packing-items-toggle-mitreisender':
      method = 'PUT'
      url = '/api/packing-items/toggle-mitreisender'
      body = opts.payload
      break
    case 'packing-items-set-mitreisender-anzahl':
      method = 'PUT'
      url = '/api/packing-items/set-mitreisender-anzahl'
      body = opts.payload
      break
    case 'packing-items-confirm-vorgemerkt':
      method = 'POST'
      url = '/api/packing-items/confirm-vorgemerkt'
      body = opts.payload
      break
    case 'packing-items-batch':
      method = 'POST'
      url = '/api/packing-items/batch'
      body = opts.payload
      break
    case 'checklisten-eintrag-erledigt':
      method = 'PATCH'
      url = `/api/checklisten/${encodeURIComponent(ctx.checklistId ?? '')}/eintraege/${encodeURIComponent(ctx.eintragId ?? '')}`
      body = opts.payload
      break
    default:
      return { ok: false, status: 0 }
  }
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { ok: res.ok, status: res.status }
}

async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  try {
    const reg = await navigator.serviceWorker.ready
    // Background Sync ist nicht in allen Browsern verfügbar (z. B. iOS Safari).
    const sync = (reg as unknown as { sync?: { register: (tag: string) => Promise<void> } }).sync
    if (sync && typeof sync.register === 'function') {
      await sync.register('process-sync-queue')
    }
  } catch {
    /* Background Sync nicht unterstützt – beim Reconnect übernimmt der Hook */
  }
}
