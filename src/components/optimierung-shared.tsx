'use client'

import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import type { Optimierung, OptimierungPrioritaet, OptimierungStatus, Vacation } from '@/lib/db'
import {
  FAELLIGKEIT_MODUS_LABEL,
  describeFaelligkeit,
  type OptimierungFaelligkeitModus,
} from '@/lib/optimierung-faelligkeit'
import { cn } from '@/lib/utils'

export const OPT_CHECKBOX_CLASS =
  'h-6 w-6 min-h-6 min-w-6 rounded-md border-2 border-gray-300 data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]'

export const STATUS_LIST_ORDER: OptimierungStatus[] = [
  'in_arbeit',
  'geplant',
  'idee',
  'erledigt',
  'verworfen',
]

export const STATUS_WORKFLOW_OPTIONS: { value: OptimierungStatus; label: string }[] = [
  { value: 'idee', label: 'Idee' },
  { value: 'geplant', label: 'Konkret geplant' },
  { value: 'in_arbeit', label: 'In Arbeit' },
]

export const PRIO_OPTIONS: { value: OptimierungPrioritaet; label: string }[] = [
  { value: 'niedrig', label: 'Niedrig' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'hoch', label: 'Hoch' },
]

export const STATUS_LABEL: Record<OptimierungStatus, string> = {
  idee: 'Idee',
  geplant: 'Konkret geplant',
  in_arbeit: 'In Arbeit',
  erledigt: 'Erledigt',
  verworfen: 'Verworfen',
}

export const PRIO_LABEL: Record<OptimierungPrioritaet, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

export const FAELLIGKEIT_OPTIONS: { value: OptimierungFaelligkeitModus; label: string }[] = [
  { value: 'naechster_urlaub', label: FAELLIGKEIT_MODUS_LABEL.naechster_urlaub },
  { value: 'saisonstart', label: FAELLIGKEIT_MODUS_LABEL.saisonstart },
  { value: 'irgendwann', label: FAELLIGKEIT_MODUS_LABEL.irgendwann },
]

export type OptimierungEditForm = {
  titel: string
  notiz: string
  status: OptimierungStatus
  prioritaet: OptimierungPrioritaet
  faelligkeit_modus: OptimierungFaelligkeitModus | ''
  links: string[]
}

export function emptyOptimierungForm(): OptimierungEditForm {
  return {
    titel: '',
    notiz: '',
    status: 'idee',
    prioritaet: 'mittel',
    faelligkeit_modus: '',
    links: [''],
  }
}

export function formFromOptimierung(item: Optimierung): OptimierungEditForm {
  const urls = (item.links ?? []).map((l) => l.url)
  return {
    titel: item.titel,
    notiz: item.notiz ?? '',
    status: item.status,
    prioritaet: item.prioritaet ?? 'mittel',
    faelligkeit_modus: item.faelligkeit_modus ?? '',
    links: urls.length > 0 ? urls : [''],
  }
}

export function isWorkflowStatus(status: OptimierungStatus): boolean {
  return status === 'idee' || status === 'geplant' || status === 'in_arbeit'
}

export function showsFaelligkeitFields(status: OptimierungStatus): boolean {
  return status !== 'idee' && status !== 'verworfen'
}

export function formatFaelligkeitListLine(
  item: Optimierung,
  vacations: Vacation[]
): string | null {
  if (!item.faelligkeit_modus) return null
  const label = FAELLIGKEIT_MODUS_LABEL[item.faelligkeit_modus]
  const detail = describeFaelligkeit(
    item.faelligkeit_modus,
    item.faellig_am,
    vacations
  )
  return detail ? `${label} · ${detail}` : label
}

export function truncateForUndoToast(s: string, maxLen: number): string {
  const t = s.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

export function openExternalUrl(raw: string): void {
  const trimmed = raw.trim()
  if (!trimmed) return
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  window.open(href, '_blank', 'noopener,noreferrer')
}

export function formatLinkMenuLabel(url: string, maxLen = 40): string {
  const t = url.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

export function optimierungFotoSrc(fotoId: string): string {
  return `/api/optimierungen/fotos/${encodeURIComponent(fotoId)}/image`
}

export function SegmentedButtons<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="mt-1 flex w-full rounded-lg border border-input bg-muted/40 p-0.5"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-2 text-xs sm:text-sm font-medium transition-colors',
              selected
                ? 'bg-[rgb(45,79,30)] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function PrioritaetIcon({ prio }: { prio: OptimierungPrioritaet }) {
  if (prio === 'hoch') {
    return (
      <span
        className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-red-100 px-1.5 text-red-700 ring-1 ring-red-300/80"
        title="Priorität hoch"
        aria-label="Priorität hoch"
      >
        <ChevronsUp className="h-3.5 w-3.5" strokeWidth={2.75} />
      </span>
    )
  }
  if (prio === 'mittel') {
    return (
      <span
        className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-amber-100 px-1.5 text-amber-800"
        title="Priorität mittel"
        aria-label="Priorität mittel"
      >
        <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-slate-600"
      title="Priorität niedrig"
      aria-label="Priorität niedrig"
    >
      <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
    </span>
  )
}
