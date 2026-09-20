'use client'

import { useId, useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import type { VerbrauchMedium, VerbrauchMessung } from '@/lib/db'
import { formatVerbrauch } from '@/lib/verbrauch-format'
import {
  computeAlleVerbrauchUebersichten,
  VERBRAUCH_UEBERSICHT_JAHRE,
  type VerbrauchUebersichtStats,
} from '@/lib/verbrauch-uebersicht'
import { cn } from '@/lib/utils'

function Sparkline({
  punkte,
  gradientId,
}: {
  punkte: VerbrauchUebersichtStats['punkte']
  gradientId: string
}) {
  const data = useMemo(
    () => punkte.map((p) => ({ v: p.proTag, datum: p.datum })),
    [punkte]
  )

  if (data.length < 2) {
    return null
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(45,79,30)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="rgb(45,79,30)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area
          type="monotone"
          dataKey="v"
          stroke="rgb(45,79,30)"
          strokeWidth={1.5}
          strokeOpacity={0.45}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function UebersichtKarte({
  stats,
  selected,
  onSelect,
}: {
  stats: VerbrauchUebersichtStats
  selected: boolean
  onSelect: () => void
}) {
  const uid = useId().replace(/:/g, '')
  const { medium, durchschnittProTag, punkte, tripCount } = stats
  const hasSpark = punkte.length >= 2

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-colors',
        'hover:border-[rgb(45,79,30)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]/40',
        selected && 'border-[rgb(45,79,30)] ring-1 ring-[rgb(45,79,30)]/30'
      )}
    >
      {hasSpark && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 top-8 opacity-90"
          aria-hidden
        >
          <Sparkline punkte={punkte} gradientId={`verbr-grad-${uid}`} />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-1 px-4 py-3.5 min-h-[7.5rem]">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {medium.name}
        </p>
        <div className="mt-auto">
          {durchschnittProTag != null ? (
            <>
              <p className="text-3xl font-bold tracking-tight tabular-nums text-brand-heading leading-none">
                {formatVerbrauch(durchschnittProTag, 2)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {medium.einheit}/Tag
                <span className="text-muted-foreground/70">
                  {' '}
                  · {tripCount} {tripCount === 1 ? 'Reise' : 'Reisen'}
                  {punkte.length > 0
                    ? ` · ${VERBRAUCH_UEBERSICHT_JAHRE} J.`
                    : ''}
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold tracking-tight text-muted-foreground/40 leading-none">
                —
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Noch keine abgeschlossenen Messungen</p>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

export function VerbrauchUebersichtKarten({
  medien,
  messungen,
  activeSchluessel,
  onSelect,
}: {
  medien: VerbrauchMedium[]
  messungen: VerbrauchMessung[]
  activeSchluessel: string
  onSelect: (schluessel: string) => void
}) {
  const stats = useMemo(
    () => computeAlleVerbrauchUebersichten(medien, messungen),
    [medien, messungen]
  )

  if (medien.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((s) => (
        <UebersichtKarte
          key={s.medium.id}
          stats={s}
          selected={activeSchluessel === s.medium.schluessel}
          onSelect={() => onSelect(s.medium.schluessel)}
        />
      ))}
    </div>
  )
}
