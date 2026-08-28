'use client'

import { useCallback, useState } from 'react'
import { postSmartSuggestionAction } from '@/lib/smart-suggestion-client'

export function useSmartSuggestionAct(onDone: () => Promise<void> | void) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const act = useCallback(
    async (
      id: string,
      action: 'accept' | 'dismiss' | 'snooze',
      extra?: { url?: string }
    ) => {
      setBusyId(id)
      try {
        const result = await postSmartSuggestionAction(id, action, extra)
        if (!result.ok) {
          alert(result.error)
          return
        }
        await onDone()
      } finally {
        setBusyId(null)
      }
    },
    [onDone]
  )

  return { busyId, act }
}
