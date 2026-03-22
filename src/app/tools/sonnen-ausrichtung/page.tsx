'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { SonnenAusrichtungCompass } from '@/components/sonnen-ausrichtung-compass'
import { Button } from '@/components/ui/button'
import { Menu, MapPin, Compass } from 'lucide-react'
import {
  extractCompassHeadingDeg,
  normalizeHeadingDeg,
  type DeviceOrientationEventWithWebkit,
} from '@/lib/device-compass-heading'

/** Kürzeste Winkeldifferenz (robust gegen 0°/360°-Sprünge, kein JS-%-Bug) */
function shortestAngleDiff(from: number, to: number): number {
  let diff = to - from
  while (diff > 180) diff -= 360
  while (diff < -180) diff += 360
  return diff
}

export default function SonnenAusrichtungPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isLoadingGps, setIsLoadingGps] = useState(true)
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null)
  const [smoothedHeading, setSmoothedHeading] = useState<number | null>(null)
  const smoothedRef = useRef<number | null>(null)
  const rawFilteredRef = useRef<number | null>(null)
  const targetHeadingRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [compassEnabled, setCompassEnabled] = useState(false)
  const [compassPermissionNeeded, setCompassPermissionNeeded] = useState(false)

  const requestCompassPermission = useCallback(async () => {
    if (typeof window === 'undefined') return
    const ev = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (ev.requestPermission) {
      try {
        const result = await ev.requestPermission()
        if (result === 'granted') {
          setCompassEnabled(true)
          setCompassPermissionNeeded(false)
        }
      } catch (err) {
        console.error('Compass permission denied:', err)
      }
    } else {
      setCompassEnabled(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!navigator.geolocation) {
      setGpsError('GPS wird von diesem Browser nicht unterstützt.')
      setIsLoadingGps(false)
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsError(null)
      },
      (err) => {
        if (err.code === 1) {
          setGpsError('Standortzugriff wurde verweigert.')
        } else if (err.code === 2) {
          setGpsError('Standort konnte nicht ermittelt werden.')
        } else {
          setGpsError('Standortfehler: ' + err.message)
        }
      },
      { enableHighAccuracy: true, maximumAge: 60000 }
    )
    setIsLoadingGps(false)
    return () => navigator.geolocation?.clearWatch(watchId)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: DeviceOrientationEvent) => {
      const raw = extractCompassHeadingDeg(event as DeviceOrientationEventWithWebkit)
      if (raw == null) return

      const prev = rawFilteredRef.current
      const RAW_LERP = 0.28
      rawFilteredRef.current =
        prev == null ? raw : normalizeHeadingDeg(prev + shortestAngleDiff(prev, raw) * RAW_LERP)

      setDeviceHeading(rawFilteredRef.current)
    }

    const useAbsolute = 'ondeviceorientationabsolute' in window

    if (useAbsolute) {
      window.addEventListener('deviceorientationabsolute', handler as EventListener)
    }
    window.addEventListener('deviceorientation', handler as EventListener)

    return () => {
      if (useAbsolute) {
        window.removeEventListener('deviceorientationabsolute', handler as EventListener)
      }
      window.removeEventListener('deviceorientation', handler as EventListener)
    }
  }, [])

  // Glättung: Ziel ständig aus State (Ref), RAF-Schleife nur starten/stoppen — nicht bei jedem Sensor-Tick neu
  targetHeadingRef.current = deviceHeading
  useEffect(() => {
    if (deviceHeading == null) {
      setSmoothedHeading(null)
      smoothedRef.current = null
      rawFilteredRef.current = null
      targetHeadingRef.current = null
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    if (smoothedRef.current == null) {
      smoothedRef.current = deviceHeading
      setSmoothedHeading(deviceHeading)
    }

    const DISPLAY_SMOOTH = 0.07
    const tick = () => {
      const target = targetHeadingRef.current
      if (target == null) return
      const current = smoothedRef.current ?? target
      const diff = shortestAngleDiff(current, target)
      const next = normalizeHeadingDeg(current + diff * DISPLAY_SMOOTH)
      smoothedRef.current = next
      setSmoothedHeading(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick)
    }
    // Kein cancel bei jedem deviceHeading-Update — sonst ruckelt die Anzeige
  }, [deviceHeading])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ev = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (ev.requestPermission && !compassEnabled) {
      setCompassPermissionNeeded(true)
    } else if (!ev.requestPermission) {
      setCompassEnabled(true)
    } else if (compassEnabled) {
      setCompassPermissionNeeded(false)
    }
  }, [compassEnabled])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex items-center gap-4 h-14 px-4 bg-white border-b border-gray-200">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Menü öffnen"
            onClick={() => setShowNavSidebar(true)}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Sonnen-Ausrichtung</h1>
        </header>

        <main className="p-4 md:p-6 pt-8">
          {isLoadingGps && (
            <div className="flex items-center gap-2 text-gray-600 py-8">
              <MapPin className="w-5 h-5 animate-pulse" />
              <span>Standort wird ermittelt…</span>
            </div>
          )}

          {gpsError && !position && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
              <p className="font-medium">GPS nicht verfügbar</p>
              <p className="text-sm mt-1">{gpsError}</p>
              <p className="text-sm mt-2">Bitte erlauben Sie den Standortzugriff in den Browser-Einstellungen.</p>
            </div>
          )}

          {compassPermissionNeeded && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-800 mb-4">
              <p className="font-medium">Kompass aktivieren</p>
              <p className="text-sm mt-1">
                Für die dynamische Ausrichtung wird die absolute Kompass-Orientierung benötigt (nach
                Tipp auf „Kompass aktivieren“).
              </p>
              <Button
                onClick={requestCompassPermission}
                className="mt-3"
                size="sm"
              >
                <Compass className="w-4 h-4 mr-2" />
                Kompass aktivieren
              </Button>
            </div>
          )}

          {position && (
            <div className="pt-6 space-y-3">
              <p className="text-sm text-gray-600 max-w-xl">
                <strong className="text-gray-800">Nordrichtung:</strong> Es wird nur die{' '}
                <strong>absolute</strong> Kompass-Orientierung (Magnetometer) ausgewertet, nicht die
                relative Drehung seit dem Laden der Seite. Dadurch bleibt Nord stabil, auch nach
                einem Neuladen. Am besten das Gerät waagerecht halten.
              </p>
              <SonnenAusrichtungCompass
                lat={position.lat}
                lng={position.lng}
                deviceHeading={smoothedHeading}
              />
            </div>
          )}

          {gpsError && position && (
            <p className="text-sm text-amber-600 mt-2">Hinweis: {gpsError}</p>
          )}
        </main>
      </div>
    </div>
  )
}
