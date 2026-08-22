'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FaelligkeitAmpelStatus } from '@/lib/faelligkeit-status'
import { FAELLIGKEIT_AMPEL_LABELS } from '@/lib/faelligkeit-status'
import { AlertTriangle, Check, Clock, Info, type LucideIcon } from 'lucide-react'

/** Farben wie Packliste-Checkboxen (grün/orange) + Theme-destructive für Überfällig */
const AMPEL_CLASS: Record<FaelligkeitAmpelStatus, string> = {
  ueberfaellig: 'bg-destructive text-destructive-foreground',
  bald_faellig: 'bg-[rgb(230,126,34)] text-white',
  ok: 'bg-[rgb(45,79,30)] text-white',
  nur_info: 'bg-muted text-muted-foreground',
}

const STATUS_INDICATOR_CLASS: Record<FaelligkeitAmpelStatus, string> = {
  ok: 'bg-[rgb(45,79,30)] border-[rgb(45,79,30)] text-white',
  bald_faellig: 'bg-[rgb(230,126,34)] border-[rgb(230,126,34)] text-white',
  ueberfaellig: 'bg-destructive border-destructive text-destructive-foreground',
  nur_info: 'bg-muted/80 border-gray-300 dark:border-white/20 text-muted-foreground',
}

const STATUS_ICON: Record<FaelligkeitAmpelStatus, LucideIcon> = {
  ok: Check,
  bald_faellig: Clock,
  ueberfaellig: AlertTriangle,
  nur_info: Info,
}

/** Quadratischer Status-Indikator (h-6 w-6 wie Packliste-Checkbox). */
export function FaelligkeitStatusIndicator({
  status,
  className,
}: {
  status: FaelligkeitAmpelStatus
  className?: string
}) {
  const Icon = STATUS_ICON[status]
  return (
    <div
      className={cn(
        'mt-0.5 flex h-6 w-6 min-h-6 min-w-6 shrink-0 items-center justify-center rounded-md border-2',
        STATUS_INDICATOR_CLASS[status],
        className
      )}
      role="img"
      aria-label={FAELLIGKEIT_AMPEL_LABELS[status]}
      title={FAELLIGKEIT_AMPEL_LABELS[status]}
    >
      <Icon
        className={cn('h-3.5 w-3.5', status === 'ok' && 'stroke-[3]')}
        aria-hidden
      />
    </div>
  )
}

export function FaelligkeitAmpelBadge({
  status,
  className,
  compact,
}: {
  status: FaelligkeitAmpelStatus
  className?: string
  compact?: boolean
}) {
  return (
    <Badge
      variant="secondary"
      className={cn('font-normal', AMPEL_CLASS[status], className)}
    >
      {compact ? status === 'ueberfaellig' ? '!' : status === 'bald_faellig' ? '~' : '' : FAELLIGKEIT_AMPEL_LABELS[status]}
    </Badge>
  )
}
