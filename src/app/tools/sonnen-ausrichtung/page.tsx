'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { SonnenAusrichtungCompass } from '@/components/sonnen-ausrichtung-compass'
import { Button } from '@/components/ui/button'
import { Menu, MapPin, Compass } from 'lucide-react'

interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

/** Kürzeste Winkeldifferenz (für Glättung über 0°/360°-Grenze) */
function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % 360
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
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
    const handler = (event: DeviceOrientationEvent) => {
      const ev = event as DeviceOrientationEventWithWebkit
      if (typeof ev.webkitCompassHeading === 'number') {
        setDeviceHeading(ev.webkitCompassHeading)
      } else if (typeof ev.alpha === 'number') {
        const heading = ev.absolute ? (360 - ev.alpha) % 360 : (360 - ev.alpha + 360) % 360
        setDeviceHeading(heading)
      }
    }

    const handlerAbsolute = (event: DeviceOrientationEvent) => {
      if (typeof event.alpha === 'number') {
        setDeviceHeading((360 - event.alpha + 360) % 360)
      }
    }

    window.addEventListener('deviceorientation', handler)
    try {
      window.addEventListener('deviceorientationabsolute', handlerAbsolute as EventListener)
    } catch {
      // deviceorientationabsolute not supported
    }
    return () => {
      window.removeEventListener('deviceorientation', handler)
      try {
        window.removeEventListener('deviceorientationabsolute', handlerAbsolute as EventListener)
      } catch {
        // ignore
      }
    }
  }, [])

  // Glättung: sanft von smoothedHeading zu deviceHeading interpolieren
  targetHeadingRef.current = deviceHeading
  useEffect(() => {
    if (deviceHeading == null) {
      setSmoothedHeading(null)
      smoothedRef.current = null
      targetHeadingRef.current = null
      return
    }
    if (smoothedRef.current == null) {
      smoothedRef.current = deviceHeading
      setSmoothedHeading(deviceHeading)
    }
    const SMOOTHING = 0.12
    const tick = () => {
      const target = targetHeadingRef.current
      if (target == null) return
      const current = smoothedRef.current ?? target
      const diff = shortestAngleDiff(current, target)
      const next = (current + diff * SMOOTHING + 360) % 360
      smoothedRef.current = next
      setSmoothedHeading(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
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
              <p className="text-sm mt-1">{'Für die dynamische Ausrichtung des Kompass wird die Geräte-Orientierung benötigt.'}</p>
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
            <div className="pt-6">
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
