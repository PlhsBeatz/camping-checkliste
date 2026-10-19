'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ApiResponse } from '@/lib/api-types'
import type { Rastplatz, Vacation, VacationCampingStay } from '@/lib/db'
import { findRelevantVacation, getTripPhase } from '@/lib/trip-readiness'
import { isGpsTravelDay, isTravelDayToday } from '@/lib/travel-segment'
import { getCachedVacations } from '@/lib/offline-sync'
import { useAuth } from '@/components/auth-provider'
import { ReiseRastPanel } from '@/components/reise-rast-panel'
import { useReiseModus, type ReiseModusState } from '@/hooks/use-reise-modus'
import { useReiseRoutePolylines } from '@/hooks/use-reise-route-polylines'
import { useUserReiseGpsSettings } from '@/hooks/use-user-reise-gps-settings'
import { useVerbrauchEndstandHomeAlert } from '@/hooks/use-verbrauch-endstand-home-alert'
import { usePushSubscribe } from '@/hooks/use-push-subscribe'
import { useUserPushSettings } from '@/hooks/use-user-push-settings'
import { canReceiveVerbrauchEndstandPush } from '@/lib/push-settings'
import { toast } from 'sonner'

const ReiseModusContext = createContext<ReiseModusState | null>(null)
const NO_STAYS: VacationCampingStay[] = []

export function useReiseModusContext(): ReiseModusState {
  const value = useContext(ReiseModusContext)
  if (!value) {
    throw new Error('useReiseModusContext nur innerhalb von ReiseModusProvider')
  }
  return value
}

/**
 * GPS-Reise-Modus für die ganze App.
 * Früher lief die Rast-Erkennung nur auf der Packliste. Der Startbildschirm ist
 * inzwischen der Heute-Hub – ohne diesen Provider kam der Vorschlag beim Öffnen nicht.
 */
export function ReiseModusProvider({ children }: { children: ReactNode }) {
  const { user, canAccessConfig } = useAuth()
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [stays, setStays] = useState<VacationCampingStay[]>([])
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [rastPanelDismissed, setRastPanelDismissed] = useState(false)

  useEffect(() => {
    if (!user) {
      setVacations([])
      setStays([])
      setHomeCoords(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/vacations')
        const json = (await res.json()) as ApiResponse<Vacation[]>
        if (!cancelled && json.success && json.data) {
          setVacations(json.data)
          return
        }
      } catch {
        /* Cache unten */
      }
      try {
        const cached = await getCachedVacations()
        if (!cancelled && cached.length > 0) setVacations(cached)
      } catch {
        /* ignore */
      }
    })()
    void (async () => {
      try {
        const res = await fetch('/api/profile/home-location')
        const json = (await res.json()) as ApiResponse<{
          heimat_lat: number | null
          heimat_lng: number | null
        }>
        if (
          !cancelled &&
          json.success &&
          json.data?.heimat_lat != null &&
          json.data.heimat_lng != null
        ) {
          setHomeCoords({ lat: json.data.heimat_lat, lng: json.data.heimat_lng })
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const relevantVacation = useMemo(() => findRelevantVacation(vacations), [vacations])
  const needsTravelRoute = useMemo(() => {
    if (!relevantVacation) return false
    const phase = getTripPhase(relevantVacation)
    return (
      (phase === 'on_trip' || phase === 'departure_day') && isTravelDayToday(relevantVacation)
    )
  }, [relevantVacation])

  useEffect(() => {
    if (!needsTravelRoute || !relevantVacation) {
      setStays([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/vacations/${relevantVacation.id}`)
        const json = (await res.json()) as ApiResponse<{ stays?: VacationCampingStay[] }>
        if (!cancelled) setStays(json.success && json.data?.stays ? json.data.stays : [])
      } catch {
        if (!cancelled) setStays([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [needsTravelRoute, relevantVacation])

  const gpsTravelDay = useMemo(() => {
    if (!needsTravelRoute || !relevantVacation) return false
    return isGpsTravelDay(relevantVacation, stays, homeCoords)
  }, [needsTravelRoute, relevantVacation, stays, homeCoords])

  const polylines = useReiseRoutePolylines(
    gpsTravelDay ? user?.id : null,
    gpsTravelDay ? stays : NO_STAYS,
    homeCoords
  )
  const { mode: gpsMode } = useUserReiseGpsSettings()
  const reiseModus = useReiseModus(vacations, stays, homeCoords, gpsMode, polylines)
  const pushSubscribe = usePushSubscribe()
  const { settings: pushSettings } = useUserPushSettings(pushSubscribe.subscribed)
  const endstandPushEnabled =
    pushSettings != null &&
    canReceiveVerbrauchEndstandPush(pushSettings, pushSubscribe.subscribed)

  useVerbrauchEndstandHomeAlert({
    enabled: reiseModus.featureActive && endstandPushEnabled,
    position: reiseModus.position,
    homeCoords,
    activeSegment: reiseModus.activeSegment,
    vacationId: reiseModus.relevantVacation?.id ?? null,
    isStationary: reiseModus.isStationary,
  })

  useEffect(() => {
    if (!reiseModus.isStationary) setRastPanelDismissed(false)
  }, [reiseModus.isStationary])

  useEffect(() => {
    if (!reiseModus.featureActive || reiseModus.gpsError !== 'Standort verweigert') return
    toast.error('Standort verweigert – der Rastplatz-Vorschlag braucht den Standort.')
  }, [reiseModus.featureActive, reiseModus.gpsError])

  const showRastPanel =
    canAccessConfig &&
    reiseModus.featureActive &&
    reiseModus.canCaptureRast &&
    reiseModus.isStationary &&
    reiseModus.position != null &&
    !rastPanelDismissed

  return (
    <ReiseModusContext.Provider value={reiseModus}>
      {children}
      {reiseModus.position && (
        <ReiseRastPanel
          visible={showRastPanel}
          position={reiseModus.position}
          vacationId={reiseModus.relevantVacation?.id ?? null}
          onDismiss={() => setRastPanelDismissed(true)}
          onSaved={(saved: Rastplatz) => {
            window.dispatchEvent(new CustomEvent('rastplatz-saved', { detail: saved }))
          }}
        />
      )}
    </ReiseModusContext.Provider>
  )
}
