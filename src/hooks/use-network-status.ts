'use client'

import { useEffect, useState, useCallback } from 'react'

export interface NetworkStatus {
  /** "Wahrscheinlich online" – kombiniert navigator.onLine + Probe-Ergebnis. */
  online: boolean
  /** Ergebnis des letzten Probe-Aufrufs. `null`, solange noch keine Probe lief. */
  probeOk: boolean | null
  /** Letzter Zeitstempel einer erfolgreichen Probe. */
  lastOnlineAt: number | null
  /** Manuell eine Probe auslösen. */
  refresh: () => Promise<void>
}

const PROBE_URL = '/api/health'
const PROBE_TIMEOUT_MS = 4000
const PROBE_INTERVAL_MS = 30_000

/**
 * Zentraler Online-Status-Hook.
 *
 * Kombiniert:
 * - `navigator.onLine` (instant – aber unzuverlässig: Captive Portal, Mobilfunk ohne Daten)
 * - `online`/`offline`-Events
 * - periodische HTTP-Probe gegen `/api/health` (echte Konnektivität)
 *
 * `online` ist `true`, sobald entweder `navigator.onLine` true ist UND die Probe geklappt hat,
 * oder solange noch keine Probe lief und `navigator.onLine` true ist (optimistisch).
 *
 * Verhalten:
 * - Bei `online`-Event sofort eine Probe.
 * - Bei `offline`-Event sofort `online=false`.
 * - Sonst alle 30 s eine Probe, aber nur wenn das Tab sichtbar ist.
 */
export function useNetworkStatus(): NetworkStatus {
  const initialOnline =
    typeof navigator !== 'undefined' ? navigator.onLine : true
  const [navOnline, setNavOnline] = useState(initialOnline)
  const [probeOk, setProbeOk] = useState<boolean | null>(null)
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null)

  const probe = useCallback(async () => {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
      const res = await fetch(PROBE_URL, {
        method: 'HEAD',
        cache: 'no-store',
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (res.ok) {
        setProbeOk(true)
        setLastOnlineAt(Date.now())
      } else {
        setProbeOk(false)
      }
    } catch {
      setProbeOk(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onOnline = () => {
      setNavOnline(true)
      void probe()
    }
    const onOffline = () => {
      setNavOnline(false)
      setProbeOk(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Initiale Probe direkt nach Mount
    if (navigator.onLine) void probe()

    // Periodische Probe nur, wenn Tab aktiv ist
    let interval: ReturnType<typeof setInterval> | null = null
    const startInterval = () => {
      if (interval !== null) return
      interval = setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          void probe()
        }
      }, PROBE_INTERVAL_MS)
    }
    const stopInterval = () => {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }
    startInterval()
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (navigator.onLine) void probe()
        startInterval()
      } else {
        stopInterval()
      }
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVis)
      stopInterval()
    }
  }, [probe])

  // Optimistisch: solange Probe noch nicht lief, glauben wir navigator.onLine.
  const online = navOnline && probeOk !== false

  return {
    online,
    probeOk,
    lastOnlineAt,
    refresh: probe,
  }
}
