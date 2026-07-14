'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Bell } from 'lucide-react'
import type { ApiResponse } from '@/lib/api-types'
import { PUSH_NOTIFICATION_OPTIONS, type UserPushSettings } from '@/lib/push-settings'
import { usePushSubscribe } from '@/hooks/use-push-subscribe'
import { PushDeviceActivatePrompt } from '@/components/push-device-activate'

type PushSettingsData = UserPushSettings & { browserSubscribed: boolean }

export function PushNotificationSettings() {
  const pushSubscribe = usePushSubscribe()
  const [settings, setSettings] = useState<PushSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/push-settings', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<PushSettingsData>
      if (json.success && json.data) {
        setSettings(json.data)
      } else {
        setError(json.error ?? 'Einstellungen konnten nicht geladen werden.')
      }
    } catch {
      setError('Einstellungen konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const persist = useCallback(
    async (next: UserPushSettings) => {
      setSaving(true)
      setError(null)
      setSuccess(false)
      try {
        const res = await fetch('/api/profile/push-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(next),
        })
        const json = (await res.json()) as ApiResponse<PushSettingsData>
        if (!json.success || !json.data) {
          setError(json.error ?? 'Speichern fehlgeschlagen.')
          return false
        }
        setSettings(json.data)
        setSuccess(true)
        return true
      } catch {
        setError('Speichern fehlgeschlagen.')
        return false
      } finally {
        setSaving(false)
      }
    },
    []
  )

  const handleMasterToggle = async (enabled: boolean) => {
    if (!settings) return
    const next = { ...settings, enabled }

    if (enabled) {
      if (!pushSubscribe.supported) {
        setError('Push wird von diesem Browser nicht unterstützt.')
        return
      }
      const subscribed = pushSubscribe.subscribed || (await pushSubscribe.subscribe())
      if (!subscribed) {
        setError(pushSubscribe.lastError ?? 'Browser-Benachrichtigung konnte nicht aktiviert werden.')
        return
      }
      const ok = await persist(next)
      if (ok) setSettings((s) => (s ? { ...s, enabled: true, browserSubscribed: true } : s))
      return
    }

    await pushSubscribe.unsubscribe()
    const ok = await persist(next)
    if (ok) setSettings((s) => (s ? { ...s, enabled: false, browserSubscribed: false } : s))
  }

  const handleTypeToggle = async (key: 'rastplatzNearby', checked: boolean) => {
    if (!settings?.enabled) return
    const next = { ...settings, [key]: checked }
    await persist(next)
  }

  if (loading) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Benachrichtigungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        </CardContent>
      </Card>
    )
  }

  if (!pushSubscribe.supported) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Benachrichtigungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Benachrichtigungen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Einstellungen gelten für dein Konto auf allen Geräten. Beim ersten Aktivieren fragt der
          Browser nach Erlaubnis – pro Gerät einmal nötig.
        </p>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
          <div className="space-y-0.5">
            <Label htmlFor="push-master" className="text-sm font-medium cursor-pointer">
              Push-Benachrichtigungen
            </Label>
            <p className="text-xs text-muted-foreground">
              Grundsätzlich Benachrichtigungen von dieser App erhalten
            </p>
          </div>
          <Switch
            id="push-master"
            checked={!!settings?.enabled}
            disabled={saving}
            onCheckedChange={(v) => void handleMasterToggle(v)}
          />
        </div>

        {settings?.enabled && (
          <div className="space-y-3 pl-1">
            <p className="text-sm font-medium text-muted-foreground">Arten von Benachrichtigungen</p>
            {PUSH_NOTIFICATION_OPTIONS.map((opt) => {
              const prefKey = opt.key
              const checked = settings[prefKey]
              return (
                <div
                  key={opt.key}
                  className="flex items-start gap-3 rounded-lg border border-border/40 p-3"
                >
                  <Checkbox
                    id={`push-${opt.key}`}
                    checked={checked}
                    disabled={saving}
                    onCheckedChange={(v) => void handleTypeToggle(prefKey, v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor={`push-${opt.key}`} className="text-sm font-medium cursor-pointer">
                      {opt.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {settings?.enabled && !pushSubscribe.subscribed && (
          <PushDeviceActivatePrompt
            accountPushEnabled={settings.enabled}
            deviceSubscribed={pushSubscribe.subscribed}
            pushSupported={pushSubscribe.supported}
            onActivate={pushSubscribe.subscribe}
            activateError={pushSubscribe.lastError}
            variant="profile"
            onActivated={() => void loadSettings()}
          />
        )}

        {settings?.enabled && pushSubscribe.subscribed && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
            Push auf diesem Gerät aktiv
          </p>
        )}

        {(error || (pushSubscribe.lastError && !settings?.enabled)) && (
          <p className="text-sm text-destructive">{error ?? pushSubscribe.lastError}</p>
        )}
        {success && !error && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Einstellungen gespeichert.</p>
        )}
      </CardContent>
    </Card>
  )
}
