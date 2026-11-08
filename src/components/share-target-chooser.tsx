'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarPlus,
  Lightbulb,
  MapPinned,
  PackagePlus,
  Tent,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { ListTile } from '@/components/list-tile'
import { BrandSpinner } from '@/components/brand-spinner'
import { cn } from '@/lib/utils'
import {
  buildShareDestinationHref,
  parseSharePayload,
  pickHighlightedKind,
  scoreShareTargets,
  type SharePayloadInput,
  type ShareTargetKind,
} from '@/lib/share-target'

const OPTION_META: Record<
  ShareTargetKind,
  { title: string; description: string; icon: typeof Tent }
> = {
  campingplatz: {
    title: 'Campingplatz',
    description: 'Als Campingplatz / Stellplatz anlegen',
    icon: Tent,
  },
  rastplatz: {
    title: 'Rastplatz',
    description: 'Als Rast-, Park- oder Tankstelle merken',
    icon: MapPinned,
  },
  ausruestung: {
    title: 'Ausrüstung',
    description: 'Gegenstand anlegen, Link übernehmen',
    icon: PackagePlus,
  },
  optimierung: {
    title: 'Optimierung (Idee)',
    description: 'Idee mit Link anlegen',
    icon: Lightbulb,
  },
  buchung: {
    title: 'Buchungsimport',
    description: 'Text/Mail als Urlaubs-Buchung übernehmen',
    icon: CalendarPlus,
  },
}

export function ShareTargetChooser({ payload }: { payload: SharePayloadInput }) {
  const router = useRouter()
  const { loading, canAccessConfig, canWriteOptimierung } = useAuth()
  const [navigating, setNavigating] = useState<ShareTargetKind | null>(null)

  const parsed = useMemo(() => parseSharePayload(payload), [payload])
  const scores = useMemo(() => scoreShareTargets(parsed), [parsed])

  const allowed = useMemo(() => {
    const set = new Set<ShareTargetKind>()
    if (canAccessConfig) {
      set.add('campingplatz')
      set.add('rastplatz')
      set.add('ausruestung')
      set.add('buchung')
    }
    if (canWriteOptimierung) set.add('optimierung')
    return set
  }, [canAccessConfig, canWriteOptimierung])

  const highlighted = useMemo(
    () => pickHighlightedKind(scores, allowed),
    [scores, allowed]
  )

  const scoreByKind = useMemo(() => {
    const map = new Map<ShareTargetKind, (typeof scores)[number]>()
    for (const s of scores) map.set(s.kind, s)
    return map
  }, [scores])

  const visibleKinds = useMemo(
    () =>
      (Object.keys(OPTION_META) as ShareTargetKind[]).filter((k) => allowed.has(k)),
    [allowed]
  )

  const previewLines = useMemo(() => {
    const lines: string[] = []
    if (parsed.suggestedName) lines.push(parsed.suggestedName)
    if (parsed.primaryUrl) lines.push(parsed.primaryUrl)
    else if (parsed.text && parsed.text !== parsed.suggestedName) {
      lines.push(parsed.text.slice(0, 160) + (parsed.text.length > 160 ? '…' : ''))
    }
    return lines
  }, [parsed])

  const onSelect = (kind: ShareTargetKind) => {
    setNavigating(kind)
    router.push(buildShareDestinationHref(kind, parsed))
  }

  if (loading) {
    return (
      <PageShell>
        <BrandSpinner label="Wird geladen…" />
      </PageShell>
    )
  }

  return (
    <PageShell containerClassName="space-y-6">
      <PageHeader
        title="Geteilten Inhalt übernehmen"
        subtitle="Wohin soll das gespeichert werden?"
      />

      {previewLines.length > 0 ? (
        <div className="rounded-xl border border-subtle bg-muted/40 px-4 py-3 text-sm space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Geteilt
          </p>
          {previewLines.map((line) => (
            <p key={line} className="break-words text-foreground/90">
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Kein Text oder Link erkannt – du kannst trotzdem ein Ziel wählen.
        </p>
      )}

      {visibleKinds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Mit deinem Konto kannst du gerade keinen geteilten Inhalt anlegen.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleKinds.map((kind) => {
            const meta = OPTION_META[kind]
            const Icon = meta.icon
            const score = scoreByKind.get(kind)
            const isHighlight = highlighted === kind
            const reason = score?.reasons[0]
            const busy = navigating === kind

            return (
              <li key={kind}>
                <ListTile asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(kind)}
                    disabled={navigating != null}
                    className={cn(
                      'flex w-full items-start gap-3 text-left transition-colors',
                      'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      isHighlight && 'ring-2 ring-primary/40 bg-brand-muted/40',
                      navigating != null && navigating !== kind && 'opacity-50'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        isHighlight ? 'bg-brand text-white' : 'bg-muted text-brand-heading'
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-brand-heading">{meta.title}</span>
                        {isHighlight ? (
                          <span className="text-xs font-medium text-primary">Vorschlag</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {meta.description}
                      </span>
                      {isHighlight && reason ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {reason}
                        </span>
                      ) : null}
                      {busy ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Öffne…
                        </span>
                      ) : null}
                    </span>
                  </button>
                </ListTile>
              </li>
            )
          })}
        </ul>
      )}
    </PageShell>
  )
}
