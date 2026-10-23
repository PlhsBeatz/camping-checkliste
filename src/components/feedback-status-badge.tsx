'use client'

import { cn } from '@/lib/utils'
import type { FeedbackStatus, FeedbackType } from '@/lib/github-feedback'

export function FeedbackStatusBadge({
  status,
  label,
}: {
  status: FeedbackStatus
  label: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        status === 'erledigt' &&
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
        status === 'in_test' &&
          'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100',
        status === 'in_progress' &&
          'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
        status === 'todo' && 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100',
        status === 'eingegangen' && 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}

export function FeedbackTypeLabel({ type }: { type: FeedbackType | null }) {
  if (type === 'bug') return <span className="text-xs text-muted-foreground">Fehler</span>
  if (type === 'enhancement') {
    return <span className="text-xs text-muted-foreground">Verbesserung</span>
  }
  return null
}
