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
  OUTBOX_CHANGED_EVENT_NAME,
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
      // Ergebnis des letzten Syncs ("… synchronisiert.") nicht in eine neue Offline-Phase
      // mitschleppen – sonst steht dort fälschlich eine Erfolgsmeldung, obwohl noch
      // gar nichts gesendet wurde.
      if (!online) setResultMsg(null)
      void refresh()
    })
  }, [refresh])

  // Outbox-Änderungen (Eintrag hinzugefügt/entfernt) → Zähler live aktualisieren,
  // auch während man offline mehrere Einträge abhakt.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => void refreshRef.current()
    window.addEventListener(OUTBOX_CHANGED_EVENT_NAME, handler)
    return () => window.removeEventListener(OUTBOX_CHANGED_EVENT_NAME, handler)
  }, [])

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

  const changeCountLabel = formatChangeCount(queueCount)
  const statusAriaLabel = buildStatusAriaLabel({
    isOnline,
    queueCount,
    isProcessing,
    resultMsg,
  })

  return (
    <div
      className={cn(
        // Platz rechts (pr) reservieren, damit der schwebende FAB-Button frei bleibt.
        // Nur die Karte selbst ist klickbar (pointer-events-none hier, -auto auf der Karte).
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pl-2 pr-[4.25rem] sm:pl-3 sm:pr-[5.5rem] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1',
        // Schwebendes Overlay – verschiebt nie den Seiteninhalt; sanftes Ein-/Ausblenden.
        'transition-all duration-300 ease-out',
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-[calc(100%+1rem)] opacity-0'
      )}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      aria-label={visible ? statusAriaLabel : undefined}
    >
    <div
      className={cn(
        'w-full max-w-2xl rounded-xl border shadow-lg backdrop-blur',
        visible && 'pointer-events-auto',
        !isOnline ? 'bg-amber-100/95 border-amber-300' : 'bg-blue-50/95 border-blue-200'
      )}
    >
      <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
        {!isOnline ? (
          <CloudOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-700 flex-shrink-0" aria-hidden />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-700 flex-shrink-0" aria-hidden />
        )}
        <div className="flex-1 min-w-0">
          {!isOnline && (
            <span className="font-medium text-amber-900 truncate block">
              <span className="sm:hidden">
                {queueCount > 0 ? changeCountLabel : 'Offline'}
              </span>
              <span className="hidden sm:inline">
                Offline-Modus
                {queueCount > 0 && (
                  <>
                    {' '}
                    – {queueCount} ausstehende{' '}
                    Änderung{queueCount === 1 ? ' wird' : 'en werden'} bei Wiederverbindung
                    synchronisiert.
                  </>
                )}
              </span>
            </span>
          )}
          {isOnline && queueCount > 0 && (
            <span className="font-medium text-blue-900 truncate block">
              <span className="sm:hidden">
                {isProcessing ? 'Synchronisiere…' : changeCountLabel}
              </span>
              <span className="hidden sm:inline">
                {isProcessing
                  ? `Synchronisiere ${queueCount} ausstehende Änderung${queueCount === 1 ? '' : 'en'}…`
                  : `${queueCount} ausstehende Änderung${queueCount === 1 ? '' : 'en'}. Bei Problemen bitte „Erneut versuchen“ verwenden.`}
              </span>
            </span>
          )}
          {isOnline && resultMsg && (
            <span className="hidden sm:inline ml-2 text-xs text-muted-foreground">
              {resultMsg}
            </span>
          )}
        </div>
        {queueCount > 0 && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-7 sm:w-auto px-0 sm:px-2 flex-shrink-0"
              onClick={handleResync}
              disabled={isProcessing || !isOnline}
              aria-label="Erneut versuchen"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 sm:mr-1', isProcessing && 'animate-spin')}
                aria-hidden
              />
              <span className="hidden sm:inline">Erneut versuchen</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs flex-shrink-0"
              onClick={() => setShowDetails((v) => !v)}
            >
              <span className="sm:hidden">{showDetails ? '×' : '…'}</span>
              <span className="hidden sm:inline">{showDetails ? 'Schließen' : 'Details'}</span>
            </Button>
          </>
        )}
      </div>

      {showDetails && entries.length > 0 && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 max-h-64 overflow-y-auto">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-card/70 border border-subtle"
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
    </div>
  )
}

function formatChangeCount(count: number): string {
  return count === 1 ? '1 Änderung' : `${count} Änderungen`
}

function buildStatusAriaLabel(opts: {
  isOnline: boolean
  queueCount: number
  isProcessing: boolean
  resultMsg: string | null
}): string {
  const { isOnline, queueCount, isProcessing, resultMsg } = opts
  if (!isOnline) {
    if (queueCount > 0) {
      return `Offline-Modus, ${formatChangeCount(queueCount)} werden bei Wiederverbindung synchronisiert.`
    }
    return 'Offline-Modus.'
  }
  if (queueCount > 0) {
    if (isProcessing) {
      return `Synchronisiere ${formatChangeCount(queueCount)}.`
    }
    return `${formatChangeCount(queueCount)} ausstehend.`
  }
  return resultMsg ?? ''
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
