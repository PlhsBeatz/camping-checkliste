'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, Scale, Package, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { formatWeight } from '@/lib/utils'
import { Vacation } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import type {
  PackStatusData,
  PackStatusTransportOverview,
  PackStatusEntryOhneGewicht,
  PackStatusProgressHauptkategorie,
} from '@/lib/db'

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

export default function PackStatusPage() {
  const searchParams = useSearchParams()
  const urlVacationId = searchParams.get('vacation')

  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [packStatus, setPackStatus] = useState<PackStatusData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = (await res.json()) as ApiResponse<Vacation[]>
        if (data.success && data.data) {
          setVacations(data.data)
          if (urlVacationId && data.data.some((v) => v.id === urlVacationId)) {
            setSelectedVacationId(urlVacationId)
          } else if (!selectedVacationId && data.data.length > 0) {
            const next = findNextVacation(data.data)
            if (next) setSelectedVacationId(next.id)
          }
        }
      } catch (e) {
        console.error('Failed to fetch vacations:', e)
      }
    }
    fetchVacations()
  }, [urlVacationId, selectedVacationId])

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
      } else {
        setPackStatus(null)
        setError(data.error ?? 'Pack-Status konnte nicht geladen werden.')
      }
    } catch (e) {
      console.error('Failed to fetch pack status:', e)
      setPackStatus(null)
      setError('Netzwerkfehler beim Laden.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedVacationId])

  useEffect(() => {
    fetchPackStatus()
  }, [fetchPackStatus])

  return (
    <div className="min-h-screen bg-[rgb(250,250,249)] flex max-w-full overflow-x-hidden">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className="flex-1 transition-all duration-300 min-w-0 lg:ml-[280px]">
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden flex-shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[rgb(45,79,30)]">Pack-Status</h1>
                <p className="text-sm text-muted-foreground">Gewicht, Reserve und Packfortschritt</p>
              </div>
            </div>

            {/* Urlaubsauswahl */}
            <div className="flex-shrink-0 w-[220px] sm:w-[260px]">
              <Select
                value={selectedVacationId ?? ''}
                onValueChange={(v) => setSelectedVacationId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Urlaub wählen" />
                </SelectTrigger>
                <SelectContent>
                  {vacations
                    .filter((v) => {
                      const end = new Date(v.enddatum)
                      end.setHours(0, 0, 0, 0)
                      return end >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    })
                    .sort((a, b) => new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime())
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.titel}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedVacationId && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Wählen Sie einen Urlaub aus, um den Pack-Status zu sehen.
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
                    Gewichtsübersicht pro Transportmittel
                  </CardTitle>
                  <CardDescription>
                    Zuladung, Fest installiert, Beladung und berechnete Reserve
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {packStatus.transportOverview.map((t: PackStatusTransportOverview) => (
                      <TransportWeightCard key={t.transportId} data={t} />
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
                  <EntriesOhneGewichtList entries={packStatus.entriesOhneGewicht} />
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
      </div>
    </div>
  )
}

function TransportWeightCard({ data }: { data: PackStatusTransportOverview }) {
  const { transportName, zuladung, festInstalliert, beladung, reserve } = data
  const reservePct = zuladung > 0 ? (reserve / zuladung) * 100 : 0
  const isNegative = reserve < 0
  const isLow = !isNegative && reservePct < 10 && reservePct >= 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-[rgb(45,79,30)] mb-4">{transportName}</h3>

      {/* Stacked bar – visuelle Darstellung */}
      <div className="space-y-3 mb-4">
        <div className="h-8 rounded-lg overflow-hidden flex bg-gray-100">
          <div
            className="bg-amber-200 min-w-0 transition-all"
            style={{
              width: `${zuladung > 0 ? (festInstalliert / zuladung) * 100 : 0}%`,
            }}
            title="Fest installiert"
          />
          <div
            className="bg-[rgb(45,79,30)]/80 min-w-0 transition-all"
            style={{
              width: `${zuladung > 0 ? (beladung / zuladung) * 100 : 0}%`,
            }}
            title="Beladung"
          />
          <div
            className={`min-w-0 flex-1 transition-all ${
              isNegative ? 'bg-red-400' : isLow ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{
              width: `${zuladung > 0 ? Math.max(0, (reserve / zuladung) * 100) : 0}%`,
            }}
            title="Reserve"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground block">Zuladung</span>
            <span className="font-medium">{formatWeight(zuladung)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Fest installiert</span>
            <span className="font-medium">{formatWeight(festInstalliert)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Beladung</span>
            <span className="font-medium">{formatWeight(beladung)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Reserve</span>
            <span
              className={`font-semibold ${
                isNegative ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              {formatWeight(reserve)}
            </span>
          </div>
        </div>
      </div>

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

function EntriesOhneGewichtList({ entries }: { entries: PackStatusEntryOhneGewicht[] }) {
  const byHauptkategorie = entries.reduce<Record<string, PackStatusEntryOhneGewicht[]>>((acc, e) => {
    const k = e.hauptkategorie || 'Ohne Kategorie'
    if (!acc[k]) acc[k] = []
    acc[k].push(e)
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
    <div className="space-y-4">
      {Object.entries(byHauptkategorie).map(([kategorie, items]) => (
        <div key={kategorie}>
          <h4 className="text-sm font-medium text-[rgb(45,79,30)] mb-2">{kategorie}</h4>
          <ul className="space-y-1.5">
            {items.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between text-sm py-1 px-2 rounded bg-gray-50"
              >
                <span>{e.was}</span>
                <span className="text-muted-foreground tabular-nums">× {e.anzahl}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
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
