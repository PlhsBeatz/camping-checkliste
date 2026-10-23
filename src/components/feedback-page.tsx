'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ApiResponse } from '@/lib/api-types'
import type { FeedbackStatus, FeedbackType } from '@/lib/github-feedback'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import {
  FeedbackStatusBadge,
  FeedbackTypeLabel,
} from '@/components/feedback-status-badge'

type MineItem = {
  id: string
  issueNumber: number
  title: string
  type: FeedbackType
  status: FeedbackStatus
  statusLabel: string
  createdAt: string
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

  useEffect(() => {
    void loadMine()
  }, [loadMine])

  useReconnectRefetch(loadMine)

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
        <CardContent className="space-y-3">
          {mineLoading && (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          )}
          {mineError && <p className="text-sm text-red-600">{mineError}</p>}
          {!mineLoading && !mineError && mine.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Meldungen.</p>
          )}
          <ul className="space-y-3">
            {mine.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 border-b border-border last:border-0 pb-3 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    #{item.issueNumber}
                  </span>
                  <FeedbackStatusBadge status={item.status} label={item.statusLabel} />
                  <FeedbackTypeLabel type={item.type} />
                </div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
