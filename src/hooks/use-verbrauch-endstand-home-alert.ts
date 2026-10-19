'use client'

import { useEffect, useRef } from 'react'
import type { TravelSegment } from '@/lib/travel-segment'
import { hasArrivedHomeForEndstand } from '@/lib/verbrauch-endstand'
import { toast } from 'sonner'

/**
 * Bei GPS-Ankunft zuhause auf der Rückfahrt: Endstand-Push (einmal pro Urlaub).
 */
export function useVerbrauchEndstandHomeAlert(params: {
  enabled: boolean
  position: { lat: number; lng: number } | null
  homeCoords: { lat: number; lng: number } | null
  activeSegment: TravelSegment | null
  vacationId: string | null
  isStationary: boolean
}) {
  const { enabled, position, homeCoords, activeSegment, vacationId, isStationary } = params
  const attemptedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled || !vacationId || !isStationary) return
    if (
      !hasArrivedHomeForEndstand({
        position,
        homeCoords,
        activeSegment,
      })
    ) {
      return
    }
    if (attemptedRef.current.has(vacationId)) return
    attemptedRef.current.add(vacationId)

    void (async () => {
      try {
        const res = await fetch('/api/verbrauch/endstand-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ urlaubId: vacationId }),
        })
        const json = (await res.json()) as {
          success?: boolean
          data?: {
            notified?: boolean
            alreadySent?: boolean
            mediaNames?: string[]
          }
        }
        if (!json.success || !json.data) return
        if (json.data.alreadySent || !json.data.mediaNames?.length) return
        if (json.data.notified) {
          const media = json.data.mediaNames.join(', ')
          toast.info(`Endstände erfassen: ${media}`, { duration: 10000 })
        }
      } catch {
        attemptedRef.current.delete(vacationId)
      }
    })()
  }, [enabled, position, homeCoords, activeSegment, vacationId, isStationary])
}
