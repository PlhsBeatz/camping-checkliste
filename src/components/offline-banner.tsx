'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudOff, RefreshCw, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getSyncQueueCount,
  getSyncQueueEntries,
  deleteSyncQueueEntry,
  processSyncQueue,
  subscribeToOnlineStatus,
  OUTBOX_SYNCED_EVENT_NAME,
} from '@/lib/offline-sync'
import type { SyncQueueEntry } from '@/lib/offline-db'
import { cn } from '@/lib/utils'

/**
 * Globaler Offline-/Sync-Status-Banner.
 *
 * - Zeigt sich, sobald der Browser offline ist ODER ausstehende Sync-Einträge da sind.
 * - Erlaubt dem User, einen manuellen Resync zu starten ("Erneut versuchen").
 * - Zeigt eine ausklappbare Detailansicht der Outbox mit "Verwerfen"-Knöpfen.
 */
export function OfflineBanner() {
  /** Immer mit `true` starten: Server und erster Client-Pass müssen übereinstimmen (Hydration). Echter Status folgt in `useEffect` via `subscribeToOnlineStatus`. */
  const [isOnline, setIsOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const [entries, setEntries] = useState<SyncQueueEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const c = await getSyncQueueCount()
      setQueueCount(c)
      if (showDetails) {
        const list = await getSyncQueueEntries()
        setEntries(list)
      }
    } catch {
      /* ignore */
    }
  }, [showDetails])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    void refresh()
    return subscribeToOnlineStatus((online) => {
      setIsOnline(online)
      void refresh()
    })
  }, [refresh])

  /** Sobald wieder online und Outbox nicht leer: automatisch synchronisieren (wie erwartete „wird synchronisiert“). */
  useEffect(() => {
    if (!isOnline || queueCount <= 0) return
    let cancelled = false
    void (async () => {
      setIsProcessing(true)
      setResultMsg(null)
      try {
        const r = await processSyncQueue()
        if (cancelled) return
        if (typeof window !== 'undefined' && r.ok > 0) {
          window.dispatchEvent(new CustomEvent(OUTBOX_SYNCED_EVENT_NAME))
        }
        if (r.ok > 0 && r.failed === 0) {
          setResultMsg(`${r.ok} Änderung${r.ok === 1 ? '' : 'en'} synchronisiert.`)
        } else if (r.failed > 0 && r.remaining > 0) {
          setResultMsg(
            `${r.ok > 0 ? `${r.ok} synchronisiert, ` : ''}Teilweise fehlgeschlagen – „Erneut versuchen“ nutzen.`
          )
        } else if (r.remaining === 0 && r.ok === 0 && r.failed === 0) {
          setResultMsg(null)
        }
      } finally {
        setIsProcessing(false)
        if (!cancelled) await refreshRef.current()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOnline, queueCount])

  // Bei jedem Öffnen der Detail-Ansicht Liste neu laden
  useEffect(() => {
    if (showDetails) void refresh()
  }, [showDetails, refresh])

  // Service-Worker-Trigger lauschen (Background Sync) → Liste aktualisieren
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const handler = () => {
      void refresh()
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [refresh])

  const handleResync = async () => {
    setIsProcessing(true)
    setResultMsg(null)
    try {
      const r = await processSyncQueue()
      if (typeof window !== 'undefined' && r.ok > 0) {
        window.dispatchEvent(new CustomEvent(OUTBOX_SYNCED_EVENT_NAME))
      }
      if (r.ok > 0 && r.failed === 0) {
        setResultMsg(`${r.ok} Änderung${r.ok === 1 ? '' : 'en'} synchronisiert.`)
      } else if (r.failed > 0) {
        setResultMsg(`${r.ok} synchronisiert, ${r.failed} fehlgeschlagen.`)
      } else if (r.remaining === 0) {
        setResultMsg('Keine ausstehenden Änderungen.')
      }
    } finally {
      setIsProcessing(false)
      await refresh()
    }
  }

  const handleDiscard = async (id: number) => {
    await deleteSyncQueueEntry(id)
    await refresh()
  }

  const visible = !isOnline || queueCount > 0
  if (!visible) return null

  return (
    <div
      className={cn(
        'sticky top-0 z-40 w-full border-b shadow-sm',
        !isOnline ? 'bg-amber-100 border-amber-300' : 'bg-blue-50 border-blue-200'
      )}
      role="status"
      aria-live="polite"
    >
      <div className="container mx-auto px-3 py-2 flex items-center gap-2 text-sm">
        {!isOnline ? (
          <CloudOff className="h-4 w-4 text-amber-700 flex-shrink-0" aria-hidden />
        ) : (
          <AlertCircle className="h-4 w-4 text-blue-700 flex-shrink-0" aria-hidden />
        )}
        <div className="flex-1 min-w-0">
          {!isOnline && (
            <span className="font-medium text-amber-900">
              Offline-Modus
              {queueCount > 0 && (
                <>
                  {' '}
                  – {queueCount} ausstehende{' '}
                  Änderung{queueCount === 1 ? '' : 'en'} werden bei Wiederverbindung gesendet.
                </>
              )}
            </span>
          )}
          {isOnline && queueCount > 0 && (
            <span className="font-medium text-blue-900">
              {isProcessing
                ? `Synchronisiere ${queueCount} ausstehende Änderung${queueCount === 1 ? '' : 'en'}…`
                : `${queueCount} ausstehende Änderung${queueCount === 1 ? '' : 'en'}. Bei Problemen bitte „Erneut versuchen“ verwenden.`}
            </span>
          )}
          {resultMsg && (
            <span className="ml-2 text-xs text-muted-foreground">{resultMsg}</span>
          )}
        </div>
        {queueCount > 0 && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={handleResync}
              disabled={isProcessing || !isOnline}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 mr-1', isProcessing && 'animate-spin')}
                aria-hidden
              />
              Erneut versuchen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? 'Schließen' : 'Details'}
            </Button>
          </>
        )}
      </div>

      {showDetails && entries.length > 0 && (
        <div className="container mx-auto px-3 pb-3 pt-1 space-y-1.5 max-h-64 overflow-y-auto">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-white/70 border border-gray-200"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {humanLabel(e)}
                </div>
                <div className="text-muted-foreground">
                  {new Date(e.timestamp).toLocaleString('de-DE')}
                  {e.attempts && e.attempts > 0 ? ` · ${e.attempts} Versuche` : ''}
                  {e.lastError ? ` · ${e.lastError}` : ''}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => e.id != null && void handleDiscard(e.id)}
                aria-label="Eintrag verwerfen"
              >
                <X className="h-3 w-3" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function humanLabel(e: SyncQueueEntry): string {
  const action = e.action.toUpperCase()
  switch (e.table) {
    case 'packing-items':
      return `Packlisten-Eintrag · ${action}`
    case 'packing-items-toggle-mitreisender':
      return 'Mitreisender-Status ändern'
    case 'packing-items-set-mitreisender-anzahl':
      return 'Anzahl pro Mitreisendem'
    case 'packing-items-confirm-vorgemerkt':
      return 'Vormerkung bestätigen'
    case 'packing-items-batch':
      return 'Mehrere Packlisten-Einträge'
    case 'checklisten-eintrag-erledigt':
      return 'Checklisten-Eintrag · erledigt'
    default:
      return `${e.table} · ${action}`
  }
}
