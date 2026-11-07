'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { ApiResponse } from '@/lib/api-types'
import { APP_BUILD_ID, APP_VERSION, formatAppVersionLabel } from '@/lib/app-version'
import type { AppReleaseInfo, FeedbackStatus, FeedbackType } from '@/lib/github-feedback'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import {
  FeedbackStatusBadge,
  FeedbackTypeLabel,
} from '@/components/feedback-status-badge'
import { ReleaseMarkdown } from '@/components/release-markdown'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type RoadmapItem = {
  issueNumber: number
  title: string
  type: FeedbackType | null
  status: FeedbackStatus
  statusLabel: string
}

type ReleasesPagePayload = {
  appVersion: string
  appVersionNormalized: string
  current: AppReleaseInfo | null
  releases: AppReleaseInfo[]
  page: number
  perPage: number
  hasMore: boolean
}

type ReleaseView = 'detail' | 'list'

const ROADMAP_SECTIONS: { status: FeedbackStatus; title: string }[] = [
  { status: 'todo', title: 'Todo' },
  { status: 'in_progress', title: 'In Arbeit' },
  { status: 'in_test', title: 'In Test' },
]

function formatPublishedAt(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function mergeReleases(existing: AppReleaseInfo[], incoming: AppReleaseInfo[]): AppReleaseInfo[] {
  const map = new Map<string, AppReleaseInfo>()
  for (const r of existing) map.set(r.tag, r)
  for (const r of incoming) map.set(r.tag, r)
  return [...map.values()]
}

function RoadmapItemList({ items }: { items: RoadmapItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
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
  )
}

function ReleaseMetaLine({
  release,
  installed,
}: {
  release: AppReleaseInfo
  installed?: boolean
}) {
  const dateLabel = formatPublishedAt(release.publishedAt)
  return (
    <p className="text-xs text-muted-foreground">
      {[
        release.tag,
        dateLabel ? `veröffentlicht ${dateLabel}` : null,
        installed ? 'installiert' : null,
        release.prerelease ? 'Vorabversion' : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </p>
  )
}

export function AppInfosPage() {
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([])
  const [roadmapLoading, setRoadmapLoading] = useState(true)
  const [roadmapError, setRoadmapError] = useState<string | null>(null)

  const [releasesOpen, setReleasesOpen] = useState(false)
  const [releaseView, setReleaseView] = useState<ReleaseView>('detail')
  const [releasesLoading, setReleasesLoading] = useState(false)
  const [releasesLoadingMore, setReleasesLoadingMore] = useState(false)
  const [releasesError, setReleasesError] = useState<string | null>(null)
  const [releases, setReleases] = useState<AppReleaseInfo[]>([])
  const [currentRelease, setCurrentRelease] = useState<AppReleaseInfo | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const contentTopRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)

  const getModalScroller = () => {
    const node = contentTopRef.current
    const scroller = node?.closest('.overflow-y-auto')
    return scroller instanceof HTMLElement ? scroller : null
  }

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

  const fetchReleasesPage = useCallback(async (nextPage: number) => {
    const res = await fetch(`/api/app/releases?page=${nextPage}`, {
      credentials: 'include',
    })
    const json = (await res.json()) as ApiResponse<ReleasesPagePayload>
    if (!json.success || !json.data) {
      throw new Error(json.error ?? 'Releases konnten nicht geladen werden.')
    }
    return json.data
  }, [])

  const loadInitialReleases = useCallback(async () => {
    setReleasesLoading(true)
    setReleasesError(null)
    try {
      const data = await fetchReleasesPage(1)
      setReleases(data.releases)
      setCurrentRelease(data.current)
      setPage(data.page)
      setHasMore(data.hasMore)
      const initial =
        data.current ?? data.releases[0] ?? null
      setSelectedTag(initial?.tag ?? null)
      setReleaseView(initial ? 'detail' : 'list')
    } catch (err) {
      setReleasesError(
        err instanceof Error ? err.message : 'Releases konnten nicht geladen werden.'
      )
      setReleases([])
      setCurrentRelease(null)
      setSelectedTag(null)
      setPage(0)
      setHasMore(false)
    } finally {
      setReleasesLoading(false)
    }
  }, [fetchReleasesPage])

  const loadMoreReleases = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || releasesLoading) return
    loadingMoreRef.current = true
    setReleasesLoadingMore(true)
    try {
      const data = await fetchReleasesPage(page + 1)
      setReleases((prev) => mergeReleases(prev, data.releases))
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch {
      /* stiller Fehlschlag beim Nachladen – Liste bleibt nutzbar */
    } finally {
      loadingMoreRef.current = false
      setReleasesLoadingMore(false)
    }
  }, [fetchReleasesPage, hasMore, page, releasesLoading])

  useEffect(() => {
    void loadRoadmap()
  }, [loadRoadmap])

  useReconnectRefetch(loadRoadmap)

  // Infinite scroll nur in der Listenansicht
  useEffect(() => {
    if (!releasesOpen || releaseView !== 'list' || !hasMore) return
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel) return

    const root = getModalScroller()
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreReleases()
        }
      },
      { root, rootMargin: '120px', threshold: 0 }
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [releasesOpen, releaseView, hasMore, loadMoreReleases, releases.length])

  // Beim gezielten Ansichtswechsel nach oben – nicht mitten in gemischtem Content springen
  useEffect(() => {
    if (!releasesOpen) return
    const scroller = getModalScroller()
    if (scroller) scroller.scrollTop = 0
  }, [releaseView, selectedTag, releasesOpen])

  const openReleasesModal = () => {
    setReleasesOpen(true)
    if (page === 0 && !releasesLoading) void loadInitialReleases()
  }

  const selectedRelease = useMemo(() => {
    if (!selectedTag) return currentRelease
    return (
      releases.find((r) => r.tag === selectedTag) ??
      (currentRelease?.tag === selectedTag ? currentRelease : null)
    )
  }, [releases, selectedTag, currentRelease])

  const openReleaseDetail = (tag: string) => {
    setSelectedTag(tag)
    setReleaseView('detail')
  }

  const { activeSections, doneItems } = useMemo(() => {
    const done = roadmap.filter((i) => i.status === 'erledigt')
    const sections = ROADMAP_SECTIONS.map((section) => ({
      ...section,
      items: roadmap.filter((i) => i.status === section.status),
    })).filter((section) => section.items.length > 0)
    return { activeSections: sections, doneItems: done }
  }, [roadmap])

  const hasActiveRoadmap = activeSections.length > 0
  const isCurrentSelected =
    !!selectedRelease &&
    !!currentRelease &&
    selectedRelease.tag === currentRelease.tag

  const modalTitle =
    releaseView === 'list'
      ? 'Releases'
      : selectedRelease?.name ?? 'Release-Hinweise'

  const modalDescription =
    releaseView === 'list'
      ? 'Tippe einen Eintrag für die Release-Notizen.'
      : selectedRelease
        ? [
            selectedRelease.tag,
            formatPublishedAt(selectedRelease.publishedAt)
              ? `veröffentlicht ${formatPublishedAt(selectedRelease.publishedAt)}`
              : null,
            isCurrentSelected ? 'installiert' : null,
            selectedRelease.prerelease ? 'Vorabversion' : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : undefined

  return (
    <div className="space-y-6">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Version</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={openReleasesModal}
            className="w-full text-left flex items-start gap-2 rounded-md -mx-1 px-1 py-1 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {formatAppVersionLabel(APP_VERSION)}
              </p>
              {APP_BUILD_ID ? (
                <p className="text-sm text-muted-foreground tabular-nums">
                  Build {APP_BUILD_ID}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Release-Hinweise und frühere Versionen anzeigen
              </p>
            </div>
            <ChevronRight
              className="h-4 w-4 text-muted-foreground shrink-0 mt-1.5"
              aria-hidden
            />
          </button>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Roadmap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Geplante und laufende Verbesserungen.
          </p>
          {roadmapLoading && (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          )}
          {roadmapError && <p className="text-sm text-red-600">{roadmapError}</p>}
          {!roadmapLoading && !roadmapError && !hasActiveRoadmap && (
            <p className="text-sm text-muted-foreground">Aktuell keine Einträge.</p>
          )}
          {!roadmapLoading &&
            !roadmapError &&
            activeSections.map((section) => (
              <div key={section.status} className="space-y-3">
                <h3 className="text-sm font-semibold text-brand-heading">{section.title}</h3>
                <RoadmapItemList items={section.items} />
              </div>
            ))}
        </CardContent>
      </Card>

      {!roadmapLoading && !roadmapError && doneItems.length > 0 && (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Was ist neu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Kürzlich umgesetzte Punkte.</p>
            <RoadmapItemList items={doneItems} />
          </CardContent>
        </Card>
      )}

      <ResponsiveModal
        open={releasesOpen}
        onOpenChange={setReleasesOpen}
        title={modalTitle}
        description={modalDescription}
        contentClassName="sm:max-w-lg sm:max-h-[min(85dvh,720px)] sm:overflow-y-auto"
      >
        <div ref={contentTopRef} className="space-y-4 p-1">
          {releasesLoading && (
            <p className="text-sm text-muted-foreground">Wird geladen…</p>
          )}
          {releasesError && (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{releasesError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadInitialReleases()}
              >
                Erneut versuchen
              </Button>
            </div>
          )}

          {!releasesLoading && !releasesError && releaseView === 'detail' && (
            <>
              {!currentRelease && selectedRelease && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Zur installierten Version {formatAppVersionLabel(APP_VERSION)} liegt noch kein
                  GitHub-Release vor.
                </p>
              )}

              {selectedRelease ? (
                <div className="space-y-4">
                  {selectedRelease.body ? (
                    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                      <ReleaseMarkdown content={selectedRelease.body} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine Release-Notizen hinterlegt.
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setReleaseView('list')}
                  >
                    Andere Versionen
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Noch keine GitHub-Releases vorhanden.
                  </p>
                  <Button type="button" variant="outline" onClick={() => setReleaseView('list')}>
                    Zur Übersicht
                  </Button>
                </div>
              )}
            </>
          )}

          {!releasesLoading && !releasesError && releaseView === 'list' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setReleaseView('detail')}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Zurück zu den Notizen
              </button>

              {releases.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Releases geladen.</p>
              ) : (
                <ul className="space-y-1">
                  {releases.map((release) => {
                    const installed = currentRelease?.tag === release.tag
                    const active = selectedTag === release.tag
                    return (
                      <li key={release.tag}>
                        <button
                          type="button"
                          onClick={() => openReleaseDetail(release.tag)}
                          className={cn(
                            'w-full text-left flex items-start gap-2 rounded-md border px-2.5 py-2.5',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active
                              ? 'border-border bg-muted/60'
                              : 'border-transparent hover:bg-muted/50'
                          )}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-sm font-medium text-foreground">{release.name}</p>
                            <ReleaseMetaLine release={release} installed={installed} />
                          </div>
                          <ChevronRight
                            className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
                            aria-hidden
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              <div ref={loadMoreSentinelRef} className="h-4" aria-hidden />
              {releasesLoadingMore && (
                <p className="text-xs text-muted-foreground text-center">Weitere werden geladen…</p>
              )}
              {!hasMore && releases.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">Alle Releases geladen.</p>
              )}
            </div>
          )}
        </div>
      </ResponsiveModal>
    </div>
  )
}
