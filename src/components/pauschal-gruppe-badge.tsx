'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  getPauschalBadgeLabels,
  type PauschalBadgeVariant,
} from '@/lib/pauschal-gruppen'
import type { PackingItem } from '@/lib/db'

interface PauschalGruppeBadgeProps {
  item: PackingItem
  gruppenMap: Map<string, string>
  ownGruppeId?: string | null
  /** Im Filter „Alle“: je Gruppe ein Badge statt „Familie +1“ */
  expandAllGroups?: boolean
  onClick?: () => void
  className?: string
}

const variantClasses: Record<PauschalBadgeVariant, string> = {
  offen: 'border-[rgb(230,126,34)]/50 bg-[rgb(230,126,34)]/15 text-[rgb(230,126,34)] dark:text-[rgb(230,126,34)]',
  gemeinsam: 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
  gruppe: 'border-[rgb(45,79,30)]/40 bg-[rgb(45,79,30)]/10 text-[rgb(45,79,30)] dark:text-green-300',
  mehrere: 'border-[rgb(45,79,30)]/30 bg-[rgb(45,79,30)]/8 text-[rgb(45,79,30)] dark:text-green-300',
  alle_haushalte: 'border-blue-400/40 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200',
}

function BadgeChip({
  label,
  variant,
  gruppeId,
  ownGruppeId,
  onClick,
  className,
}: {
  label: string
  variant: PauschalBadgeVariant
  gruppeId?: string | null
  ownGruppeId?: string | null
  onClick?: () => void
  className?: string
}) {
  const isOwn = variant === 'gruppe' && gruppeId && gruppeId === ownGruppeId

  return (
    <Badge
      variant="outline"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          e.stopPropagation()
          onClick()
        }
      }}
      className={cn(
        'shrink-0 max-w-[8rem] truncate text-[10px] px-1.5 py-0 font-medium',
        variantClasses[variant],
        isOwn && 'ring-1 ring-[rgb(45,79,30)]/60 font-bold',
        onClick && 'cursor-pointer hover:opacity-80 active:scale-95 transition-transform',
        className
      )}
    >
      {label}
    </Badge>
  )
}

export function PauschalGruppeBadge({
  item,
  gruppenMap,
  ownGruppeId,
  expandAllGroups = false,
  onClick,
  className,
}: PauschalGruppeBadgeProps) {
  const badges = getPauschalBadgeLabels(item, gruppenMap, {
    expandAllGroups,
    ownGruppeId: expandAllGroups ? undefined : ownGruppeId,
  })

  if (badges.length === 1) {
    const { label, variant, gruppeId } = badges[0]!
    return (
      <BadgeChip
        label={label}
        variant={variant}
        gruppeId={gruppeId}
        ownGruppeId={ownGruppeId}
        onClick={onClick}
        className={className}
      />
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {badges.map((badge) => (
        <BadgeChip
          key={badge.gruppeId ?? badge.label}
          label={badge.label}
          variant={badge.variant}
          gruppeId={badge.gruppeId}
          ownGruppeId={ownGruppeId}
          onClick={onClick}
          className={className}
        />
      ))}
    </span>
  )
}
