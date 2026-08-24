'use client'

import { useCallback, useEffect, useState } from 'react'
import { ATTENTION_CHANGED_EVENT } from '@/lib/attention-events'
import { attentionCoordsQuery, getCachedAttentionPosition } from '@/lib/attention-geo-client'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export function useAttentionBadge() {
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    try {
      const pos = await getCachedAttentionPosition()
      const res = await fetch(`/api/attention?count=1&_=${Date.now()}${attentionCoordsQuery(pos)}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as { success?: boolean; badgeCount?: number }
      if (json.success && typeof json.badgeCount === 'number') {
        setCount(json.badgeCount)
      }
    } catch {
      /* Offline: Badge bleibt beim letzten Wert */
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
    window.addEventListener(ATTENTION_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(ATTENTION_CHANGED_EVENT, onChange)
  }, [load])

  return count
}
