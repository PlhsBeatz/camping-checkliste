'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const CACHE_KEY = 'camping-booking-import-badge'
const CACHE_MS = 30_000

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

export function useBookingImportBadge() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  const load = useCallback(async (bypassCache = false) => {
    if (!bypassCache) {
      const cached = readCache()
      if (cached != null) {
        setCount(cached)
        return
      }
    }
    try {
      const res = await fetch('/api/booking-import')
      if (!res.ok) return
      const data = (await res.json()) as { success?: boolean; data?: { count?: number } }
      const c = data.success ? Number(data.data?.count ?? 0) : 0
      setCount(c)
      writeCache(c)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, pathname])

  return count
}

export function invalidateBookingImportBadgeCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}
