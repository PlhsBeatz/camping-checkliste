'use client'

import { useEffect, useRef } from 'react'
import { todayInAppTimezone } from '@/lib/app-timezone'

export type UseVisibilityRefetchOptions = {
  /**
   * Mindestabstand zwischen zwei Refetches (ms). Verhindert Spam bei kurzen
   * App-Wechseln; nach längerem Hintergrund reicht ein Resume.
   * Kalendertag-Wechsel (Europe/Berlin) umgeht dieses Intervall immer.
   * Default: 30 Sekunden.
   */
  minIntervalMs?: number
  /** Refetch auch bei `pageshow` (bfcache), Default true. */
  includePageShow?: boolean
}

/**
 * Ruft `refetch` auf, wenn die App/PWA wieder sichtbar wird (Tab zurück,
 * Smartphone entsperren, PWA aus Hintergrund). Aktualisiert State ohne
 * vollständigen Seiten-Reload – ideal für datumsabhängige Hub-Inhalte.
 *
 * Übergebenes `refetch` wird via Ref gehalten (wie `useReconnectRefetch`).
 */
export function useVisibilityRefetch(
  refetch: () => void | Promise<void>,
  options?: UseVisibilityRefetchOptions
): void {
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  const minIntervalMs = options?.minIntervalMs ?? 30_000
  const includePageShow = options?.includePageShow !== false
  const lastRefetchAtRef = useRef(Date.now())
  const lastDayRef = useRef(todayInAppTimezone())

  useEffect(() => {
    const run = () => {
      const today = todayInAppTimezone()
      const dayChanged = today !== lastDayRef.current
      const now = Date.now()
      if (!dayChanged && now - lastRefetchAtRef.current < minIntervalMs) return
      lastRefetchAtRef.current = now
      lastDayRef.current = today
      try {
        void refetchRef.current()
      } catch (err) {
        console.warn('useVisibilityRefetch: refetch warf eine Exception', err)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run()
    }

    const onPageShow = (event: PageTransitionEvent) => {
      // bfcache-Restore oder normales pageshow nach Resume
      if (event.persisted || document.visibilityState === 'visible') run()
    }

    document.addEventListener('visibilitychange', onVisibility)
    if (includePageShow) {
      window.addEventListener('pageshow', onPageShow)
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (includePageShow) {
        window.removeEventListener('pageshow', onPageShow)
      }
    }
  }, [minIntervalMs, includePageShow])
}
