'use client'

import { useCallback, useEffect, useState } from 'react'
import { BOOKING_IMPORT_CHANGED_EVENT } from '@/lib/booking-import-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

const CACHE_KEY = 'camping-booking-import-badge'
const CACHE_MS = 45_000

function readCache(): number | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { count?: number; at?: number }
    if (typeof parsed.count !== 'number' || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > CACHE_MS) return null
    return parsed.count
  } catch {
    return null
  }
}

function writeCache(count: number) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

function clearCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export function useBookingImportBadge() {
  const [count, setCount] = useState(0)

  const load = useCallback(async (opts?: { bypassCache?: boolean }) => {
    if (!opts?.bypassCache) {
      const cached = readCache()
      if (cached != null) {
        setCount(cached)
        return
      }
    }
    try {
      const res = await fetch('/api/booking-import?count=1', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { success?: boolean; data?: { count?: number } }
      const c = data.success ? Number(data.data?.count ?? 0) : 0
      setCount(c)
      writeCache(c)
    } catch {
      /* Offline: Badge bleibt beim letzten Wert */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useReconnectRefetch(() => {
    clearCache()
    void load({ bypassCache: true })
  })

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail
      if (typeof detail?.count === 'number') {
        setCount(detail.count)
        writeCache(detail.count)
        return
      }
      clearCache()
      void load({ bypassCache: true })
    }
    window.addEventListener(BOOKING_IMPORT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(BOOKING_IMPORT_CHANGED_EVENT, onChange)
  }, [load])

  return count
}

/** @deprecated Nutze notifyBookingImportChanged aus booking-import-events */
export function invalidateBookingImportBadgeCache() {
  clearCache()
}
