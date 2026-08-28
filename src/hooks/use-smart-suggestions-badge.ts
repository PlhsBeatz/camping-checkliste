'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SMART_SUGGESTIONS_CHANGED_EVENT } from '@/lib/smart-suggestions-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

const CACHE_KEY = 'camping-suggestions-badge'
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

export function useSmartSuggestionsBadge() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  const load = useCallback(async (opts?: { bypassCache?: boolean }) => {
    if (!opts?.bypassCache) {
      const cached = readCache()
      if (cached != null) {
        setCount(cached)
        return
      }
    }
    try {
      const res = await fetch('/api/suggestions?count=1', { cache: 'no-store' })
      const json = (await res.json()) as { success?: boolean; data?: { count?: number } }
      if (json.success && typeof json.data?.count === 'number') {
        setCount(json.data.count)
        writeCache(json.data.count)
      }
    } catch {
      /* Offline: Badge bleibt beim letzten Wert */
    }
  }, [])

  useEffect(() => {
    const cached = readCache()
    if (cached != null) setCount(cached)
  }, [])

  useEffect(() => {
    // Vorschläge-Seite lädt die Liste und setzt den Badge über notifySmartSuggestionsChanged
    if (pathname === '/tools/vorschlaege') return
    void load()
  }, [load, pathname])

  useReconnectRefetch(() => {
    if (pathname === '/tools/vorschlaege') return
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
    window.addEventListener(SMART_SUGGESTIONS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SMART_SUGGESTIONS_CHANGED_EVENT, onChange)
  }, [load])

  return count
}
