'use client'

import { useEffect, useRef, useState } from 'react'

interface Options {
  /** Wird aufgerufen, sobald der User weit genug nach unten gezogen hat. */
  onRefresh: () => Promise<void> | void
  /** Mindest-Pull-Distanz in Pixel, ab der der Refresh ausgelöst wird. */
  threshold?: number
  /** Maximale Anzeige-Distanz (begrenzt die visuelle Spannung). */
  maxPull?: number
  /** Hook deaktivieren (z. B. wenn Sidebar offen ist). */
  disabled?: boolean
}

interface State {
  /** Aktuelle Pull-Distanz in Pixel (0 wenn untätig oder beim Refresh). */
  pull: number
  /** True solange `onRefresh` läuft. */
  isRefreshing: boolean
  /** Bind-Props für das Container-Element (`<div {...bind} />`). */
  bind: React.HTMLAttributes<HTMLElement>
}

/**
 * Pull-to-refresh-Geste auf Touch-Devices.
 *
 * Verhalten:
 * - Aktiv nur ganz oben in der Seite (`window.scrollY < 1`).
 * - Beim Touchstart wird die Position gemerkt; beim Move wird die Distanz berechnet
 *   (mit dem üblichen "Gummiband"-Damping).
 * - Wenn beim Loslassen `pull >= threshold`, wird `onRefresh()` ausgelöst.
 *
 * Auf Desktops (kein Touch) ist der Hook ein No-Op.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  maxPull = 140,
  disabled = false,
}: Options): State {
  const [pull, setPull] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (disabled) {
      setPull(0)
      startY.current = null
    }
  }, [disabled])

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return
    if (typeof window !== 'undefined' && window.scrollY > 0) return
    const t = e.touches[0]
    if (!t) return
    startY.current = t.clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return
    if (startY.current == null) return
    const t = e.touches[0]
    if (!t) return
    const delta = t.clientY - startY.current
    if (delta <= 0) {
      setPull(0)
      return
    }
    // Damping (Gummiband)
    const damped = Math.min(maxPull, delta * 0.5)
    setPull(damped)
  }

  const onTouchEnd = () => {
    if (disabled || isRefreshing) return
    if (startY.current == null) return
    const value = pull
    startY.current = null
    if (value >= threshold) {
      setIsRefreshing(true)
      setPull(threshold) // visuell auf Schwelle halten
      Promise.resolve(onRefreshRef.current())
        .catch(() => {
          /* Aufrufer kümmert sich um Fehler */
        })
        .finally(() => {
          setIsRefreshing(false)
          setPull(0)
        })
    } else {
      setPull(0)
    }
  }

  return {
    pull,
    isRefreshing,
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  }
}
