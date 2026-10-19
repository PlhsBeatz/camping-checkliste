'use client'

import { useEffect, useState } from 'react'
import type { VacationCampingStay } from '@/lib/db'
import {
  buildSegmentPolylinesMap,
  type SegmentPolylineSource,
  type SegmentRoutePolylines,
} from '@/lib/travel-segment'
import {
  parseCampingplatzRouteApiData,
  routeInfoToCacheEntry,
  routeInfoToSegmentCacheEntry,
} from '@/lib/client-route-info'
import { cacheRoute, cacheSegmentRoute } from '@/lib/offline-db'
import { getCachedRoute, getCachedSegmentRoute } from '@/lib/offline-sync'

/**
 * Lädt Hin-, Etappen- und Rück-Polylines (Cache zuerst) für das GPS-Matching.
 */
export function useReiseRoutePolylines(
  userId: string | null | undefined,
  stays: VacationCampingStay[],
  homeCoords: { lat: number; lng: number } | null
): Map<string, SegmentRoutePolylines> {
  const [polylines, setPolylines] = useState<Map<string, SegmentRoutePolylines>>(
    () => new Map()
  )

  useEffect(() => {
    if (!userId || stays.length === 0) {
      setPolylines(new Map())
      return
    }
    let cancelled = false

    void (async () => {
      const sorted = [...stays].sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0))
      const homeRouteByCp: Record<string, SegmentPolylineSource> = {}
      const legRouteByPair: Record<string, SegmentPolylineSource> = {}

      const loadHomeRoute = async (cpId: string) => {
        if (homeRouteByCp[cpId]) return
        const cached = await getCachedRoute(userId, cpId)
        if (cached) {
          homeRouteByCp[cpId] = {
            encodedPolyline: cached.encoded_polyline,
            returnEncodedPolyline: cached.return_encoded_polyline,
            provider: cached.provider,
          }
          return
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) return
        try {
          const res = await fetch('/api/routes/campingplatz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campingplatzId: cpId }),
          })
          const data = (await res.json()) as {
            success?: boolean
            data?: {
              distanceKm: number
              durationMinutes: number
              provider?: 'google' | 'haversine'
              encodedPolyline?: string | null
              returnEncodedPolyline?: string | null
            }
          }
          const incoming = parseCampingplatzRouteApiData(data.data)
          if (!data.success || !incoming) return
          homeRouteByCp[cpId] = incoming
          await cacheRoute(userId, routeInfoToCacheEntry(userId, cpId, incoming))
        } catch {
          /* ignore */
        }
      }

      for (const stay of sorted) {
        await loadHomeRoute(stay.campingplatz.id)
      }

      for (let i = 0; i < sorted.length - 1; i++) {
        const fromStay = sorted[i]
        const toStay = sorted[i + 1]
        if (!fromStay || !toStay || fromStay.campingplatz.id === toStay.campingplatz.id) continue
        const pairKey = `${fromStay.id}|${toStay.id}`
        if (legRouteByPair[pairKey]) continue
        const cached = await getCachedSegmentRoute(
          fromStay.campingplatz.id,
          toStay.campingplatz.id
        )
        if (cached) {
          legRouteByPair[pairKey] = {
            encodedPolyline: cached.encoded_polyline,
            provider: cached.provider,
          }
          continue
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) continue
        try {
          const res = await fetch('/api/routes/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromId: fromStay.campingplatz.id,
              toId: toStay.campingplatz.id,
            }),
          })
          const data = (await res.json()) as {
            success?: boolean
            data?: {
              distanceKm: number
              durationMinutes: number
              provider?: 'google' | 'haversine'
              encodedPolyline?: string | null
            }
          }
          const incoming = parseCampingplatzRouteApiData(data.data)
          if (!data.success || !incoming) continue
          legRouteByPair[pairKey] = incoming
          await cacheSegmentRoute(
            routeInfoToSegmentCacheEntry(
              fromStay.campingplatz.id,
              toStay.campingplatz.id,
              incoming
            )
          )
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) {
        setPolylines(buildSegmentPolylinesMap(stays, homeCoords, homeRouteByCp, legRouteByPair))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, stays, homeCoords])

  return polylines
}
