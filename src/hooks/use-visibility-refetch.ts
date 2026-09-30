'use client'

import { useEffect, useRef } from 'react'
import { todayInAppTimezone } from '@/lib/app-timezone'

export type UseVisibilityRefetchOptions = {
  /**
   * Mindestabstand zwischen zwei Refetches (ms).
   * Default: 10 Minuten – schützt Cloudflare Workers Free (CPU 1102)
   * vor Resume-Spam bei schweren APIs wie `/api/attention`.
   */
  minIntervalMs?: number
  /**
   * Wenn true, umgeht ein Kalendertag-Wechsel (Europe/Berlin) das Intervall.
   * Default false – Tagwechsel lokal behandeln, nicht mit schweren API-Calls.
   */
  forceOnDayChange?: boolean
  /**
   * `pageshow` nur bei bfcache-Restore (`persisted`), Default true.
   * Vermeidet Doppel-Fire mit visibilitychange beim normalen Resume.
   */
  includePageShow?: boolean
}

/**
 * Ruft `refetch` auf, wenn die App/PWA wieder sichtbar wird.
 * Stark gedrosselt, damit Resume nicht Worker-Limits (1102) auslöst.
 */
export function useVisibilityRefetch(
  refetch: () => void | Promise<void>,
  options?: UseVisibilityRefetchOptions
): void {
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  const minIntervalMs = options?.minIntervalMs ?? 10 * 60_000
  const forceOnDayChange = options?.forceOnDayChange === true
  const includePageShow = options?.includePageShow !== false
  const lastRefetchAtRef = useRef(Date.now())
  const lastDayRef = useRef(todayInAppTimezone())

  useEffect(() => {
    const run = () => {
      const today = todayInAppTimezone()
      const dayChanged = today !== lastDayRef.current
      const now = Date.now()
      if (dayChanged) lastDayRef.current = today
      if (!forceOnDayChange || !dayChanged) {
        if (now - lastRefetchAtRef.current < minIntervalMs) return
      }
      lastRefetchAtRef.current = now
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
      // Nur bfcache – normales pageshow + visibilitychange würde sonst doppelt feuern
      if (event.persisted) run()
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
  }, [minIntervalMs, forceOnDayChange, includePageShow])
}
