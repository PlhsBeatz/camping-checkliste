import { haversineDistanceKm } from '@/lib/routes'
import type { Campingplatz, Vacation, VacationCampingStay } from '@/lib/db'
import { normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'
import { getDepartureDate } from '@/lib/trip-readiness'

export type RoutePoint = {
  lat: number
  lng: number
  label: string
  kind: 'home' | 'camping'
  campingplatzId?: string
}

export type TravelSegment = {
  id: string
  from: RoutePoint
  to: RoutePoint
  label: string
}

/** Abstand eines Punktes zur Geraden zwischen zwei Koordinaten (Cross-Track, km). */
export function crossTrackDistanceKm(
  point: { lat: number; lng: number },
  segStart: { lat: number; lng: number },
  segEnd: { lat: number; lng: number }
): number {
  const d13 = haversineDistanceKm({
    lat1: segStart.lat,
    lng1: segStart.lng,
    lat2: point.lat,
    lng2: point.lng,
  })
  const d12 = haversineDistanceKm({
    lat1: segStart.lat,
    lng1: segStart.lng,
    lat2: segEnd.lat,
    lng2: segEnd.lng,
  })
  if (d12 < 0.001) {
    return d13
  }
  const d23 = haversineDistanceKm({
    lat1: segEnd.lat,
    lng1: segEnd.lng,
    lat2: point.lat,
    lng2: point.lng,
  })
  const a = Math.acos(
    Math.min(
      1,
      Math.max(
        -1,
        (d12 * d12 + d13 * d13 - d23 * d23) / (2 * d12 * d13 || 1)
      )
    )
  )
  return Math.abs(d13 * Math.sin(a))
}

/** Liegt der Punkt im Korridor entlang des Segments (± maxKm)? */
export function isPointInSegmentCorridor(
  point: { lat: number; lng: number },
  segStart: { lat: number; lng: number },
  segEnd: { lat: number; lng: number },
  maxKm = 20
): boolean {
  const cross = crossTrackDistanceKm(point, segStart, segEnd)
  if (cross > maxKm) return false
  const dStart = haversineDistanceKm({
    lat1: segStart.lat,
    lng1: segStart.lng,
    lat2: point.lat,
    lng2: point.lng,
  })
  const dEnd = haversineDistanceKm({
    lat1: segEnd.lat,
    lng1: segEnd.lng,
    lat2: point.lat,
    lng2: point.lng,
  })
  const segLen = haversineDistanceKm({
    lat1: segStart.lat,
    lng1: segStart.lng,
    lat2: segEnd.lat,
    lng2: segEnd.lng,
  })
  return dStart <= segLen + maxKm && dEnd <= segLen + maxKm
}

function campingToPoint(cp: Campingplatz): RoutePoint | null {
  if (cp.lat == null || cp.lng == null) return null
  return {
    lat: cp.lat,
    lng: cp.lng,
    label: cp.name,
    kind: 'camping',
    campingplatzId: cp.id,
  }
}

/** Alle Fahrtsegmente eines Urlaubs (Heimat → erster Platz → … → letzter Platz). */
export function buildVacationSegments(
  stays: VacationCampingStay[],
  homeCoords?: { lat: number; lng: number } | null
): TravelSegment[] {
  const sorted = [...stays].sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0))
  const points: RoutePoint[] = []
  if (homeCoords?.lat != null && homeCoords.lng != null) {
    points.push({
      lat: homeCoords.lat,
      lng: homeCoords.lng,
      label: 'Zuhause',
      kind: 'home',
    })
  }
  for (const stay of sorted) {
    const p = campingToPoint(stay.campingplatz)
    if (p) points.push(p)
  }
  const segments: TravelSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!
    const to = points[i + 1]!
    segments.push({
      id: `${from.kind}-${i}-${to.kind}-${i + 1}`,
      from,
      to,
      label: `${from.label} → ${to.label}`,
    })
  }
  return segments
}

/** Fahrtsegment vom letzten Campingplatz zurück nach Hause. */
export function buildReturnHomeSegment(
  lastCamping: Campingplatz,
  homeCoords: { lat: number; lng: number }
): TravelSegment | null {
  const from = campingToPoint(lastCamping)
  if (!from) return null
  return {
    id: 'return-home',
    from,
    to: {
      lat: homeCoords.lat,
      lng: homeCoords.lng,
      label: 'Zuhause',
      kind: 'home',
    },
    label: `${from.label} → Zuhause`,
  }
}

/** Aktives Segment anhand GPS-Position (nächstes Segment). */
export function findActiveSegment(
  segments: TravelSegment[],
  position: { lat: number; lng: number }
): TravelSegment | null {
  if (segments.length === 0) return null
  let best: TravelSegment | null = null
  let bestScore = Infinity
  for (const seg of segments) {
    const cross = crossTrackDistanceKm(position, seg.from, seg.to)
    const onCorridor = isPointInSegmentCorridor(position, seg.from, seg.to)
    if (!onCorridor) continue
    if (cross < bestScore) {
      bestScore = cross
      best = seg
    }
  }
  return best
}

/** Liegt Position auf einem Reisesegment des Urlaubs? */
export function isOnVacationRoute(
  segments: TravelSegment[],
  position: { lat: number; lng: number },
  maxKm = 20
): boolean {
  return segments.some((seg) =>
    isPointInSegmentCorridor(position, seg.from, seg.to, maxKm)
  )
}

/** Heute ein Reisetag (Abfahrt bis Ende)? */
export function isTravelDayToday(vacation: Vacation, now = new Date()): boolean {
  const today = todayInAppTimezone(now)
  const departure = normalizeCalendarDate(getDepartureDate(vacation))
  const end = normalizeCalendarDate(vacation.enddatum)
  if (!departure || !end) return false
  return today >= departure && today <= end
}

export type TravelLegPhase = 'next' | 'past' | 'future'

function sortedStays(stays: VacationCampingStay[]): VacationCampingStay[] {
  return [...stays].sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0))
}

/** Streckenabschnitte in der Reihenfolge der Urlaubs-Detailseite. */
export function collectDisplayedTravelSegments(
  stays: VacationCampingStay[],
  travelSegments: TravelSegment[],
  returnSegment: TravelSegment | null
): TravelSegment[] {
  const sorted = sortedStays(stays)
  const result: TravelSegment[] = []

  const firstStay = sorted[0]
  if (firstStay) {
    const homeSeg = travelSegments.find(
      (s) =>
        s.from.kind === 'home' && s.to.campingplatzId === firstStay.campingplatz.id
    )
    if (homeSeg) result.push(homeSeg)
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const fromStay = sorted[i]!
    const toStay = sorted[i + 1]!
    if (fromStay.campingplatz.id === toStay.campingplatz.id) continue
    const seg = travelSegments.find(
      (s) =>
        s.from.campingplatzId === fromStay.campingplatz.id &&
        s.to.campingplatzId === toStay.campingplatz.id
    )
    if (seg) result.push(seg)
  }

  if (returnSegment) result.push(returnSegment)

  return result
}

function isTravelSegmentPast(
  segment: TravelSegment,
  vacation: Vacation,
  stays: VacationCampingStay[],
  today: string
): boolean {
  const sorted = sortedStays(stays)

  if (segment.id === 'return-home') {
    const lastStay = sorted[sorted.length - 1]
    const endDate = normalizeCalendarDate(lastStay?.end_datum || vacation.enddatum)
    if (endDate) return today > endDate
    const vacationEnd = normalizeCalendarDate(vacation.enddatum)
    return vacationEnd ? today > vacationEnd : false
  }

  if (segment.from.kind === 'home') {
    const firstStay = sorted[0]
    const arrival = normalizeCalendarDate(firstStay?.start_datum)
    if (arrival) return today > arrival
    const departure = normalizeCalendarDate(getDepartureDate(vacation))
    return departure ? today > departure : false
  }

  const destinationId = segment.to.campingplatzId
  const toStay = sorted.find((s) => s.campingplatz.id === destinationId)
  const arrival = normalizeCalendarDate(toStay?.start_datum)
  if (arrival) return today > arrival

  return false
}

/** Phase pro Streckenabschnitt: nächster offen, vergangene und spätere zugeklappt. */
export function getTravelLegPhases(
  vacation: Vacation,
  stays: VacationCampingStay[],
  travelSegments: TravelSegment[],
  returnSegment: TravelSegment | null,
  now = new Date()
): Map<string, TravelLegPhase> {
  const today = todayInAppTimezone(now)
  const displayed = collectDisplayedTravelSegments(stays, travelSegments, returnSegment)
  const phases = new Map<string, TravelLegPhase>()

  let nextAssigned = false
  for (const segment of displayed) {
    const isPast = isTravelSegmentPast(segment, vacation, stays, today)
    if (isPast) {
      phases.set(segment.id, 'past')
    } else if (!nextAssigned) {
      phases.set(segment.id, 'next')
      nextAssigned = true
    } else {
      phases.set(segment.id, 'future')
    }
  }

  return phases
}
