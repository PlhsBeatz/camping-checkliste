'use client'

import { useMemo } from 'react'
import type { VerbrauchMedium, VerbrauchMessung } from '@/lib/db'
import { formatVerbrauchMitEinheit, verbrauchDifferenz } from '@/lib/verbrauch-format'
import { cn } from '@/lib/utils'

/** Einfacher Vergleich: Verbrauch pro Tag der abgeschlossenen Messungen (Balken). */
export function VerbrauchChart({
  medium,
  messungen,
}: {
  medium: VerbrauchMedium
  messungen: VerbrauchMessung[]
}) {
  const bars = useMemo(() => {
    const completed = messungen
      .filter(
        (m) =>
          m.typ === medium.schluessel &&
          m.wert_start != null &&
          m.wert_ende != null
      )
      .map((m) => {
        const auffuellungen =
          medium.messmodus === 'abnahme' ? (m.auffuellungen_summe ?? 0) : 0
        const gesamt =
          m.verbrauch_gesamt ??
          verbrauchDifferenz(m.wert_start!, m.wert_ende!, medium.messmodus, auffuellungen)
        const proTag = m.verbrauch_pro_tag
        return {
          id: m.id,
          label: m.urlaub_titel?.trim() || 'Ohne Urlaub',
          gesamt,
          proTag,
        }
      })
      .filter((b) => b.proTag != null && b.proTag > 0)
      .slice(0, 8)
      .reverse()

    const max = Math.max(...completed.map((b) => b.proTag ?? 0), 0.01)
    return completed.map((b) => ({
      ...b,
      pct: Math.round(((b.proTag ?? 0) / max) * 100),
    }))
  }, [messungen, medium])

  if (bars.length < 2) {
    return null
  }

  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vergleich
        </h3>
        <span className="text-xs text-muted-foreground">pro Tag</span>
      </div>
      <ul className="space-y-2">
        {bars.map((b) => (
          <li key={b.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{b.label}</span>
              <span className="tabular-nums text-muted-foreground flex-shrink-0">
                {formatVerbrauchMitEinheit(b.proTag, medium.einheit, 2)}
                <span className="text-muted-foreground/70">
                  {' '}
                  · {formatVerbrauchMitEinheit(b.gesamt, medium.einheit, 1)}
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full bg-[rgb(45,79,30)] transition-all duration-500')}
                style={{ width: `${b.pct}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
