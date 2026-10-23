'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApiResponse } from '@/lib/api-types'
import { APP_BUILD_ID, APP_VERSION, formatAppVersionLabel } from '@/lib/app-version'
import type { FeedbackStatus, FeedbackType } from '@/lib/github-feedback'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import {
  FeedbackStatusBadge,
  FeedbackTypeLabel,
} from '@/components/feedback-status-badge'

type RoadmapItem = {
  issueNumber: number
  title: string
  type: FeedbackType | null
  status: FeedbackStatus
  statusLabel: string
}

export function AppInfosPage() {
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([])
  const [roadmapLoading, setRoadmapLoading] = useState(true)
  const [roadmapError, setRoadmapError] = useState<string | null>(null)

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

  useEffect(() => {
    void loadRoadmap()
  }, [loadRoadmap])

  useReconnectRefetch(loadRoadmap)

  return (
    <div className="space-y-6">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Version</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {formatAppVersionLabel(APP_VERSION)}
          </p>
          {APP_BUILD_ID ? (
            <p className="text-sm text-muted-foreground tabular-nums">Build {APP_BUILD_ID}</p>
          ) : null}
          <p className="text-xs text-muted-foreground pt-1">
            Die Versionsnummer ändert sich bei Releases; die Build-Kennung darunter
            unterscheidet einzelne Deployments.
          </p>
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
