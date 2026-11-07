'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { ApiResponse } from '@/lib/api-types'
import type { FeedbackStatus, FeedbackType } from '@/lib/github-feedback'
import {
  FEEDBACK_PUSH_SETTINGS_HREF,
  formatFeedbackNotifySummary,
  type FeedbackNotifyMode,
  type UserPushSettings,
} from '@/lib/push-settings'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { usePushSubscribe } from '@/hooks/use-push-subscribe'
import {
  FeedbackStatusBadge,
  FeedbackTypeLabel,
} from '@/components/feedback-status-badge'
import { FeedbackNotifyModeRadios } from '@/components/feedback-notify-mode-radios'
import { Bell, ChevronRight } from 'lucide-react'

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

async function savePushSettings(next: UserPushSettings): Promise<PushSettingsData | null> {
  const res = await fetch('/api/profile/push-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(next),
  })
  const json = (await res.json()) as ApiResponse<PushSettingsData>
  if (!json.success || !json.data) return null
  return json.data
}

export function FeedbackPage() {
  const pushSubscribe = usePushSubscribe()
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
  const [notifyPromptOpen, setNotifyPromptOpen] = useState(false)
  const [promptMode, setPromptMode] = useState<FeedbackNotifyMode>('done')
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)

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
    try {
      const res = await fetch('/api/profile/push-settings', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<PushSettingsData>
      if (json.success && json.data) setPushSettings(json.data)
    } catch {
      /* optional */
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
    const isFirstSubmission = mine.length === 0
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
      await loadMine()
      if (isFirstSubmission) {
        setPromptMode(pushSettings?.feedbackNotifyMode ?? 'done')
        setPromptError(null)
        setNotifyPromptOpen(true)
      }
    } catch {
      setFormError('Meldung konnte nicht gesendet werden.')
    } finally {
      setSubmitting(false)
    }
  }

  const dismissNotifyPrompt = () => {
    setNotifyPromptOpen(false)
    setPromptError(null)
  }

  const enableNotifyFromPrompt = async () => {
    if (!pushSettings) {
      setPromptError('Einstellungen konnten nicht geladen werden.')
      return
    }
    setPromptSaving(true)
    setPromptError(null)
    try {
      let next: UserPushSettings = {
        ...pushSettings,
        feedbackMeldungen: true,
        feedbackNotifyMode: promptMode,
      }

      if (!pushSettings.enabled) {
        if (!pushSubscribe.supported) {
          setPromptError('Push wird von diesem Browser nicht unterstützt.')
          setPromptSaving(false)
          return
        }
        const subscribed =
          pushSubscribe.subscribed || (await pushSubscribe.subscribe())
        if (!subscribed) {
          setPromptError(
            pushSubscribe.lastError ??
              'Browser-Benachrichtigung konnte nicht aktiviert werden.'
          )
          setPromptSaving(false)
          return
        }
        next = { ...next, enabled: true }
      }

      const saved = await savePushSettings(next)
      if (!saved) {
        setPromptError('Speichern fehlgeschlagen.')
        return
      }
      setPushSettings(saved)
      setNotifyPromptOpen(false)
    } catch {
      setPromptError('Speichern fehlgeschlagen.')
    } finally {
      setPromptSaving(false)
    }
  }

  const notifySummary =
    pushSettings != null ? formatFeedbackNotifySummary(pushSettings) : null

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
        <CardContent className="space-y-3">
          {notifySummary && mine.length > 0 && (
            <Link
              href={FEEDBACK_PUSH_SETTINGS_HREF}
              className="flex items-center gap-2 rounded-md px-1 py-1.5 -mx-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{notifySummary}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
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

      <ResponsiveModal
        open={notifyPromptOpen}
        onOpenChange={(open) => {
          if (!open) dismissNotifyPrompt()
          else setNotifyPromptOpen(true)
        }}
        title="Status-Benachrichtigungen?"
        description="Möchtest du informiert werden, wenn sich der Bearbeitungsstand deiner Meldung ändert?"
      >
        <div className="space-y-4 p-1">
          <FeedbackNotifyModeRadios
            idPrefix="feedback-prompt-mode"
            value={promptMode}
            onChange={setPromptMode}
            disabled={promptSaving}
            bordered
          />
          {promptError && <p className="text-sm text-red-600">{promptError}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={promptSaving}
              onClick={dismissNotifyPrompt}
            >
              Nicht jetzt
            </Button>
            <Button
              type="button"
              disabled={promptSaving || !pushSettings}
              onClick={() => void enableNotifyFromPrompt()}
            >
              {promptSaving ? 'Wird aktiviert…' : 'Benachrichtigungen aktivieren'}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  )
}
