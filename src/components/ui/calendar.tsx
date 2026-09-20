'use client'

import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { DayPicker, useNavigation, type CaptionProps } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const MONTH_CHOICES = Array.from({ length: 12 }, (_, month) => ({
  month,
  label: format(new Date(2020, month, 1), 'MMMM', { locale: de }),
  short: format(new Date(2020, month, 1), 'MMM', { locale: de }),
}))

/** Sichtbare Jahre im Dialog; Pfeile blättern um diese Anzahl weiter. */
const YEAR_PAGE_SIZE = 6

/**
 * Monat + Jahr in einem gemeinsamen Dialog (kein natives System-Dropdown).
 * Wird von Einzeldatum- und Zeitraum-Pickern genutzt.
 */
export function CalendarMonthYearCaption(props: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation()
  const displayMonth = props.displayMonth.getMonth()
  const displayYear = props.displayMonth.getFullYear()
  const [open, setOpen] = React.useState(false)
  const [draftYear, setDraftYear] = React.useState(displayYear)
  const [draftMonth, setDraftMonth] = React.useState(displayMonth)
  /** Erstes Jahr der sichtbaren Seite */
  const [yearPageStart, setYearPageStart] = React.useState(
    () => displayYear - Math.floor((YEAR_PAGE_SIZE - 1) / 2)
  )

  const captionLabel = format(props.displayMonth, 'MMMM yyyy', { locale: de })

  const visibleYears = React.useMemo(
    () => Array.from({ length: YEAR_PAGE_SIZE }, (_, i) => yearPageStart + i),
    [yearPageStart]
  )

  const openPicker = () => {
    setDraftYear(displayYear)
    setDraftMonth(displayMonth)
    setYearPageStart(displayYear - Math.floor((YEAR_PAGE_SIZE - 1) / 2))
    setOpen(true)
  }

  const apply = (month: number, year: number) => {
    goToMonth(new Date(year, month, 1))
    setOpen(false)
  }

  const selectYear = (year: number) => {
    setDraftYear(year)
  }

  return (
    <div className="flex w-full items-center justify-between gap-1 pt-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-8 w-8 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-30'
        )}
        aria-label="Vorheriger Monat"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={openPicker}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-8 min-w-0 flex-1 gap-1 truncate px-2 text-sm font-medium'
        )}
        aria-label="Monat und Jahr wählen"
        aria-haspopup="dialog"
      >
        <span className="truncate">{captionLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>

      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-8 w-8 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-30'
        )}
        aria-label="Nächster Monat"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[340px] gap-4 p-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Monat und Jahr</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Jahr</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-9 w-9 shrink-0 p-0')}
                aria-label={`${YEAR_PAGE_SIZE} Jahre zurück`}
                onClick={() => setYearPageStart((s) => s - YEAR_PAGE_SIZE)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
                {visibleYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => selectYear(y)}
                    className={cn(
                      'rounded-md border px-1 py-2 text-sm font-medium tabular-nums transition-colors',
                      y === draftYear
                        ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)] text-white'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-9 w-9 shrink-0 p-0')}
                aria-label={`${YEAR_PAGE_SIZE} Jahre vor`}
                onClick={() => setYearPageStart((s) => s + YEAR_PAGE_SIZE)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Monat</p>
            <div className="grid grid-cols-3 gap-2">
              {MONTH_CHOICES.map((m) => (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => {
                    setDraftMonth(m.month)
                    apply(m.month, draftYear)
                  }}
                  className={cn(
                    'rounded-md border px-2 py-2.5 text-sm font-medium transition-colors',
                    m.month === draftMonth
                      ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/10 text-brand-heading'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  {m.short}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: customComponents,
  fixedWeeks = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-2 sm:space-x-4 sm:space-y-0 items-start',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
        row: 'flex w-full mt-2',
        cell: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md'
        ),
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100'
        ),
        day_range_start: 'day-range-start',
        day_range_end: 'day-range-end',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside:
          'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...iconProps }) => (
          <ChevronLeft className={cn('h-4 w-4', className)} {...iconProps} />
        ),
        IconRight: ({ className, ...iconProps }) => (
          <ChevronRight className={cn('h-4 w-4', className)} {...iconProps} />
        ),
        Caption: CalendarMonthYearCaption,
        ...(customComponents ?? {}),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
