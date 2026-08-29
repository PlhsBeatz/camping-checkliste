'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock, Menu } from 'lucide-react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import {
  MAX_ATTENTION_ITEMS,
  type AttentionFeed,
  type AttentionItem,
  type AttentionKind,
  type AttentionVacationTile,
  type PackingWeightTone,
} from '@/lib/attention-feed'
import { SNOOZE_PRESET_DAYS } from '@/lib/attention-snooze'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { getCachedAttentionFeed, cacheAttentionFeed } from '@/lib/offline-db'
import { notifyAttentionChanged } from '@/lib/attention-events'
import { notifySmartSuggestionsChanged } from '@/lib/smart-suggestions-events'
import { HeuteTravelNav } from '@/components/heute-travel-nav'
import { PushDeviceActivatePrompt } from '@/components/push-device-activate'
import { usePushSubscribe } from '@/hooks/use-push-subscribe'
import { useUserPushSettings } from '@/hooks/use-user-push-settings'
import {
  attentionCoordsQuery,
  getCachedAttentionPosition,
  getLiveAttentionPosition,
  rememberAttentionPosition,
} from '@/lib/attention-geo-client'
import type { GeoPoint } from '@/lib/sonnen-hub-arrival'

const KIND_META: Record<AttentionKind, { label: string; icon: string }> = {
  wartung_sicherheit: { label: 'Wartung', icon: 'build' },
  wartung: { label: 'Wartung', icon: 'build' },
  packing_incomplete: { label: 'Packliste', icon: 'checklist' },
  packing_weight: { label: 'Pack-Status', icon: 'analytics' },
  packing_vorgemerkt: { label: 'Packliste', icon: 'checklist' },
  optimierung: { label: 'Optimierung', icon: 'tune' },
  restzahlung: { label: 'Restzahlung', icon: 'payments' },
  checkliste: { label: 'Checkliste', icon: 'fact_check' },
  vacation_next: { label: 'Urlaub', icon: 'event' },
  sonnen_ausrichtung: { label: 'Sonne', icon: 'wb_sunny' },
  vorschlag: { label: 'Vorschlag', icon: 'lightbulb' },
}

function formatHubDateRange(start: string, end: string): string {
  const [ys, ms, ds] = start.slice(0, 10).split('-')
  const [ye, me, de] = end.slice(0, 10).split('-')
  if (!ys || !ms || !ds || !ye || !me || !de) return `${start} – ${end}`
  return `${ds}.${ms}.${ys} – ${de}.${me}.${ye}`
}

function vacationCountdownAria(tile: AttentionVacationTile): string | undefined {
  const kind = tile.countdownKind
  const days = tile.countdownDays
  if (!kind) return undefined
  if (kind === 'today') return 'Urlaub beginnt heute'
  if (kind === 'last_day') return 'Letzter Urlaubstag'
  if (kind === 'remaining') {
    return days === 1 ? 'Noch 1 Tag Urlaub' : `Noch ${days} Tage Urlaub`
  }
  return days === 1 ? 'Noch 1 Tag bis zum Start' : `Noch ${days} Tage bis zum Start`
}

function VacationCountdown({ tile }: { tile: AttentionVacationTile }) {
  const kind = tile.countdownKind
  const days = tile.countdownDays
  if (!kind) return null

  if (kind === 'today') {
    return (
      <span className="text-[10px] font-medium leading-tight text-brand-heading shrink-0">
        heute
      </span>
    )
  }
  if (kind === 'last_day') {
    return (
      <span className="text-[10px] font-medium leading-tight text-right text-brand-heading shrink-0">
        letzter
        <span className="block text-muted-foreground font-normal">Tag</span>
      </span>
    )
  }

  return (
    <span className="text-right shrink-0 leading-none">
      <span className="block text-sm font-semibold tabular-nums text-brand-heading">{days}</span>
      <span className="block text-[10px] text-muted-foreground mt-0.5">
        {days === 1 ? 'Tag' : 'Tage'}
      </span>
    </span>
  )
}

function PackingWeightBadge({
  tone,
  reserveKg,
}: {
  tone: PackingWeightTone
  reserveKg: number
}) {
  const kg = Math.round(Math.abs(reserveKg))
  const over = tone === 'over'
  return (
    <span
      className={cn(
        'flex flex-col items-end shrink-0 leading-none',
        over ? 'text-red-600' : 'text-amber-600'
      )}
      title={over ? 'Zuladung überschritten' : 'Wenig Gewichtsreserve'}
      aria-label={over ? `Zuladung überschritten, ${kg} kg über` : `${kg} kg Reserve`}
    >
      <span className="material-icons text-lg leading-none block" aria-hidden>
        monitor_weight
      </span>
      <span className="text-sm font-semibold tabular-nums mt-0.5">{kg} kg</span>
      <span className="text-[10px] mt-0.5">{over ? 'über' : 'Reserve'}</span>
    </span>
  )
}

function OverviewTile({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block min-w-0 h-full">
      <Card className="h-full min-h-[8.75rem] transition-colors hover:border-[rgb(45,79,30)]/40">
        <CardContent className="relative p-3 h-full flex flex-col gap-1.5">{children}</CardContent>
      </Card>
    </Link>
  )
}

function HeuteHubContent() {
  const router = useRouter()
  const pushSubscribe = usePushSubscribe()
  const { settings: pushSettings } = useUserPushSettings(pushSubscribe.subscribed)
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [feed, setFeed] = useState<AttentionFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [snoozingKey, setSnoozingKey] = useState<string | null>(null)
  const [snoozeOpenKey, setSnoozeOpenKey] = useState<string | null>(null)
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const positionRef = useRef<GeoPoint | null>(null)

  useEffect(() => {
    if (showNavSidebar) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNavSidebar])

  const load = useCallback(async (pos?: GeoPoint | null) => {
    const userPosition = pos === undefined ? positionRef.current : pos
    if (userPosition) positionRef.current = userPosition
    try {
      const res = await fetch(`/api/attention${attentionCoordsQuery(userPosition).replace(/^&/, '?')}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as ApiResponse<AttentionFeed>
      if (json.success && json.data) {
        setFeed(json.data)
        setError(null)
        await cacheAttentionFeed(json.data)
        notifyAttentionChanged(json.data.badgeCount)
        return
      }
      throw new Error(json.error || 'Laden fehlgeschlagen')
    } catch (e) {
      const cached = await getCachedAttentionFeed()
      if (cached) {
        setFeed(cached)
        setError(null)
        notifyAttentionChanged(cached.badgeCount)
        return
      }
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const cached = await getCachedAttentionPosition()
      if (cancelled) return
      await load(cached)
      const live = await getLiveAttentionPosition()
      if (cancelled || !live) return
      await rememberAttentionPosition(live)
      const sameSpot =
        cached != null &&
        Math.abs(cached.lat - live.lat) < 0.0008 &&
        Math.abs(cached.lng - live.lng) < 0.0008
      if (sameSpot) return
      await load(live)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [load])

  useReconnectRefetch(() => {
    void load()
  })

  const acceptPackingAdd = async (item: AttentionItem) => {
    if (!item.suggestionId) return
    setAcceptingKey(item.key)
    setError(null)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.suggestionId, action: 'accept' }),
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !json.success) {
        setError(json.error || 'Hinzufügen zur Packliste fehlgeschlagen')
        return
      }
      notifySmartSuggestionsChanged()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hinzufügen zur Packliste fehlgeschlagen')
    } finally {
      setAcceptingKey(null)
    }
  }

  const snooze = async (item: AttentionItem, days: number) => {
    setSnoozingKey(item.key)
    try {
      const pos = positionRef.current
      const res = await fetch('/api/attention/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_key: item.key,
          days,
          ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
        }),
      })
      const json = (await res.json()) as ApiResponse<AttentionFeed> & { error?: string }
      if (!res.ok || !json.success || !json.data) {
        setError(json.error || 'Zurückstellen fehlgeschlagen')
        return
      }
      setFeed(json.data)
      setSnoozeOpenKey(null)
      await cacheAttentionFeed(json.data)
      notifyAttentionChanged(json.data.badgeCount)
    } finally {
      setSnoozingKey(null)
    }
  }

  const items =
    feed?.items.filter((item) => item.kind !== 'vacation_next').slice(0, MAX_ATTENTION_ITEMS) ?? []

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 transition-all duration-300 min-w-0 bg-scroll-pattern', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Heute
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                  {feed?.headline ?? (loading ? 'Laden…' : '—')}
                </p>
              </div>
            </div>
          </div>

          <PushDeviceActivatePrompt
            accountPushEnabled={pushSettings?.enabled ?? false}
            deviceSubscribed={pushSubscribe.subscribed}
            pushSupported={pushSubscribe.supported}
            onActivate={pushSubscribe.subscribe}
            activateError={pushSubscribe.lastError}
            variant="banner"
            className="mx-0 mb-0"
          />

          {loading && !feed ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Laden…</p>
          ) : null}

          {error && !feed ? (
            <p className="text-sm text-destructive py-8 text-center">{error}</p>
          ) : null}

          {feed ? (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-medium tracking-wide text-muted-foreground">
                  Überblick
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <OverviewTile href={feed.packing?.href ?? '/packliste'}>
                    {feed.packing?.weightTone && feed.packing.weightReserveKg != null ? (
                      <span className="absolute top-3 right-3">
                        <PackingWeightBadge
                          tone={feed.packing.weightTone}
                          reserveKg={feed.packing.weightReserveKg}
                        />
                      </span>
                    ) : null}
                    <span
                      className="material-icons text-xl leading-none text-[rgb(45,79,30)]"
                      aria-hidden
                    >
                      checklist
                    </span>
                    <p
                      className={cn(
                        'text-[11px] font-medium uppercase tracking-wide text-muted-foreground',
                        feed.packing?.weightTone && 'pr-14'
                      )}
                    >
                      Packliste
                    </p>
                    {feed.packing ? (
                      <>
                        <p
                          className={cn(
                            'text-sm font-medium text-brand-heading tabular-nums leading-snug',
                            feed.packing.weightTone && 'pr-14'
                          )}
                        >
                          {feed.packing.packed}/{feed.packing.total}
                          <span className="text-muted-foreground font-normal"> gepackt</span>
                        </p>
                        <Progress value={feed.packing.percent} className="h-1.5 mt-auto" />
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {feed.packing.percent} %
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-auto">Packliste öffnen</p>
                    )}
                  </OverviewTile>

                  <OverviewTile href={feed.vacationTile?.href ?? '/urlaube'}>
                    {feed.vacationTile?.countdownKind ? (
                      <span
                        className="absolute top-3 right-3"
                        aria-label={vacationCountdownAria(feed.vacationTile)}
                      >
                        <VacationCountdown tile={feed.vacationTile} />
                      </span>
                    ) : null}
                    <span
                      className="material-icons text-xl leading-none text-[rgb(45,79,30)]"
                      aria-hidden
                    >
                      event
                    </span>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground pr-10">
                      Urlaub
                    </p>
                    {feed.vacationTile ? (
                      <>
                        <p className="text-sm font-medium text-brand-heading leading-snug line-clamp-2 pr-10">
                          {feed.vacationTile.titel}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatHubDateRange(
                            feed.vacationTile.startdatum,
                            feed.vacationTile.enddatum
                          )}
                        </p>
                        {feed.vacationTile.campingplatzName ? (
                          <p className="text-xs text-muted-foreground truncate mt-auto">
                            {feed.vacationTile.campingplatzName}
                            {feed.vacationTile.extraCampingCount > 0
                              ? ` +${feed.vacationTile.extraCampingCount}`
                              : ''}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-auto">Urlaub anlegen</p>
                    )}
                  </OverviewTile>
                </div>
                {feed.travelNav ? <HeuteTravelNav nav={feed.travelNav} /> : null}
              </section>

              {items.length > 0 ? (
                <section className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium tracking-wide text-muted-foreground">
                      Jetzt wichtig
                    </h3>
                    {feed.snoozedCount > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {feed.snoozedCount} zurückgestellt
                      </span>
                    ) : null}
                  </div>
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                  <ul className="space-y-2">
                    {items.map((item) => {
                      const meta = KIND_META[item.kind] ?? { label: 'Hinweis', icon: 'info' }
                      const danger = item.kind === 'wartung_sicherheit' || item.kind === 'packing_weight'
                      const canAddToPacklist =
                        item.suggestionKind === 'packing_add' && Boolean(item.suggestionId)
                      const itemBusy = snoozingKey === item.key || acceptingKey === item.key
                      return (
                        <li key={item.key}>
                          <Card className={cn(danger && 'border-destructive/40')}>
                            <CardContent className="p-3 space-y-2">
                              <Link href={item.href} className="flex items-start gap-3 min-w-0">
                                <span
                                  className={cn(
                                    'material-icons text-xl leading-none mt-0.5 shrink-0',
                                    danger ? 'text-destructive' : 'text-[rgb(45,79,30)]'
                                  )}
                                  aria-hidden
                                >
                                  {meta.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {meta.label}
                                  </p>
                                  <p className="font-medium text-sm text-brand-heading leading-snug">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
                                  {canAddToPacklist && item.vacationTitel ? (
                                    <p className="text-xs font-medium text-brand-heading mt-1">
                                      Packliste: {item.vacationTitel}
                                    </p>
                                  ) : null}
                                  {item.risk ? (
                                    <p className="text-xs text-destructive/80 mt-1 flex items-start gap-1">
                                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                      {item.risk}
                                    </p>
                                  ) : null}
                                </div>
                              </Link>
                              {canAddToPacklist || item.snoozeAllowed ? (
                                <div className="pl-8 flex flex-wrap gap-1.5 items-center">
                                  {canAddToPacklist && snoozeOpenKey !== item.key ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white"
                                      disabled={itemBusy}
                                      onClick={() => void acceptPackingAdd(item)}
                                    >
                                      {acceptingKey === item.key ? 'Fügt hinzu…' : 'Auf die Packliste'}
                                    </Button>
                                  ) : null}
                                  {item.snoozeAllowed ? (
                                    snoozeOpenKey === item.key ? (
                                      <>
                                        {SNOOZE_PRESET_DAYS.map((d) => (
                                          <Button
                                            key={d}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={itemBusy}
                                            onClick={() => void snooze(item, d)}
                                          >
                                            {d === 1 ? '1 Tag' : `${d} Tage`}
                                          </Button>
                                        ))}
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setSnoozeOpenKey(null)}
                                        >
                                          Abbrechen
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-muted-foreground"
                                        disabled={itemBusy}
                                        onClick={() => setSnoozeOpenKey(item.key)}
                                      >
                                        <Clock className="h-3.5 w-3.5 mr-1" />
                                        Später
                                      </Button>
                                    )
                                  ) : null}
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        </li>
                      )
                    })}
                  </ul>
                  {feed.badgeCount > items.length ? (
                    <p className="text-xs text-muted-foreground">
                      +{feed.badgeCount - items.length} weitere in den jeweiligen Bereichen
                    </p>
                  ) : null}
                </section>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center space-y-1">
                    <p className="font-medium text-brand-heading">Alles aktuell</p>
                    <p className="text-sm text-muted-foreground">
                      {feed.vacationTile
                        ? `Nächster Urlaub: ${feed.vacationTile.titel}`
                        : 'Keine offenen Aufgaben im Hub.'}
                    </p>
                    {feed.snoozedCount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {feed.snoozedCount} zurückgestellt
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              <nav className="flex flex-wrap gap-2 pb-8">
                {feed.quickLinks.map((link) => (
                  <Button
                    key={link.href}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(link.href)}
                  >
                    {link.label}
                  </Button>
                ))}
              </nav>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function HeuteHub() {
  return <HeuteHubContent />
}
