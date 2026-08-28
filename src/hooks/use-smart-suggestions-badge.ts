'use client'

import { useCallback, useEffect, useState } from 'react'
import { SMART_SUGGESTIONS_CHANGED_EVENT } from '@/lib/smart-suggestions-events'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export function useSmartSuggestionsBadge() {
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/suggestions?count=1')
      const json = (await res.json()) as { success?: boolean; data?: { count?: number } }
      if (json.success && typeof json.data?.count === 'number') {
        setCount(json.data.count)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useReconnectRefetch(() => {
    void load()
  })

  useEffect(() => {
    const onChange = () => {
      void load()
    }
    window.addEventListener(SMART_SUGGESTIONS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SMART_SUGGESTIONS_CHANGED_EVENT, onChange)
  }, [load])

  return count
}
