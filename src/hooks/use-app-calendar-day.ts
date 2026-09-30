'use client'

import { useEffect, useState } from 'react'
import { todayInAppTimezone } from '@/lib/app-timezone'

/**
 * Aktueller Kalendertag (Europe/Berlin). Aktualisiert sich bei App-Wiederaufnahme
 * ohne Netzwerk – für Countdowns / Aktuell-vs-Archiv-Filter.
 */
export function useAppCalendarDay(): string {
  const [day, setDay] = useState(() => todayInAppTimezone())

  useEffect(() => {
    const sync = () => {
      const next = todayInAppTimezone()
      setDay((prev) => (prev === next ? prev : next))
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) sync()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  return day
}
