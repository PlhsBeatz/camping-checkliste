'use client'

import { useEffect, useRef, useState } from 'react'
import type { Rastplatz } from '@/lib/db'
import { haversineDistanceKm } from '@/lib/routes'
import { isPointInSegmentCorridor } from '@/lib/travel-segment'
import type { TravelSegment } from '@/lib/travel-segment'
import {
  RASTPLATZ_NEARBY_ALERT_KM,
  buildRastplatzNearbyPush,
  sendClientPushNotification,
} from '@/lib/push-notifications'
import { toast } from 'sonner'

const ALERT_COOLDOWN_MS = 20 * 60 * 1000

export function useRastNearbyAlert(params: {
  enabled: boolean
  position: { lat: number; lng: number } | null
  rastplaetze: Rastplatz[]
  activeSegment: TravelSegment | null
  pushEnabled?: boolean
}) {
  const { enabled, position, rastplaetze, activeSegment, pushEnabled } = params
  const alertedRef = useRef<Map<string, number>>(new Map())
  const [nearbyEmpfehlung, setNearbyEmpfehlung] = useState<Rastplatz | null>(null)
  const [nearbyDistanceKm, setNearbyDistanceKm] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || !position || !activeSegment) {
      setNearbyEmpfehlung(null)
      setNearbyDistanceKm(null)
      return
    }

    const now = Date.now()
    let closest: { r: Rastplatz; dist: number } | null = null

    for (const r of rastplaetze) {
      if (r.is_archived || r.bewertung !== 'empfehlung') continue
      if (
        !isPointInSegmentCorridor(
          { lat: r.lat, lng: r.lng },
          activeSegment.from,
          activeSegment.to
        )
      ) {
        continue
      }
      const dist = haversineDistanceKm({
        lat1: position.lat,
        lng1: position.lng,
        lat2: r.lat,
        lng2: r.lng,
      })
      if (dist <= RASTPLATZ_NEARBY_ALERT_KM && (!closest || dist < closest.dist)) {
        closest = { r, dist }
      }
    }

    if (!closest) {
      setNearbyEmpfehlung(null)
      setNearbyDistanceKm(null)
      return
    }

    setNearbyEmpfehlung(closest.r)
    setNearbyDistanceKm(closest.dist)

    const last = alertedRef.current.get(closest.r.id) ?? 0
    if (now - last < ALERT_COOLDOWN_MS) return

    alertedRef.current.set(closest.r.id, now)

    const distLabel =
      closest.dist >= 10
        ? `${Math.round(closest.dist)} km`
        : `${Math.round(closest.dist * 10) / 10} km`
    const msg = `Empfehlung in ca. ${distLabel}: ${closest.r.name}`
    toast.info(msg, { duration: 10000 })

    if (pushEnabled) {
      const payload = buildRastplatzNearbyPush({
        rastplatzId: closest.r.id,
        name: closest.r.name,
        distanceKm: closest.dist,
      })
      void sendClientPushNotification(payload)
    }
  }, [enabled, position, rastplaetze, activeSegment, pushEnabled])

  return { nearbyEmpfehlung, nearbyDistanceKm }
}
