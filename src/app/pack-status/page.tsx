'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, Scale, Package, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { formatWeight, parseWeightInput } from '@/lib/utils'
import { Vacation } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import type {
  PackStatusData,
  PackStatusTransportOverview,
  PackStatusEntryOhneGewicht,
  PackStatusProgressHauptkategorie,
  PackEntryWeightScope,
} from '@/lib/db'
import { getCachedVacations, getCachedPackStatus, enqueueSync } from '@/lib/offline-sync'
import { cacheVacations, cachePackStatus } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { showOfflineToast, showOfflineErrorToast, isOffline } from '@/lib/offline-toast'
import { PullToRefreshWrapper } from '@/components/pull-to-refresh-wrapper'
import { WeightInput } from '@/components/ui/weight-input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const findNextVacation = (vacations: Vacation[]): Vacation | null => {
  if (vacations.length === 0) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoffDate = new Date(today)
  cutoffDate.setDate(cutoffDate.getDate() - 7)
  const valid = vacations.filter((v) => {
    const endDate = new Date(v.enddatum)
    endDate.setHours(0, 0, 0, 0)
    return endDate >= cutoffDate
  })
  if (valid.length === 0) return null
  const upcoming = valid.filter((v) => new Date(v.startdatum) >= today)
  const toUse = upcoming.length > 0 ? upcoming : valid
  return toUse.sort((a, b) => new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime())[0] ?? null
}

function PackStatusContent() {
  const searchParams = useSearchParams()
  const urlVacationId = searchParams.get('vacation')

  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [packStatus, setPackStatus] = useState<PackStatusData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sidebar offen: Body-Scroll sperren
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

  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = (await res.json()) as ApiResponse<Vacation[]>
        if (data.success && data.data) {
          setVacations(data.data)
          await cacheVacations(data.data)
          const stored =
            urlVacationId && data.data.some((v) => v.id === urlVacationId)
              ? urlVacationId
              : typeof window !== 'undefined'
                ? sessionStorage.getItem('packlistVacationId')
                : null
          const validStored = stored && data.data.some((v) => v.id === stored)
          if (validStored) {
            setSelectedVacationId(stored)
          } else if (data.data.length > 0) {
            const next = findNextVacation(data.data)
            if (next) setSelectedVacationId(next.id)
          }
        }
      } catch (e) {
        console.error('Failed to fetch vacations:', e)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedVacations()
          if (cached.length > 0) {
            setVacations(cached)
            const stored = typeof window !== 'undefined' ? sessionStorage.getItem('packlistVacationId') : null
            const validStored = stored && cached.some((v) => v.id === stored)
            if (validStored) {
              setSelectedVacationId(stored)
            } else {
              const next = findNextVacation(cached)
              if (next) setSelectedVacationId(next.id)
            }
          }
        }
      }
    }
    fetchVacations()
  }, [urlVacationId])

  const fetchPackStatus = useCallback(async () => {
    if (!selectedVacationId) {
      setPackStatus(null)
      setError(null)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pack-status?vacationId=${selectedVacationId}`)
      const data = (await res.json()) as ApiResponse<PackStatusData>
      if (data.success && data.data) {
        setPackStatus(data.data)
        // In IndexedDB spiegeln, damit der Status auch offline verfügbar ist.
        try {
          await cachePackStatus(selectedVacationId, data.data)
        } catch (cacheErr) {
          console.warn('cachePackStatus failed:', cacheErr)
        }
      } else {
        setPackStatus(null)
        setError(data.error ?? 'Pack-Status konnte nicht geladen werden.')
      }
    } catch (e) {
      console.error('Failed to fetch pack status:', e)
      // Offline-Fallback: zuletzt erfolgreich geladenen Snapshot anzeigen.
      if (isOffline()) {
        const cached = await getCachedPackStatus(selectedVacationId)
        if (cached) {
          setPackStatus(cached)
          setError(null)
          showOfflineToast({ description: 'Pack-Status aus dem lokalen Cache.' })
        } else {
          setPackStatus(null)
          setError('Offline und kein zwischengespeicherter Pack-Status für diesen Urlaub.')
          showOfflineErrorToast('Pack-Status für diesen Urlaub ist offline noch nicht verfügbar.')
        }
      } else {
        setPackStatus(null)
        setError('Netzwerkfehler beim Laden.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedVacationId])

  useEffect(() => {
    fetchPackStatus()
  }, [fetchPackStatus])

  // Bei Reconnect: Pack-Status erneut vom Server holen
  useReconnectRefetch(fetchPackStatus)

  const currentVacation = vacations.find((v) => v.id === selectedVacationId)

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className="flex-1 transition-all duration-300 min-w-0 lg:ml-[280px]">
        <PullToRefreshWrapper onRefresh={fetchPackStatus} disabled={showNavSidebar}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          {/* Header - Sticky, gleiche Größe wie andere Seiten */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
            <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowNavSidebar(true)}
              className="lg:hidden flex-shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-brand-heading">Pack-Status</h1>
              <p className="text-sm text-muted-foreground truncate">
                {currentVacation?.titel ?? '—'}
              </p>
            </div>
          </div>
          </div>

          {!selectedVacationId && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Kein Urlaub für die Packliste. Öffnen Sie die Packliste und wählen Sie einen Urlaub, oder legen Sie einen neuen Urlaub an.
                </p>
              </CardContent>
            </Card>
          )}

          {selectedVacationId && error && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedVacationId && isLoading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Laden…</p>
              </CardContent>
            </Card>
          )}

          {selectedVacationId && !isLoading && packStatus && (
            <div className="space-y-6">
              {/* Gewichtsübersicht pro Transportmittel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Scale className="h-5 w-5" />
                    Gewichtsübersicht
                  </CardTitle>
                  <CardDescription>
                    Kapazität (Zuladung) und Aufteilung in Fest installiert, Beladung und Reserve
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {packStatus.transportOverview.map((t: PackStatusTransportOverview) => (
                      <TransportWeightCard
                        key={t.transportId}
                        data={t}
                        missingWeightCount={
                          packStatus.entriesOhneGewicht.filter((e) => e.transport_id === t.transportId)
                            .length
                        }
                      />
                    ))}
                    {packStatus.transportOverview.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Keine Transportmittel konfiguriert oder keine Packliste vorhanden.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Packlisten-Einträge ohne Gewichtsangabe */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" />
                    Einträge ohne Gewichtsangabe
                  </CardTitle>
                  <CardDescription>
                    Diese Gegenstände sind noch ohne Gewicht. Die Reserve sollte dafür ausreichen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EntriesOhneGewichtList
                    entries={packStatus.entriesOhneGewicht}
                    vacationId={selectedVacationId}
                    onSaved={(data) => {
                      setPackStatus(data)
                      if (selectedVacationId) {
                        void cachePackStatus(selectedVacationId, data)
                      }
                    }}
                  />
                </CardContent>
              </Card>

              {/* Packfortschritt je Hauptkategorie */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5" />
                    Packfortschritt je Hauptkategorie
                  </CardTitle>
                  <CardDescription>
                    Gepackt vs. gesamt pro Kategorie
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProgressByMainCategory items={packStatus.progressHauptkategorien} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        </PullToRefreshWrapper>
      </div>
    </div>
  )
}

function WeightSegmentLabel({
  dotClass,
  label,
  value,
  valueClass,
  style,
  align = 'center',
}: {
  dotClass: string
  label: string
  value: string
  valueClass?: string
  style?: React.CSSProperties
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <div
      className={cn(
        'absolute top-0 text-xs whitespace-nowrap',
        align === 'left' && 'left-0',
        align === 'center' && '-translate-x-1/2',
        align === 'right' && 'right-0 left-auto'
      )}
      style={style}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} aria-hidden />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <p className={cn('font-medium tabular-nums mt-0.5 pl-3.5', valueClass)}>{value}</p>
    </div>
  )
}

function TransportWeightCard({
  data,
  missingWeightCount = 0,
}: {
  data: PackStatusTransportOverview
  missingWeightCount?: number
}) {
  const { transportName, zuladung, festInstalliert, beladung, reserve } = data
  const reservePct = zuladung > 0 ? (reserve / zuladung) * 100 : 0
  const isNegative = reserve < 0
  const isLow = !isNegative && reservePct < 10 && reservePct >= 0

  const festPct = zuladung > 0 ? (festInstalliert / zuladung) * 100 : 0
  const beladPct = zuladung > 0 ? (beladung / zuladung) * 100 : 0
  const reservePctBar = zuladung > 0 ? Math.max(0, (reserve / zuladung) * 100) : 0

  const beladLabelLeft = festPct + beladPct / 2

  const reserveColorClass = isNegative ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'
  const reserveDotClass = isNegative ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="font-semibold text-brand-heading">{transportName}</h3>
        <div className="text-right shrink-0">
          <span className="text-xs text-muted-foreground block">Zuladung</span>
          <span className="font-semibold tabular-nums">{formatWeight(zuladung, 0)}</span>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="h-8 rounded-lg overflow-hidden flex bg-muted">
          <div className="bg-amber-200 min-w-0 transition-all" style={{ width: `${festPct}%` }} title="Fest installiert" />
          <div
            className="bg-[rgb(45,79,30)]/80 min-w-0 transition-all"
            style={{ width: `${beladPct}%` }}
            title="Beladung"
          />
          <div
            className={cn(
              'min-w-0 transition-all',
              isNegative ? 'bg-red-400 flex-1' : isLow ? 'bg-amber-400' : 'bg-emerald-400',
              !isNegative && reservePctBar === 0 && 'flex-1'
            )}
            style={{ width: isNegative ? undefined : `${reservePctBar}%` }}
            title="Reserve"
          />
        </div>

        <div className="sm:hidden space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-200 shrink-0" />
              <span className="text-muted-foreground">Fest installiert</span>
            </div>
            <span className="font-medium tabular-nums">{formatWeight(festInstalliert, 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[rgb(45,79,30)]/80 shrink-0" />
              <span className="text-muted-foreground">Beladung</span>
            </div>
            <span className="font-medium tabular-nums">{formatWeight(beladung, 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', reserveDotClass)} />
              <span className="text-muted-foreground">Reserve</span>
            </div>
            <span className={cn('font-semibold tabular-nums', reserveColorClass)}>
              {formatWeight(reserve, 0)}
            </span>
          </div>
        </div>

        <div className="hidden sm:block relative h-14">
          {festInstalliert > 0 && (
            <WeightSegmentLabel
              dotClass="bg-amber-200"
              label="Fest installiert"
              value={formatWeight(festInstalliert, 0)}
              align="left"
            />
          )}
          {beladPct >= 8 && (
            <WeightSegmentLabel
              dotClass="bg-[rgb(45,79,30)]/80"
              label="Beladung"
              value={formatWeight(beladung, 0)}
              style={{ left: `${beladLabelLeft}%` }}
            />
          )}
          {beladPct < 8 && beladung > 0 && (
            <WeightSegmentLabel
              dotClass="bg-[rgb(45,79,30)]/80"
              label="Beladung"
              value={formatWeight(beladung, 0)}
              style={{ left: `${beladLabelLeft}%` }}
            />
          )}
          <WeightSegmentLabel
            dotClass={reserveDotClass}
            label="Reserve"
            value={formatWeight(reserve, 0)}
            valueClass={cn('font-semibold', reserveColorClass)}
            align="right"
          />
        </div>
      </div>

      {missingWeightCount > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          {missingWeightCount} {missingWeightCount === 1 ? 'Eintrag' : 'Einträge'} ohne Gewicht — Reserve
          kann optimistisch sein.
        </p>
      )}

      {isNegative && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          Überladung – Reserve ist negativ
        </p>
      )}
      {isLow && !isNegative && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          Geringe Reserve ({reservePct.toFixed(0)}%)
        </p>
      )}
    </div>
  )
}

function MissingWeightEntryRow({
  entry,
  vacationId,
  onSaved,
}: {
  entry: PackStatusEntryOhneGewicht
  vacationId: string
  onSaved: (data: PackStatusData) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [weightStr, setWeightStr] = useState('')
  const [scope, setScope] = useState<PackEntryWeightScope>('equipment')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedWeight = parseWeightInput(weightStr)
  const effectiveQty = entry.effective_anzahl ?? entry.anzahl
  const totalWeight =
    parsedWeight != null && parsedWeight > 0 && effectiveQty > 0
      ? parsedWeight * effectiveQty
      : null
  const isPersonBound = entry.mitreisenden_typ != null && entry.mitreisenden_typ !== 'pauschal'

  const handleSave = async () => {
    if (parsedWeight == null || parsedWeight <= 0) {
      setError('Bitte ein gültiges Gewicht eingeben.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      packEntryId: entry.id,
      weight: parsedWeight,
      scope: entry.is_temporaer ? ('packlist' as const) : scope,
    }

    try {
      const res = await fetch('/api/pack-status/entry-weight', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as ApiResponse<PackStatusData>
      if (data.success && data.data) {
        onSaved(data.data)
        setExpanded(false)
        setWeightStr('')
        return
      }
      setError(data.error ?? 'Speichern fehlgeschlagen.')
    } catch {
      if (isOffline()) {
        await enqueueSync('pack-status-entry-weight', 'patch', entry.id, payload, { vacationId })
        showOfflineToast({ description: 'Gewicht wird synchronisiert, sobald Sie online sind.' })
        setExpanded(false)
        setWeightStr('')
        setError(null)
        return
      }
      setError('Netzwerkfehler beim Speichern.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-sm py-2 px-3 bg-muted/60 hover:bg-muted transition-colors text-left"
      >
        <span className="font-medium">{entry.was}</span>
        <span className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-muted-foreground tabular-nums text-right">
            × {effectiveQty}
            {isPersonBound && entry.personen_anzahl != null && entry.personen_anzahl > 0 && (
              <span className="block text-[10px]">
                {entry.personen_anzahl} {entry.personen_anzahl === 1 ? 'Person' : 'Personen'}
              </span>
            )}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="p-3 space-y-4 bg-card border-t border-border">
          <div>
            <Label htmlFor={`weight-${entry.id}`} className="text-xs text-muted-foreground mb-1.5 block">
              Gewicht (Stück)
            </Label>
            <WeightInput
              id={`weight-${entry.id}`}
              value={weightStr}
              onChange={(v) => {
                setWeightStr(v)
                setError(null)
              }}
              placeholder="0"
              className="max-w-[160px]"
            />
          </div>

          {!entry.is_temporaer && (
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as PackEntryWeightScope)}
              className="space-y-3"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="equipment" id={`scope-equipment-${entry.id}`} className="mt-0.5" />
                <Label htmlFor={`scope-equipment-${entry.id}`} className="font-normal cursor-pointer">
                  <span className="font-medium block">In Ausrüstung speichern</span>
                  <span className="text-xs text-muted-foreground">Gilt für alle Urlaube</span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="packlist" id={`scope-packlist-${entry.id}`} className="mt-0.5" />
                <Label htmlFor={`scope-packlist-${entry.id}`} className="font-normal cursor-pointer">
                  <span className="font-medium block">Nur für diesen Urlaub</span>
                  <span className="text-xs text-muted-foreground">
                    Z. B. wenn die Menge diesmal anders ist
                  </span>
                </Label>
              </div>
            </RadioGroup>
          )}

          {entry.is_temporaer && (
            <p className="text-xs text-muted-foreground">
              Temporärer Eintrag — Gewicht gilt nur für diese Packliste.
            </p>
          )}

          {totalWeight != null && (
            <p className="text-sm text-muted-foreground">
              Gesamt: <span className="font-medium text-foreground">{formatWeight(totalWeight, 1)}</span>
              {' '}
              ({effectiveQty} × {formatWeight(parsedWeight!, 1)}
              {isPersonBound && entry.personen_anzahl != null && entry.personen_anzahl > 0
                ? ` · ${entry.personen_anzahl} ${entry.personen_anzahl === 1 ? 'Person' : 'Personen'}`
                : ''}
              )
            </p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button size="sm" onClick={handleSave} disabled={saving || parsedWeight == null || parsedWeight <= 0}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Speichern…
              </>
            ) : (
              'Speichern'
            )}
          </Button>
        </div>
      )}
    </li>
  )
}

function EntriesOhneGewichtList({
  entries,
  vacationId,
  onSaved,
}: {
  entries: PackStatusEntryOhneGewicht[]
  vacationId: string
  onSaved: (data: PackStatusData) => void
}) {
  // Nach Transport gruppieren, dann nach Hauptkategorie
  const byTransport = entries.reduce<Record<string, PackStatusEntryOhneGewicht[]>>((acc, e) => {
    const transportKey = e.transport_name?.trim() || 'Ohne Transport'
    if (!acc[transportKey]) acc[transportKey] = []
    acc[transportKey].push(e)
    return acc
  }, {})

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Alle Packlisten-Einträge haben eine Gewichtsangabe.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(byTransport).map(([transportName, transportItems]) => {
        const byHauptkategorie = transportItems.reduce<Record<string, PackStatusEntryOhneGewicht[]>>(
          (acc, e) => {
            const k = e.hauptkategorie || 'Ohne Kategorie'
            if (!acc[k]) acc[k] = []
            acc[k].push(e)
            return acc
          },
          {}
        )
        return (
          <div key={transportName}>
            <h3 className="text-sm font-semibold text-brand-heading mb-3">{transportName}</h3>
            <div className="space-y-4 pl-2 border-l-2 border-border">
              {Object.entries(byHauptkategorie).map(([kategorie, items]) => (
                <div key={`${transportName}-${kategorie}`}>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{kategorie}</h4>
                  <ul className="space-y-1.5">
                    {items.map((e) => (
                      <MissingWeightEntryRow
                        key={e.id}
                        entry={e}
                        vacationId={vacationId}
                        onSaved={onSaved}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProgressByMainCategory({ items }: { items: PackStatusProgressHauptkategorie[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein Packfortschritt verfügbar (leere Packliste?).
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.hauptkategorie}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="font-medium">{item.hauptkategorie}</span>
            <span className="text-muted-foreground tabular-nums">
              {item.gepackt} / {item.gesamt} ({item.prozent}%)
            </span>
          </div>
          <Progress value={item.prozent} className="h-2" />
        </div>
      ))}
    </div>
  )
}

export default function PackStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-scroll-pattern flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(45,79,30)] mx-auto mb-4" />
            <p className="text-muted-foreground">Lädt…</p>
          </div>
        </div>
      }
    >
      <PackStatusContent />
    </Suspense>
  )
}
