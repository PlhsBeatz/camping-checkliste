'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Vacation, VacationCampingStay } from '@/lib/db'
import { findRelevantVacation, getTripPhase } from '@/lib/trip-readiness'
import {
  buildVacationSegments,
  findActiveSegment,
  isOnVacationRoute,
  isTravelDayToday,
  type TravelSegment,
} from '@/lib/travel-segment'
import { cacheLastPosition } from '@/lib/offline-db'
import { haversineDistanceKm } from '@/lib/routes'
import {
  DEFAULT_REISE_GPS_MODE,
  isReiseFeatureActive,
  isReiseGpsActive,
  type ReiseGpsMode,
} from '@/lib/reise-gps-settings'

const STATIONARY_DWELL_MS = 45_000
const STATIONARY_MAX_SPEED_MS = 1.0
const STATIONARY_MAX_DRIFT_M = 30
const POSITION_HISTORY_MAX = 20

export type ReiseModusState = {
  /** GPS läuft gerade (Profil-Einstellung angewendet) */
  enabled: boolean
  /** Reise-Features (Hinweise, Panel) aktiv */
  featureActive: boolean
  gpsMode: ReiseGpsMode
  position: { lat: number; lng: number } | null
  isStationary: boolean
  gpsError: string | null
  relevantVacation: Vacation | null
  tripPhase: ReturnType<typeof getTripPhase> | null
  segments: TravelSegment[]
  activeSegment: TravelSegment | null
  onRoute: boolean
  isTravelContext: boolean
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  return haversineDistanceKm({ lat1: a.lat, lng1: a.lng, lat2: b.lat, lng2: b.lng }) * 1000
}

export function useReiseModus(
  vacations: Vacation[],
  stays: VacationCampingStay[],
  homeCoords: { lat: number; lng: number } | null,
  gpsMode: ReiseGpsMode = DEFAULT_REISE_GPS_MODE
): ReiseModusState {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isStationary, setIsStationary] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const historyRef = useRef<Array<{ lat: number; lng: number; t: number; speed: number | null }>>(
    []
  )
  const dwellAnchorRef = useRef<{ lat: number; lng: number; since: number } | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const relevantVacation = findRelevantVacation(vacations)
  const tripPhase = relevantVacation ? getTripPhase(relevantVacation) : null
  const isTravelContext =
    !!relevantVacation &&
    !!tripPhase &&
    (tripPhase === 'on_trip' || tripPhase === 'departure_day') &&
    isTravelDayToday(relevantVacation)

  const segments =
    relevantVacation && stays.length > 0 ? buildVacationSegments(stays, homeCoords) : []

  const activeSegment = position ? findActiveSegment(segments, position) : null
  const onRoute = position ? isOnVacationRoute(segments, position) : false

  const gpsActive = useMemo(
    () => isReiseGpsActive(gpsMode, isTravelContext),
    [gpsMode, isTravelContext]
  )
  const featureActive = useMemo(
    () => isReiseFeatureActive(gpsMode, isTravelContext),
    [gpsMode, isTravelContext]
  )

  const manageWakeLock = useCallback(async (active: boolean) => {
    if (active && isTravelContext && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        /* optional */
      }
      return
    }
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {
        /* ignore */
      }
      wakeLockRef.current = null
    }
  }, [isTravelContext])

  useEffect(() => {
    void manageWakeLock(gpsActive)
    return () => {
      void manageWakeLock(false)
    }
  }, [gpsActive, manageWakeLock])

  useEffect(() => {
    if (!gpsActive) {
      setIsStationary(false)
      setGpsError(null)
      dwellAnchorRef.current = null
      return
    }
    if (!navigator.geolocation) {
      setGpsError('GPS nicht verfügbar')
      return
    }

    const evaluateStationary = (next: { lat: number; lng: number }, t: number, speed: number | null) => {
      const anchor = dwellAnchorRef.current
      if (!anchor || distanceMeters(anchor, next) > STATIONARY_MAX_DRIFT_M) {
        dwellAnchorRef.current = { lat: next.lat, lng: next.lng, since: t }
        setIsStationary(false)
        return
      }

      const hist = historyRef.current
      hist.push({ ...next, t, speed })
      if (hist.length > POSITION_HISTORY_MAX) hist.shift()

      const cutoff = t - STATIONARY_DWELL_MS
      const recent = hist.filter((h) => h.t >= cutoff)

      const speeds = recent
        .map((h) => h.speed)
        .filter((s): s is number => s != null && !Number.isNaN(s))
      const avgSpeed =
        speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null
      const slowByGps = avgSpeed != null && avgSpeed < STATIONARY_MAX_SPEED_MS

      const dwellMs = t - anchor.since
      const slowByDwell = dwellMs >= STATIONARY_DWELL_MS

      setIsStationary(slowByGps || slowByDwell)
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const speed = pos.coords.speed
        const t = Date.now()
        setPosition(next)
        setGpsError(null)
        cacheLastPosition(next.lat, next.lng).catch(() => {})
        evaluateStationary(next, t, speed ?? null)
      },
      (err) => {
        if (err.code === 1) setGpsError('Standort verweigert')
        else setGpsError('Standortfehler')
        setIsStationary(false)
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    )

    /** DevTools-/Simulator-Standort feuert selten – Verweildauer trotzdem prüfen. */
    const dwellTimer = window.setInterval(() => {
      const anchor = dwellAnchorRef.current
      if (!anchor) return
      if (Date.now() - anchor.since >= STATIONARY_DWELL_MS) {
        setIsStationary(true)
      }
    }, 5000)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      window.clearInterval(dwellTimer)
      historyRef.current = []
      dwellAnchorRef.current = null
    }
  }, [gpsActive])

  return {
    enabled: gpsActive,
    featureActive,
    gpsMode,
    position,
    isStationary,
    gpsError,
    relevantVacation,
    tripPhase,
    segments,
    activeSegment,
    onRoute,
    isTravelContext,
  }
}
