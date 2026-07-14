'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { MapPin } from 'lucide-react'
import type { ApiResponse } from '@/lib/api-types'
import {
  REISE_GPS_MODE_OPTIONS,
  DEFAULT_REISE_GPS_MODE,
  type ReiseGpsMode,
} from '@/lib/reise-gps-settings'

export function ReiseGpsSettings() {
  const [mode, setMode] = useState<ReiseGpsMode>(DEFAULT_REISE_GPS_MODE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/reise-gps', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<{ mode: ReiseGpsMode }>
      if (json.success && json.data?.mode) {
        setMode(json.data.mode)
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

  const handleChange = async (next: ReiseGpsMode) => {
    const prev = mode
    setMode(next)
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/profile/reise-gps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: next }),
      })
      const json = (await res.json()) as ApiResponse<{ mode: ReiseGpsMode }>
      if (!json.success) {
        setMode(prev)
        setError(json.error ?? 'Speichern fehlgeschlagen.')
        return
      }
      setSuccess(true)
      window.dispatchEvent(
        new CustomEvent('reise-gps-settings-changed', { detail: { mode: next } })
      )
    } catch {
      setMode(prev)
      setError('Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Standort / Unterwegs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Standort / Unterwegs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Steuert, wann die App deinen Standort für Rastplatz-Hinweise und die Route nutzt. Beim
          ersten Mal fragt der Browser nach Standortfreigabe.
        </p>

        <RadioGroup
          value={mode}
          onValueChange={(v) => void handleChange(v as ReiseGpsMode)}
          disabled={saving}
          className="space-y-3"
        >
          {REISE_GPS_MODE_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className="flex items-start gap-3 rounded-lg border border-border/60 p-3"
            >
              <RadioGroupItem value={opt.value} id={`reise-gps-${opt.value}`} className="mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor={`reise-gps-${opt.value}`} className="text-sm font-medium cursor-pointer">
                  {opt.label}
                </Label>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && !error && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Einstellung gespeichert.</p>
        )}
      </CardContent>
    </Card>
  )
}
