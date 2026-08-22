'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CaptionProps } from 'react-day-picker'
import { useNavigation } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function SingleCalendarCaption(props: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation()
  return (
    <div className="flex justify-between items-center pt-1 w-full gap-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-30'
        )}
        aria-label="Vorheriger Monat"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium">
        {format(props.displayMonth, 'MMMM yyyy', { locale: de })}
      </span>
      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-30'
        )}
        aria-label="Nächster Monat"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function useIsSmallViewport() {
  const [isSmall, setIsSmall] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const set = () => setIsSmall(mql.matches)
    set()
    mql.addEventListener('change', set)
    return () => mql.removeEventListener('change', set)
  }, [])
  return isSmall
}

export interface CalendarDatePickerProps {
  value: string
  onChange: (ymd: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  dialogTitle?: string
}

/** Einzeldatum – Popover (Desktop) / Dialog (Mobile), wie bei Urlauben. */
export function CalendarDatePicker({
  value,
  onChange,
  placeholder = 'Datum wählen',
  className,
  disabled,
  dialogTitle = 'Datum wählen',
}: CalendarDatePickerProps) {
  const isSmallViewport = useIsSmallViewport()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Date | undefined>()

  const selected = value ? new Date(value) : undefined
  const label = value
    ? format(new Date(value), 'EE, dd. MMM yyyy', { locale: de })
    : placeholder

  const confirm = () => {
    if (!draft) return
    onChange(format(draft, 'yyyy-MM-dd'))
    setOpen(false)
    setDraft(undefined)
  }

  const calendar = (
    <Calendar
      mode="single"
      className="p-2"
      selected={draft ?? selected}
      onSelect={(d) => setDraft(d)}
      defaultMonth={draft ?? selected ?? new Date()}
      locale={de}
      components={{ Caption: SingleCalendarCaption }}
    />
  )

  const okBar = (
    <div className="flex gap-2 p-3 pt-4 bg-muted/30">
      <Button
        type="button"
        size="sm"
        className="flex-1 bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white border-[rgb(45,79,30)]"
        disabled={!draft && !selected}
        onClick={() => {
          if (draft) confirm()
          else if (selected) {
            setOpen(false)
          }
        }}
      >
        OK
      </Button>
    </div>
  )

  if (isSmallViewport) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          onClick={() => {
            setDraft(selected)
            setOpen(true)
          }}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {label}
        </Button>
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen)
            if (!isOpen) setDraft(undefined)
          }}
        >
          <DialogContent className="p-0 gap-0 w-[calc(100vw-2rem)] max-w-[420px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="px-3 pt-2 pb-0">
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center w-full px-2">{calendar}</div>
            {okBar}
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (isOpen) setDraft(selected)
        else setDraft(undefined)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card" align="start">
        {calendar}
        {okBar}
      </PopoverContent>
    </Popover>
  )
}
