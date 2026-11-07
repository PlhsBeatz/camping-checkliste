'use client'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  FEEDBACK_NOTIFY_MODE_OPTIONS,
  type FeedbackNotifyMode,
} from '@/lib/push-settings'
import { cn } from '@/lib/utils'

/** Gemeinsame Radios für Fertigstellung vs. jede Statusänderung. */
export function FeedbackNotifyModeRadios({
  value,
  onChange,
  disabled,
  idPrefix,
  className,
  bordered = false,
}: {
  value: FeedbackNotifyMode
  onChange: (mode: FeedbackNotifyMode) => void
  disabled?: boolean
  idPrefix: string
  className?: string
  bordered?: boolean
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as FeedbackNotifyMode)}
      className={cn('space-y-2', className)}
      disabled={disabled}
    >
      {FEEDBACK_NOTIFY_MODE_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex items-start gap-2.5 text-sm cursor-pointer',
            bordered && 'rounded-md border border-border/40 p-2.5'
          )}
        >
          <RadioGroupItem
            value={opt.value}
            id={`${idPrefix}-${opt.value}`}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="font-medium block">{opt.label}</span>
            <span className="text-xs text-muted-foreground block">{opt.description}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}
