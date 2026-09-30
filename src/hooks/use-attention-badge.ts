'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ATTENTION_CHANGED_EVENT } from '@/lib/attention-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

const BADGE_CACHE_KEY = 'camping-attention-badge'
const BADGE_CACHE_MS = 45_000

function readBadgeCache(): number | null {
  try {
    const raw = sessionStorage.getItem(BADGE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { count?: number; at?: number }
    if (typeof parsed.count !== 'number' || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > BADGE_CACHE_MS) return null
    return parsed.count
  } catch {
    return null
  }
}

function writeBadgeCache(count: number) {
  try {
    sessionStorage.setItem(BADGE_CACHE_KEY, JSON.stringify({ count, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

function clearBadgeCache() {
  try {
    sessionStorage.removeItem(BADGE_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export function useAttentionBadge() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  const load = useCallback(async (opts?: { bypassCache?: boolean }) => {
    if (!opts?.bypassCache) {
      const cached = readBadgeCache()
      if (cached != null) {
        setCount(cached)
        return
      }
    }
    try {
      const res = await fetch('/api/attention?count=1', {
        cache: 'no-store',
      })
      const json = (await res.json()) as { success?: boolean; badgeCount?: number }
      if (json.success && typeof json.badgeCount === 'number') {
        setCount(json.badgeCount)
        writeBadgeCache(json.badgeCount)
      }
    } catch {
      /* Offline: Badge bleibt beim letzten Wert */
    }
  }, [])

  useEffect(() => {
    const cached = readBadgeCache()
    if (cached != null) setCount(cached)
  }, [])

  useEffect(() => {
    // Home-Hub lädt den vollen Feed und setzt den Badge über notifyAttentionChanged
    if (pathname === '/') return
    void load()
  }, [load, pathname])

  useReconnectRefetch(() => {
    if (pathname === '/') return
    clearBadgeCache()
    void load({ bypassCache: true })
  })

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ badgeCount?: number }>).detail
      if (typeof detail?.badgeCount === 'number') {
        setCount(detail.badgeCount)
        writeBadgeCache(detail.badgeCount)
        return
      }
      clearBadgeCache()
      void load({ bypassCache: true })
    }
    window.addEventListener(ATTENTION_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(ATTENTION_CHANGED_EVENT, onChange)
  }, [load])

  return count
}
