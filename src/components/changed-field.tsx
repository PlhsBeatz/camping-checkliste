'use client'

import { useState, type ReactNode } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export const CHANGED_FIELD_RING =
  'ring-2 ring-accent-orange border-accent-orange focus-visible:ring-accent-orange'

export function PreviousValuePopover({
  previousValue,
  onKeepPrevious,
}: {
  previousValue: string
  onKeepPrevious?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-accent-orange hover:bg-accent-orange/10"
          aria-label={`Vorheriger Wert: ${previousValue}`}
          title={`Vorher: ${previousValue}`}
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto p-2.5">
        <p className="text-xs text-muted-foreground">
          Vorher: <span className="font-medium text-foreground">{previousValue}</span>
        </p>
        {onKeepPrevious && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 w-full text-xs"
            onClick={() => {
              onKeepPrevious()
              setOpen(false)
            }}
          >
            Alten Wert behalten
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function ChangedField({
  label,
  previousValue,
  onKeepPrevious,
  children,
}: {
  label: string
  previousValue?: string | null
  onKeepPrevious?: () => void
  children: ReactNode
}) {
  const showHistory = previousValue != null
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 min-h-5">
        <Label>{label}</Label>
        {showHistory && (
          <PreviousValuePopover
            previousValue={previousValue.trim() ? previousValue : '—'}
            onKeepPrevious={onKeepPrevious}
          />
        )}
      </div>
      {children}
    </div>
  )
}
