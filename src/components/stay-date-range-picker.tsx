'use client'

import { useEffect, useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

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

function nightsBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const diff = differenceInCalendarDays(new Date(end), new Date(start))
  return diff > 0 ? diff : 0
}

export type StayDateRangePickerProps = {
  startDatum: string
  endDatum: string
  onChange: (startDatum: string, endDatum: string) => void
  dialogTitle?: string
  emptyLabel?: string
  buttonClassName?: string
  size?: 'sm' | 'default'
}

export function StayDateRangePicker({
  startDatum,
  endDatum,
  onChange,
  dialogTitle = 'Zeitraum wählen',
  emptyLabel = 'Zeitraum wählen',
  buttonClassName,
  size = 'sm',
}: StayDateRangePickerProps) {
  const isSmallViewport = useIsSmallViewport()
  const [open, setOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)

  const hasDates = Boolean(startDatum && endDatum)
  const nights = hasDates ? nightsBetween(startDatum, endDatum) : 0

  const selectedRange: DateRange | undefined =
    startDatum && endDatum
      ? { from: new Date(startDatum), to: new Date(endDatum) }
      : startDatum
        ? { from: new Date(startDatum), to: new Date(startDatum) }
        : undefined

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from) setDraftRange({ from: range.from, to: range.to ?? range.from })
  }

  const confirmRange = () => {
    if (!draftRange?.from) return
    onChange(
      format(draftRange.from, 'yyyy-MM-dd'),
      format((draftRange.to ?? draftRange.from)!, 'yyyy-MM-dd')
    )
    setOpen(false)
    setDraftRange(undefined)
  }

  const triggerLabel = hasDates ? (
    <span className="truncate">
      {format(new Date(startDatum), 'dd.MM.yy', { locale: de })} –{' '}
      {format(new Date(endDatum), 'dd.MM.yy', { locale: de })}
      {nights > 0 && ` · ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}`}
    </span>
  ) : (
    <span>{emptyLabel}</span>
  )

  const calendar = (
    <Calendar
      mode="range"
      className="p-2"
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-1 sm:space-x-4 sm:space-y-0',
        month: 'space-y-1',
      }}
      defaultMonth={draftRange?.from ?? selectedRange?.from ?? new Date()}
      selected={draftRange ?? selectedRange}
      onSelect={handleSelect}
      locale={de}
      numberOfMonths={2}
    />
  )

  const okButton = (
    <Button
      type="button"
      size="sm"
      className="flex-1 bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white border-[rgb(45,79,30)]"
      disabled={!draftRange?.from}
      onClick={confirmRange}
    >
      OK
    </Button>
  )

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(
        'justify-start text-left font-normal',
        size === 'sm' ? 'h-8 w-full' : 'w-full',
        !hasDates && 'text-muted-foreground',
        buttonClassName
      )}
      onClick={
        isSmallViewport
          ? () => {
              setDraftRange(selectedRange)
              setOpen(true)
            }
          : undefined
      }
    >
      <CalendarIcon className={cn('shrink-0', size === 'sm' ? 'mr-2 h-3.5 w-3.5' : 'mr-2 h-4 w-4')} />
      {triggerLabel}
    </Button>
  )

  if (isSmallViewport) {
    return (
      <>
        {triggerButton}
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen)
            if (!isOpen) setDraftRange(undefined)
          }}
        >
          <DialogContent className="p-0 gap-0 w-[calc(100vw-2rem)] max-w-[420px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="px-3 pt-2 pb-0">
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center w-full px-2">{calendar}</div>
            <div className="flex gap-2 p-2 pt-4 bg-muted/30">{okButton}</div>
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
        if (isOpen) setDraftRange(selectedRange)
        else setDraftRange(undefined)
      }}
    >
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card max-h-[80vh] overflow-y-auto" align="start">
        {calendar}
        <div className="flex gap-2 p-3 pt-4 bg-muted/30">{okButton}</div>
      </PopoverContent>
    </Popover>
  )
}
