'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import { canReceivePushAlerts, type UserPushSettings } from '@/lib/push-settings'
import { PUSH_DEVICE_SUBSCRIBED_EVENT } from '@/components/push-device-activate'

type PushSettingsData = UserPushSettings & { browserSubscribed: boolean }

export function useUserPushSettings(deviceSubscribed = false) {
  const [settings, setSettings] = useState<PushSettingsData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/push-settings', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<PushSettingsData>
      if (json.success && json.data) {
        setSettings(json.data)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onSubscribed = () => void refresh()
    window.addEventListener(PUSH_DEVICE_SUBSCRIBED_EVENT, onSubscribed)
    return () => window.removeEventListener(PUSH_DEVICE_SUBSCRIBED_EVENT, onSubscribed)
  }, [refresh])

  const canReceivePush =
    settings != null && canReceivePushAlerts(settings, deviceSubscribed)

  return { settings, loading, refresh, canReceivePush }
}
