'use client'

import { useMemo } from 'react'
import type { Rastplatz } from '@/lib/db'
import { isPointInSegmentCorridor, type TravelLegPhase, type TravelSegment } from '@/lib/travel-segment'
import { isPointNearAnyEncodedPolyline, isPointNearEncodedPolyline } from '@/lib/route-polyline'
import {
  ADAC_MAX_WAYPOINTS,
  GOOGLE_MAPS_MAX_WAYPOINTS_MOBILE,
  openSegmentInAdacMaps,
  openSegmentInGoogleMaps,
} from '@/lib/maps-export'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react'
import { merkmalLabel } from '@/lib/rastplatz-merkmale'
import { cn } from '@/lib/utils'

export type SegmentRouteMatchOptions = {
  encodedPolyline?: string | null
  /** Zusätzliche Polylines (z. B. Hinfahrt bei Roundtrip zum selben Platz). */
  alternateEncodedPolylines?: Array<string | null | undefined>
  routeProvider?: 'google' | 'haversine' | null
}

export function isRastplatzOnTravelSegment(
  r: Rastplatz,
  segment: TravelSegment,
  match?: SegmentRouteMatchOptions | string | null
): boolean {
  if (r.is_archived || r.lat == null || r.lng == null) return false
  const point = { lat: r.lat, lng: r.lng }
  const options: SegmentRouteMatchOptions =
    typeof match === 'string' || match === null || match === undefined
      ? { encodedPolyline: match }
      : match

  const polylines = [
    options.encodedPolyline,
    ...(options.alternateEncodedPolylines ?? []),
  ].filter((p): p is string => !!p?.trim())

  if (polylines.length > 0) {
    return isPointNearAnyEncodedPolyline(point, polylines)
  }
  // Ohne Polyline: nur bei Haversine-Fallback (keine echte Route). Während des Ladens nichts anzeigen.
  if (options.routeProvider === 'haversine') {
    return isPointInSegmentCorridor(point, segment.from, segment.to)
  }
  return false
}

export function getRastplaetzeAlongSegment(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  match?: SegmentRouteMatchOptions | string | null
): Rastplatz[] {
  return rastplaetze.filter((r) => isRastplatzOnTravelSegment(r, segment, match))
}

export function defaultSegmentRastOpen(phase: TravelLegPhase): boolean {
  return phase === 'next'
}

export function resolveSegmentRastOpen(
  segmentId: string,
  phase: TravelLegPhase,
  overrides: Record<string, boolean>
): boolean {
  const override = overrides[segmentId]
  if (override !== undefined) return override
  return defaultSegmentRastOpen(phase)
}

export function getVisibleRastplaetzeForExpandedSegments(
  segments: TravelSegment[],
  rastplaetze: Rastplatz[],
  phases: Map<string, TravelLegPhase>,
  expandedOverrides: Record<string, boolean>,
  segmentRouteMatch: Map<string, SegmentRouteMatchOptions>
): Rastplatz[] {
  const byId = new Map<string, Rastplatz>()
  for (const segment of segments) {
    const phase = phases.get(segment.id) ?? 'future'
    if (!resolveSegmentRastOpen(segment.id, phase, expandedOverrides)) continue
    const match = segmentRouteMatch.get(segment.id)
    for (const r of getRastplaetzeAlongSegment(segment, rastplaetze, match)) {
      byId.set(r.id, r)
    }
  }
  return [...byId.values()]
}

interface SegmentRastSuggestionsProps {
  segment: TravelSegment
  rastplaetze: Rastplatz[]
  routeMatch?: SegmentRouteMatchOptions
}

export function SegmentRastSuggestions({
  segment,
  rastplaetze,
  routeMatch,
}: SegmentRastSuggestionsProps) {
  const alongRoute = useMemo(
    () => getRastplaetzeAlongSegment(segment, rastplaetze, routeMatch),
    [routeMatch, rastplaetze, segment]
  )

  const empfehlungen = alongRoute.filter((r) => r.bewertung === 'empfehlung')
  const noGos = alongRoute.filter((r) => r.bewertung === 'no_go')

  if (alongRoute.length === 0) return null

  const openGoogleWithWaypoints = () => {
    openSegmentInGoogleMaps(
      segment,
      rastplaetze,
      GOOGLE_MAPS_MAX_WAYPOINTS_MOBILE,
      routeMatch?.encodedPolyline,
      routeMatch?.routeProvider
    )
  }

  const openAdacWithWaypoints = () => {
    openSegmentInAdacMaps(
      segment,
      rastplaetze,
      ADAC_MAX_WAYPOINTS,
      routeMatch?.encodedPolyline,
      routeMatch?.routeProvider
    )
  }

  return (
    <div className="ml-8 mr-2 mb-2 pl-2 border-l-2 border-dashed border-muted-foreground/30 space-y-1">
      {empfehlungen.map((r) => (
        <div key={r.id} className="text-xs flex items-center gap-1 text-green-800">
          <ThumbsUp className="h-3 w-3 shrink-0" />
          <span className="truncate">{r.name}</span>
          {r.merkmale.slice(0, 2).map((m) => (
            <span key={m} className="text-[10px] opacity-70">
              · {merkmalLabel(m)}
            </span>
          ))}
        </div>
      ))}
      {noGos.map((r) => (
        <div key={r.id} className="text-xs flex items-center gap-1 text-red-700 line-through opacity-80">
          <ThumbsDown className="h-3 w-3 shrink-0" />
          <span className="truncate">{r.name}</span>
        </div>
      ))}
      {empfehlungen.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openGoogleWithWaypoints}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Google Maps
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openAdacWithWaypoints}>
            <ExternalLink className="h-3 w-3 mr-1" />
            ADAC
          </Button>
        </div>
      )}
      {empfehlungen.length > 3 && (
        <p className={cn('text-[10px] text-muted-foreground')}>
          Google Maps (mobil): max. 3 Zwischenziele — es werden die ersten entlang der Strecke genutzt.
        </p>
      )}
    </div>
  )
}
