"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import { DayPicker, useNavigation, type CaptionProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const MONTH_CHOICES = Array.from({ length: 12 }, (_, month) => ({
  month,
  label: format(new Date(2020, month, 1), "MMMM", { locale: de }),
}))

function yearChoicesAround(centerYear: number): number[] {
  const from = centerYear - 15
  const to = centerYear + 20
  const years: number[] = []
  for (let y = from; y <= to; y++) years.push(y)
  return years
}

const captionSelectClass =
  "h-8 max-w-[9.5rem] rounded-md border border-input bg-background px-1.5 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Monat- und Jahres-Dropdowns, damit ferne Daten ohne viele Klicks erreichbar sind. */
export function CalendarMonthYearCaption(props: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation()
  const month = props.displayMonth.getMonth()
  const year = props.displayMonth.getFullYear()
  const years = yearChoicesAround(new Date().getFullYear())
  if (!years.includes(year)) {
    years.push(year)
    years.sort((a, b) => a - b)
  }
  const uid = React.useId()
  const monthSelectId = `${uid}-month`
  const yearSelectId = `${uid}-year`

  const jumpTo = (nextMonthIndex: number, nextYear: number) => {
    goToMonth(new Date(nextYear, nextMonthIndex, 1))
  }

  return (
    <div className="flex w-full items-center justify-between gap-1 pt-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-30"
        )}
        aria-label="Vorheriger Monat"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
        <label className="sr-only" htmlFor={monthSelectId}>
          Monat
        </label>
        <select
          id={monthSelectId}
          className={captionSelectClass}
          value={month}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => jumpTo(Number(e.target.value), year)}
        >
          {MONTH_CHOICES.map((m) => (
            <option key={m.month} value={m.month}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={yearSelectId}>
          Jahr
        </label>
        <select
          id={yearSelectId}
          className={cn(captionSelectClass, "max-w-[5.5rem]")}
          value={year}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => jumpTo(month, Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:opacity-30"
        )}
        aria-label="Nächster Monat"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
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
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-2 sm:space-x-4 sm:space-y-0 items-start",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...iconProps }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...iconProps} />
        ),
        IconRight: ({ className, ...iconProps }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...iconProps} />
        ),
        Caption: CalendarMonthYearCaption,
        ...(customComponents ?? {}),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
