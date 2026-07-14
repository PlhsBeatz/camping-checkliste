'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import { DEFAULT_REISE_GPS_MODE, type ReiseGpsMode } from '@/lib/reise-gps-settings'

export function useUserReiseGpsSettings() {
  const [mode, setMode] = useState<ReiseGpsMode>(DEFAULT_REISE_GPS_MODE)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/reise-gps', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<{ mode: ReiseGpsMode }>
      if (json.success && json.data?.mode) {
        setMode(json.data.mode)
      }
    } catch {
      /* Offline: Default auto */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: ReiseGpsMode }>).detail
      if (detail?.mode) setMode(detail.mode)
    }
    window.addEventListener('reise-gps-settings-changed', onChanged)
    return () => window.removeEventListener('reise-gps-settings-changed', onChanged)
  }, [])

  return { mode, loading, refresh }
}
