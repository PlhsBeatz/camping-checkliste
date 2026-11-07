'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { ApiResponse } from '@/lib/api-types'
import type { FeedbackStatus, FeedbackType } from '@/lib/github-feedback'
import {
  FEEDBACK_NOTIFY_MODE_OPTIONS,
  type FeedbackNotifyMode,
  type UserPushSettings,
} from '@/lib/push-settings'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import {
  FeedbackStatusBadge,
  FeedbackTypeLabel,
} from '@/components/feedback-status-badge'
import { ChevronRight } from 'lucide-react'

type MineItem = {
  id: string
  issueNumber: number
  title: string
  type: FeedbackType
  status: FeedbackStatus
  statusLabel: string
  createdAt: string
}

type DetailItem = MineItem & {
  description: string
}

type PushSettingsData = UserPushSettings & { browserSubscribed: boolean }

function formatCreatedAt(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageSuccess, setPageSuccess] = useState<string | null>(null)

  const [mine, setMine] = useState<MineItem[]>([])
  const [mineLoading, setMineLoading] = useState(true)
  const [mineError, setMineError] = useState<string | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailItem | null>(null)

  const [pushSettings, setPushSettings] = useState<PushSettingsData | null>(null)
  const [pushSaving, setPushSaving] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  const resetForm = () => {
    setType('bug')
    setTitle('')
    setDescription('')
    setFormError(null)
  }

  const loadMine = useCallback(async () => {
    setMineLoading(true)
    setMineError(null)
    try {
      const res = await fetch('/api/feedback/mine', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<MineItem[]>
      if (!json.success || !json.data) {
        setMineError(json.error ?? 'Eigene Meldungen konnten nicht geladen werden.')
        setMine([])
        return
      }
      setMine(json.data)
    } catch {
      setMineError('Eigene Meldungen konnten nicht geladen werden.')
      setMine([])
    } finally {
      setMineLoading(false)
    }
  }, [])

  const loadPushSettings = useCallback(async () => {
    setPushError(null)
    try {
      const res = await fetch('/api/profile/push-settings', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<PushSettingsData>
      if (json.success && json.data) {
        setPushSettings(json.data)
      }
    } catch {
      /* optional – Einstellungen bleiben ausblendbar */
    }
  }, [])

  useEffect(() => {
    void loadMine()
    void loadPushSettings()
  }, [loadMine, loadPushSettings])

  useReconnectRefetch(() => {
    void loadMine()
    void loadPushSettings()
  })

  const persistPush = async (next: UserPushSettings) => {
    setPushSaving(true)
    setPushError(null)
    try {
      const res = await fetch('/api/profile/push-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(next),
      })
      const json = (await res.json()) as ApiResponse<PushSettingsData>
      if (!json.success || !json.data) {
        setPushError(json.error ?? 'Benachrichtigungseinstellung konnte nicht gespeichert werden.')
        return
      }
      setPushSettings(json.data)
    } catch {
      setPushError('Benachrichtigungseinstellung konnte nicht gespeichert werden.')
    } finally {
      setPushSaving(false)
    }
  }

  const handleFeedbackNotifyToggle = async (enabled: boolean) => {
    if (!pushSettings) return
    await persistPush({
      ...pushSettings,
      feedbackMeldungen: enabled,
      feedbackNotifyMode: pushSettings.feedbackNotifyMode ?? 'done',
    })
  }

  const handleFeedbackNotifyMode = async (mode: FeedbackNotifyMode) => {
    if (!pushSettings) return
    await persistPush({
      ...pushSettings,
      feedbackNotifyMode: mode,
    })
  }

  const openDetail = async (item: MineItem) => {
    setDetailOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/feedback/mine/${encodeURIComponent(item.id)}`, {
        credentials: 'include',
      })
      const json = (await res.json()) as ApiResponse<DetailItem>
      if (!json.success || !json.data) {
        setDetailError(json.error ?? 'Meldung konnte nicht geladen werden.')
        return
      }
      setDetail(json.data)
    } catch {
      setDetailError('Meldung konnte nicht geladen werden.')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setPageSuccess(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, type }),
      })
      const json = (await res.json()) as ApiResponse<{ issueNumber: number }>
      if (!res.ok || !json.success) {
        setFormError(json.error ?? 'Meldung konnte nicht gesendet werden.')
        return
      }
      setPageSuccess(
        json.data?.issueNumber
          ? `Danke! Deine Meldung wurde erfasst (#${json.data.issueNumber}).`
          : 'Danke! Deine Meldung wurde erfasst.'
      )
      resetForm()
      void loadMine()
    } catch {
      setFormError('Meldung konnte nicht gesendet werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Fehler oder Idee melden</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Beschreibe einen Fehler oder schlage eine Verbesserung vor.
            </p>
            <div className="space-y-2">
              <Label>Art</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as FeedbackType)}
                className="flex flex-col sm:flex-row gap-3"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="bug" id="feedback-bug" />
                  Fehler
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="enhancement" id="feedback-enhancement" />
                  Verbesserung
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-title">Titel</Label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Kurz und klar"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-description">Beschreibung</Label>
              <Textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
                rows={5}
                placeholder={
                  type === 'bug'
                    ? 'Was ist passiert? Was hättest du erwartet?'
                    : 'Was fehlt oder könnte besser laufen? Welchen Nutzen hättest du davon?'
                }
                required
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {pageSuccess && <p className="text-sm text-emerald-700">{pageSuccess}</p>}
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Wird gesendet…' : 'Absenden'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Meine Meldungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pushSettings && (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label htmlFor="feedback-notify" className="text-sm font-medium cursor-pointer">
                    Benachrichtigung bei Statusänderungen
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Push zum Bearbeitungsstand deiner eingereichten Meldungen. Standardmäßig aus;
                    wenn aktiv, nur bei Fertigstellung.
                  </p>
                </div>
                <Switch
                  id="feedback-notify"
                  checked={!!pushSettings.feedbackMeldungen}
                  disabled={pushSaving}
                  onCheckedChange={(v) => void handleFeedbackNotifyToggle(v)}
                />
              </div>

              {pushSettings.feedbackMeldungen && (
                <RadioGroup
                  value={pushSettings.feedbackNotifyMode ?? 'done'}
                  onValueChange={(v) => void handleFeedbackNotifyMode(v as FeedbackNotifyMode)}
                  className="space-y-2 pl-0.5"
                  disabled={pushSaving}
                >
                  {FEEDBACK_NOTIFY_MODE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-start gap-2.5 text-sm cursor-pointer rounded-md border border-border/40 p-2.5"
                    >
                      <RadioGroupItem value={opt.value} id={`feedback-mode-${opt.value}`} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="font-medium block">{opt.label}</span>
                        <span className="text-xs text-muted-foreground block">{opt.description}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              )}

              {pushSettings.feedbackMeldungen && !pushSettings.enabled && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Push ist im Profil noch aus.{' '}
                  <Link href="/einstellungen/benachrichtigungen" className="underline underline-offset-2">
                    Benachrichtigungen aktivieren
                  </Link>
                </p>
              )}
              {pushError && <p className="text-sm text-red-600">{pushError}</p>}
            </div>
          )}

          {mineLoading && (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          )}
          {mineError && <p className="text-sm text-red-600">{mineError}</p>}
          {!mineLoading && !mineError && mine.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Meldungen.</p>
          )}
          <ul className="space-y-1">
            {mine.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openDetail(item)}
                  className="w-full text-left flex items-start gap-2 rounded-md border border-transparent px-1 py-2.5 -mx-1 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        #{item.issueNumber}
                      </span>
                      <FeedbackStatusBadge status={item.status} label={item.statusLabel} />
                      <FeedbackTypeLabel type={item.type} />
                    </div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ResponsiveModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detail?.title ?? 'Meldung'}
        description={
          detail
            ? `#${detail.issueNumber} · eingereicht am ${formatCreatedAt(detail.createdAt)}`
            : undefined
        }
      >
        <div className="space-y-4 p-1">
          {detailLoading && (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          )}
          {detailError && <p className="text-sm text-red-600">{detailError}</p>}
          {detail && !detailLoading && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <FeedbackStatusBadge status={detail.status} label={detail.statusLabel} />
                <FeedbackTypeLabel type={detail.type} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Dein Text
                </p>
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
                  <p className="text-sm whitespace-pre-wrap break-words text-foreground">
                    {detail.description?.trim()
                      ? detail.description
                      : 'Kein Beschreibungstext gespeichert.'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </ResponsiveModal>
    </div>
  )
}
