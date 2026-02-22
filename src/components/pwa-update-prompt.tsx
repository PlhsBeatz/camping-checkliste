'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw } from 'lucide-react'

const FALLBACK_RELOAD_MS = 4000

export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const registerSw = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        if (reg.waiting) {
          setWaitingWorker(reg.waiting)
          setIsVisible(true)
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker)
              setIsVisible(true)
            }
          })
        })
      } catch (err) {
        console.warn('Service Worker registration failed:', err)
      }
    }

    void registerSw()
  }, [])

  const doReload = useCallback(() => {
    window.location.reload()
  }, [])

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return
    setIsUpdating(true)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })

    fallbackTimerRef.current = setTimeout(() => {
      setShowFallback(true)
    }, FALLBACK_RELOAD_MS)
  }, [waitingWorker])

  useEffect(() => {
    const handleControllerChange = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      window.location.reload()
    }
    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      handleControllerChange
    )
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
      }
      navigator.serviceWorker?.removeEventListener(
        'controllerchange',
        handleControllerChange
      )
    }
  }, [])

  if (!isVisible || !waitingWorker) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-lg border bg-white p-4 shadow-lg">
        <p className="text-sm font-medium">
          {isUpdating ? 'Aktualisiere...' : 'Neue Version verfügbar'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {showFallback
            ? 'Die Aktualisierung wurde angewendet. Die Seite wird gleich neu geladen.'
            : isUpdating
              ? 'Bitte warten Sie – die Seite wird automatisch neu geladen.'
              : 'Es gibt ein Update. Aktualisieren Sie die App, um die neueste Version zu nutzen.'}
        </p>
        <div className="mt-3 flex gap-2">
          {showFallback ? (
            <Button size="sm" onClick={doReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Jetzt neu laden
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aktualisiere...
                  </>
                ) : (
                  'Jetzt aktualisieren'
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsVisible(false)}
                disabled={isUpdating}
              >
                Später
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
