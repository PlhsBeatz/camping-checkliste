'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'

export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isVisible, setIsVisible] = useState(false)

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

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }, [waitingWorker])

  useEffect(() => {
    const handleControllerChange = () => {
      window.location.reload()
    }
    navigator.serviceWorker?.addEventListener(
      'controllerchange',
      handleControllerChange
    )
    return () =>
      navigator.serviceWorker?.removeEventListener(
        'controllerchange',
        handleControllerChange
      )
  }, [])

  if (!isVisible || !waitingWorker) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-lg border bg-background p-4 shadow-lg">
        <p className="text-sm font-medium">Neue Version verfügbar</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Es gibt ein Update. Aktualisieren Sie die App, um die neueste Version
          zu nutzen.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={handleUpdate}>
            Jetzt aktualisieren
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsVisible(false)}>
            Später
          </Button>
        </div>
      </div>
    </div>
  )
}
