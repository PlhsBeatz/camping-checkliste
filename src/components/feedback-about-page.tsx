'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { ApiResponse } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import type { FeedbackStatus, FeedbackType } from '@/lib/github-feedback'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

type MineItem = {
  id: string
  issueNumber: number
  title: string
  type: FeedbackType
  status: FeedbackStatus
  statusLabel: string
  createdAt: string
}

type RoadmapItem = {
  issueNumber: number
  title: string
  type: FeedbackType | null
  status: FeedbackStatus
  statusLabel: string
}

function StatusBadge({ status, label }: { status: FeedbackStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        status === 'erledigt' &&
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
        status === 'in_arbeit' &&
          'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
        status === 'geplant' && 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
        status === 'offen' && 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}

function TypeLabel({ type }: { type: FeedbackType | null }) {
  if (type === 'bug') return <span className="text-xs text-muted-foreground">Fehler</span>
  if (type === 'enhancement') {
    return <span className="text-xs text-muted-foreground">Verbesserung</span>
  }
  return null
}

export function FeedbackAboutPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageSuccess, setPageSuccess] = useState<string | null>(null)

  const [mine, setMine] = useState<MineItem[]>([])
  const [mineLoading, setMineLoading] = useState(true)
  const [mineError, setMineError] = useState<string | null>(null)

  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([])
  const [roadmapLoading, setRoadmapLoading] = useState(true)
  const [roadmapError, setRoadmapError] = useState<string | null>(null)

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

  const loadRoadmap = useCallback(async () => {
    setRoadmapLoading(true)
    setRoadmapError(null)
    try {
      const res = await fetch('/api/feedback/roadmap', { credentials: 'include' })
      const json = (await res.json()) as ApiResponse<RoadmapItem[]>
      if (!json.success || !json.data) {
        setRoadmapError(json.error ?? 'Roadmap konnte nicht geladen werden.')
        setRoadmap([])
        return
      }
      setRoadmap(json.data)
    } catch {
      setRoadmapError('Roadmap konnte nicht geladen werden.')
      setRoadmap([])
    } finally {
      setRoadmapLoading(false)
    }
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([loadMine(), loadRoadmap()])
  }, [loadMine, loadRoadmap])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useReconnectRefetch(loadAll)

  const handleOpenChange = (open: boolean) => {
    setModalOpen(open)
    if (!open) resetForm()
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
      setModalOpen(false)
      void loadMine()
    } catch {
      setFormError('Meldung konnte nicht gesendet werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Button
        type="button"
        size="lg"
        className="w-full h-14 text-base font-semibold gap-2"
        onClick={() => {
          setPageSuccess(null)
          setModalOpen(true)
        }}
      >
        <MessageSquarePlus className="h-5 w-5" />
        Fehler oder Idee melden
      </Button>

      {pageSuccess && <p className="text-sm text-emerald-700">{pageSuccess}</p>}

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
                  <StatusBadge status={item.status} label={item.statusLabel} />
                  <TypeLabel type={item.type} />
                </div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Roadmap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Geplante und laufende Verbesserungen.
          </p>
          {roadmapLoading && (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          )}
          {roadmapError && <p className="text-sm text-red-600">{roadmapError}</p>}
          {!roadmapLoading && !roadmapError && roadmap.length === 0 && (
            <p className="text-sm text-muted-foreground">Aktuell keine Einträge.</p>
          )}
          <ul className="space-y-3">
            {roadmap.map((item) => (
              <li
                key={item.issueNumber}
                className="flex flex-col gap-1 border-b border-border last:border-0 pb-3 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} label={item.statusLabel} />
                  <TypeLabel type={item.type} />
                </div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ResponsiveModal
        open={modalOpen}
        onOpenChange={handleOpenChange}
        title="Fehler oder Idee melden"
        description="Beschreibe einen Fehler oder schlage eine Verbesserung vor."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Was ist passiert? Was hättest du erwartet?"
              required
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Wird gesendet…' : 'Absenden'}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  )
}
