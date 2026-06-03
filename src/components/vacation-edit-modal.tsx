'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MitreisendeManager } from '@/components/mitreisende-manager'
import { cn } from '@/lib/utils'
import { getCachedCampingplaetze } from '@/lib/offline-sync'
import type { ApiResponse } from '@/lib/api-types'
import type { Campingplatz, Mitreisender, Vacation } from '@/lib/db'
import { deriveReisezielName } from '@/lib/vacation-helpers'
import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { useNavigation, type CaptionProps } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react'

export type VacationEditModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vacationId?: string | null
  onSaved?: (result: {
    vacation: Vacation
    campingplaetze: Campingplatz[]
    isNew: boolean
  }) => void
}

type VacationStayApi = {
  id: string
  campingplatz_id: string
  start_datum: string | null
  end_datum: string | null
}

type VacationEditResponse = {
  vacation: Vacation
  mitreisende: Mitreisender[]
  campingplaetze: Campingplatz[]
  stays?: VacationStayApi[]
}

/** Lokaler Bearbeitungszustand für einen Campingplatz-Aufenthalt. */
type StayDraft = {
  key: string
  campingplatzId: string
  /** 'yyyy-MM-dd' oder '' */
  startDatum: string
  endDatum: string
}

/** Sortiert Aufenthalte nach Startdatum; undatierte ans Ende. */
function sortStays(stays: StayDraft[]): StayDraft[] {
  return [...stays].sort((a, b) => {
    if (!a.startDatum && !b.startDatum) return 0
    if (!a.startDatum) return 1
    if (!b.startDatum) return -1
    return a.startDatum.localeCompare(b.startDatum)
  })
}

/**
 * FLIP-Animation: verschiebt umsortierte Listenzeilen dezent von ihrer alten an die neue Position.
 * Liefert eine ref-Callback, mit der jede Zeile (per stabilem Key) registriert wird.
 */
function useFlipReorder() {
  const elements = useRef(new Map<string, HTMLElement>())
  const positions = useRef(new Map<string, number>())

  const register = useCallback((key: string, el: HTMLElement | null) => {
    if (el) elements.current.set(key, el)
    else elements.current.delete(key)
  }, [])

  useEffect(() => {
    const next = new Map<string, number>()
    elements.current.forEach((el, key) => {
      next.set(key, el.getBoundingClientRect().top)
    })
    next.forEach((top, key) => {
      const old = positions.current.get(key)
      if (old != null && Math.abs(old - top) > 1) {
        const el = elements.current.get(key)
        el?.animate?.(
          [
            { transform: `translateY(${old - top}px)` },
            { transform: 'translateY(0px)' },
          ],
          { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
        )
      }
    })
    positions.current = next
  })

  return register
}

/** Anzahl Nächte zwischen zwei ISO-Daten (>= 0). */
function nightsBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const diff = differenceInCalendarDays(new Date(end), new Date(start))
  return diff > 0 ? diff : 0
}

/**
 * Vorbelegung für einen neu hinzugefügten Aufenthalt:
 * im Anschluss an den spätesten datierten Aufenthalt (1 Nacht), sonst der Seed-Zeitraum.
 */
function computeDefaultStayDates(
  stays: StayDraft[],
  seedStart: string,
  seedEnd: string
): { startDatum: string; endDatum: string } {
  const datedEnds = stays
    .map((s) => s.endDatum)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => a.localeCompare(b))
  const lastEnd = datedEnds[datedEnds.length - 1]
  if (lastEnd) {
    const start = lastEnd
    const end = format(addDays(new Date(start), 1), 'yyyy-MM-dd')
    return { startDatum: start, endDatum: end }
  }
  if (seedStart) {
    return { startDatum: seedStart, endDatum: seedEnd || seedStart }
  }
  const today = format(new Date(), 'yyyy-MM-dd')
  return { startDatum: today, endDatum: format(addDays(new Date(), 1), 'yyyy-MM-dd') }
}

type VacationFormState = {
  titel: string
  startdatum: string
  abfahrtdatum: string
  enddatum: string
  reiseziel_name: string
  reiseziel_adresse: string
  land_region: string
  packliste_default_ansicht: 'packliste' | 'alles'
}

const emptyVacationForm = (): VacationFormState => ({
  titel: '',
  startdatum: '',
  abfahrtdatum: '',
  enddatum: '',
  reiseziel_name: '',
  reiseziel_adresse: '',
  land_region: '',
  packliste_default_ansicht: 'packliste',
})

/** Caption mit eigener Navigation pro Monat (für Mobile, wenn zwei Monate untereinander stehen) */
function RangeCalendarCaption(props: CaptionProps) {
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

/** True wenn Viewport schmal (z. B. Smartphone/Tablet) – dann Daterangepicker als Dialog statt Popover */
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

function StayRow({
  stay,
  campingplatz,
  overlapHint,
  onChangeDates,
  onRemove,
}: {
  stay: StayDraft
  campingplatz: Campingplatz | undefined
  overlapHint: string | null
  onChangeDates: (startDatum: string, endDatum: string) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)

  const hasDates = Boolean(stay.startDatum && stay.endDatum)
  const nights = hasDates ? nightsBetween(stay.startDatum, stay.endDatum) : 0

  const selectedRange: DateRange | undefined =
    stay.startDatum && stay.endDatum
      ? { from: new Date(stay.startDatum), to: new Date(stay.endDatum) }
      : stay.startDatum
      ? { from: new Date(stay.startDatum), to: new Date(stay.startDatum) }
      : undefined

  return (
    <div className="flex items-start gap-2 py-2 px-2 rounded-md bg-muted/60 border border-muted-foreground/10">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div>
          <div className="text-sm font-medium truncate">
            {campingplatz?.name ?? 'Unbekannter Campingplatz'}
          </div>
          {campingplatz && (
            <div className="text-xs text-muted-foreground truncate">
              {campingplatz.ort}, {campingplatz.land}
              {campingplatz.bundesland && ` (${campingplatz.bundesland})`}
            </div>
          )}
        </div>
        <Popover
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen)
            if (isOpen) setDraftRange(selectedRange)
            else setDraftRange(undefined)
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('h-8 justify-start text-left font-normal', !hasDates && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
              {hasDates ? (
                <span className="truncate">
                  {format(new Date(stay.startDatum), 'dd.MM.yy', { locale: de })} –{' '}
                  {format(new Date(stay.endDatum), 'dd.MM.yy', { locale: de })}
                  {nights > 0 && ` · ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}`}
                </span>
              ) : (
                <span>Dauer wählen</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-white max-h-[80vh] overflow-y-auto" align="start">
            <Calendar
              mode="range"
              className="p-2"
              classNames={{
                months: 'flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4',
                month: 'space-y-1',
              }}
              defaultMonth={draftRange?.from ?? selectedRange?.from ?? new Date()}
              selected={draftRange ?? selectedRange}
              onSelect={(range: DateRange | undefined) => {
                if (range?.from) {
                  setDraftRange({ from: range.from, to: range.to ?? range.from })
                }
              }}
              locale={de}
              numberOfMonths={2}
              components={{ Caption: RangeCalendarCaption }}
            />
            <div className="flex gap-2 p-3 border-t bg-muted/30">
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white border-[rgb(45,79,30)]"
                disabled={!draftRange?.from}
                onClick={() => {
                  if (!draftRange?.from) return
                  onChangeDates(
                    format(draftRange.from, 'yyyy-MM-dd'),
                    format((draftRange.to ?? draftRange.from)!, 'yyyy-MM-dd')
                  )
                  setOpen(false)
                  setDraftRange(undefined)
                }}
              >
                OK
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {overlapHint && <p className="text-xs text-amber-600">{overlapHint}</p>}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label="Campingplatz entfernen"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function VacationEditModal({
  open,
  onOpenChange,
  vacationId = null,
  onSaved,
}: VacationEditModalProps) {
  const isSmallViewport = useIsSmallViewport()
  const [isLoading, setIsLoading] = useState(false)
  const [allCampingplaetze, setAllCampingplaetze] = useState<Campingplatz[]>([])
  const [stays, setStays] = useState<StayDraft[]>([])
  const [campingSearchOpen, setCampingSearchOpen] = useState(false)
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  const [newVacationForm, setNewVacationForm] = useState<VacationFormState>(emptyVacationForm)
  const [showVacationSettingsModal, setShowVacationSettingsModal] = useState(false)
  const [abfahrtPopoverOpen, setAbfahrtPopoverOpen] = useState(false)
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)

  const isEditing = Boolean(vacationId)
  const registerStayRow = useFlipReorder()

  const campingplatzById = useMemo(() => {
    const map = new Map<string, Campingplatz>()
    for (const c of allCampingplaetze) map.set(c.id, c)
    return map
  }, [allCampingplaetze])

  const sortedStays = useMemo(() => sortStays(stays), [stays])

  /** Eindeutige Campingplätze in Datumsreihenfolge (für onSaved / Reiseziel-Ableitung). */
  const orderedDistinctCampIds = useMemo(() => {
    const seen = new Set<string>()
    const ids: string[] = []
    for (const s of sortedStays) {
      if (seen.has(s.campingplatzId)) continue
      seen.add(s.campingplatzId)
      ids.push(s.campingplatzId)
    }
    return ids
  }, [sortedStays])

  /** Abgeleiteter Reisezeitraum (für die Anzeige im Bearbeiten-Modus). */
  const derivedRangeLabel = useMemo(() => {
    const dated = sortedStays.filter((s) => s.startDatum && s.endDatum)
    const start = dated.length
      ? dated.map((s) => s.startDatum).sort((a, b) => a.localeCompare(b))[0]
      : newVacationForm.startdatum
    const end = dated.length
      ? dated.map((s) => s.endDatum).sort((a, b) => b.localeCompare(a))[0]
      : newVacationForm.enddatum
    if (!start || !end) return 'Noch kein Datum – über die Dauer eines Campingplatzes festlegen.'
    return `${format(new Date(start), 'EE, dd. MMM yyyy', { locale: de })} – ${format(
      new Date(end),
      'EE, dd. MMM yyyy',
      { locale: de }
    )}`
  }, [sortedStays, newVacationForm.startdatum, newVacationForm.enddatum])

  /** Überlappungs-/Lücken-Hinweise je Aufenthalt (nur Hinweis, kein Blocker). */
  const overlapHints = useMemo(() => {
    const hints = new Map<string, string>()
    const dated = sortedStays.filter((s) => s.startDatum && s.endDatum)
    for (let i = 1; i < dated.length; i++) {
      const prev = dated[i - 1]
      const cur = dated[i]
      if (!prev || !cur) continue
      if (cur.startDatum < prev.endDatum) {
        hints.set(cur.key, 'Überlappt mit dem vorherigen Aufenthalt.')
      } else if (cur.startDatum > prev.endDatum) {
        hints.set(cur.key, 'Lücke zum vorherigen Aufenthalt.')
      }
    }
    return hints
  }, [sortedStays])

  const resetInternalState = () => {
    setIsLoading(false)
    setNewVacationForm(emptyVacationForm())
    setVacationMitreisende([])
    setStays([])
    setCampingSearchOpen(false)
    setShowVacationSettingsModal(false)
    setAbfahrtPopoverOpen(false)
    setRangePopoverOpen(false)
    setDraftRange(undefined)
  }

  const handleClose = () => {
    resetInternalState()
    onOpenChange(false)
  }

  useEffect(() => {
    if (!open) return

    const loadCamping = async () => {
      try {
        const resAll = await fetch('/api/campingplaetze')
        const dataAll = (await resAll.json()) as ApiResponse<Campingplatz[]>
        if (dataAll.success && dataAll.data) {
          setAllCampingplaetze(dataAll.data)
        }
      } catch (error) {
        console.error('Failed to fetch campingplaetze:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedCampingplaetze()
          if (cached.length > 0) setAllCampingplaetze(cached)
        }
      }
    }

    void loadCamping()
  }, [open])

  useEffect(() => {
    if (!open) return

    if (!vacationId) {
      resetInternalState()
      return
    }

    const loadVacationDetails = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/vacations/${vacationId}`)
        const data = (await res.json()) as ApiResponse<VacationEditResponse>
        if (data.success && data.data) {
          const payload = data.data
          const vacation = payload.vacation
          setNewVacationForm({
            titel: vacation.titel,
            startdatum: vacation.startdatum,
            abfahrtdatum: vacation.abfahrtdatum || '',
            enddatum: vacation.enddatum,
            reiseziel_name: vacation.reiseziel_name,
            reiseziel_adresse: vacation.reiseziel_adresse || '',
            land_region: vacation.land_region || '',
            packliste_default_ansicht: (
              vacation.packliste_default_ansicht === 'alles' ? 'alles' : 'packliste'
            ) as 'packliste' | 'alles',
          })
          setVacationMitreisende(payload.mitreisende ?? [])
          const apiStays = payload.stays ?? []
          if (apiStays.length > 0) {
            setStays(
              apiStays.map((s) => ({
                key: s.id || crypto.randomUUID(),
                campingplatzId: s.campingplatz_id,
                startDatum: s.start_datum ?? '',
                endDatum: s.end_datum ?? '',
              }))
            )
          } else {
            // Fallback (z. B. veraltete Antwort ohne stays): Plätze ohne Datum übernehmen.
            setStays(
              (payload.campingplaetze ?? []).map((c) => ({
                key: crypto.randomUUID(),
                campingplatzId: c.id,
                startDatum: '',
                endDatum: '',
              }))
            )
          }
        } else {
          alert('Fehler beim Laden des Urlaubs: ' + (data.error ?? 'Unbekannt'))
        }
      } catch (error) {
        console.error('Failed to fetch vacation details:', error)
        alert('Fehler beim Laden des Urlaubs')
      } finally {
        setIsLoading(false)
      }
    }

    void loadVacationDetails()
  }, [open, vacationId])

  const handleSaveVacation = async () => {
    // Reisezeitraum wird aus den datierten Aufenthalten abgeleitet; der Seed-Zeitraum
    // (Eingabefeld beim Anlegen bzw. die bereits gespeicherten Urlaubsdaten) dient als Rückfall.
    const datedStays = sortedStays.filter((s) => s.startDatum && s.endDatum)
    const derivedStart = datedStays.length
      ? datedStays.map((s) => s.startDatum).sort((a, b) => a.localeCompare(b))[0]
      : ''
    const derivedEnd = datedStays.length
      ? datedStays.map((s) => s.endDatum).sort((a, b) => b.localeCompare(a))[0]
      : ''
    const vacationStart = derivedStart || newVacationForm.startdatum
    const vacationEnd = derivedEnd || newVacationForm.enddatum

    if (!newVacationForm.titel) {
      alert('Bitte geben Sie einen Titel ein.')
      return
    }
    if (!vacationStart || !vacationEnd) {
      alert(
        'Bitte legen Sie einen Reisezeitraum fest – entweder über das Datumsfeld oder über die Dauer eines Campingplatzes.'
      )
      return
    }

    setIsLoading(true)
    try {
      const method = isEditing ? 'PUT' : 'POST'
      const { packliste_default_ansicht, ...restForm } = newVacationForm
      const normalizedReisezielName = deriveReisezielName(
        restForm.reiseziel_name,
        orderedDistinctCampIds,
        allCampingplaetze
      )
      const body = {
        ...restForm,
        startdatum: vacationStart,
        enddatum: vacationEnd,
        reiseziel_name: normalizedReisezielName,
        packliste_default_ansicht,
        ...(isEditing ? { id: vacationId } : {}),
      }

      const res = await fetch('/api/vacations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as ApiResponse<Vacation>
      if (data.success && data.data) {
        let savedVacation = data.data
        const vacationIdForCamping = savedVacation.id

        try {
          const campingRes = await fetch('/api/vacations/campingplaetze', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              urlaubId: vacationIdForCamping,
              stays: sortedStays.map((s) => ({
                campingplatzId: s.campingplatzId,
                startDatum: s.startDatum || null,
                endDatum: s.endDatum || null,
              })),
            }),
          })
          const campingData = (await campingRes.json()) as {
            success?: boolean
            error?: string
            data?: { vacation?: Vacation | null }
          }
          if (!campingData.success) {
            alert(
              'Fehler beim Speichern der Campingplätze: ' + (campingData.error ?? 'Unbekannt')
            )
            return
          }
          // Server leitet startdatum/enddatum aus den Aufenthalten ab und liefert den
          // aktualisierten Urlaub zurück.
          if (campingData.data?.vacation) savedVacation = campingData.data.vacation
        } catch (error) {
          console.error('Failed to save vacation campingplaetze:', error)
          alert('Fehler beim Speichern der Campingplätze.')
          return
        }

        if (!isEditing && vacationMitreisende.length > 0) {
          const selectedIds = vacationMitreisende.map((m) => m.id)
          await fetch('/api/mitreisende', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vacationId: vacationIdForCamping,
              mitreisendeIds: selectedIds,
            }),
          })
        }

        const distinctCampingplaetze = orderedDistinctCampIds
          .map((id) => campingplatzById.get(id))
          .filter((c): c is Campingplatz => Boolean(c))

        onSaved?.({
          vacation: savedVacation,
          campingplaetze: distinctCampingplaetze,
          isNew: !isEditing,
        })
        handleClose()
      } else {
        alert('Fehler beim Speichern des Urlaubs: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to save vacation:', error)
      alert('Fehler beim Speichern des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCamping = (campingplatzId: string) => {
    setStays((prev) => {
      const def = computeDefaultStayDates(
        prev,
        newVacationForm.startdatum,
        newVacationForm.enddatum
      )
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          campingplatzId,
          startDatum: def.startDatum,
          endDatum: def.endDatum,
        },
      ]
    })
  }

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleClose()
            return
          }
          onOpenChange(true)
        }}
        title={isEditing ? 'Urlaub bearbeiten' : 'Neuen Urlaub erstellen'}
        description={
          isEditing
            ? 'Bearbeiten Sie die Details des Urlaubs'
            : 'Geben Sie die Details für Ihren neuen Urlaub ein'
        }
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-4">
          <div className="flex justify-end -mt-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setShowVacationSettingsModal(true)}
              aria-label="Urlaub-Einstellungen"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <Label htmlFor="titel">Titel *</Label>
            <Input
              id="titel"
              placeholder="z.B. Sommerurlaub 2024"
              value={newVacationForm.titel}
              onChange={(e) =>
                setNewVacationForm({ ...newVacationForm, titel: e.target.value })
              }
            />
          </div>
          <div className="space-y-4">
            {!isEditing ? (
              <div>
              <Label>Reisedatum *</Label>
              {isSmallViewport ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !newVacationForm.startdatum &&
                        !newVacationForm.enddatum &&
                        'text-muted-foreground'
                    )}
                    onClick={() => {
                      const from = newVacationForm.startdatum
                        ? new Date(newVacationForm.startdatum)
                        : undefined
                      const to = newVacationForm.enddatum
                        ? new Date(newVacationForm.enddatum)
                        : undefined
                      setDraftRange(from ? { from, to: to ?? from } : undefined)
                      setRangePopoverOpen(true)
                    }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newVacationForm.startdatum && newVacationForm.enddatum ? (
                      <>
                        {format(new Date(newVacationForm.startdatum), 'EE, dd. MMM yyyy', {
                          locale: de,
                        })}{' '}
                        -{' '}
                        {format(new Date(newVacationForm.enddatum), 'EE, dd. MMM yyyy', {
                          locale: de,
                        })}
                      </>
                    ) : (
                      <span>Start- und Enddatum wählen</span>
                    )}
                  </Button>
                  <Dialog
                    open={rangePopoverOpen}
                    onOpenChange={(isOpen) => {
                      setRangePopoverOpen(isOpen)
                      if (!isOpen) setDraftRange(undefined)
                    }}
                  >
                    <DialogContent className="p-0 gap-0 w-[calc(100vw-2rem)] max-w-[420px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader className="px-3 pt-2 pb-0">
                        <DialogTitle>Reisedatum wählen</DialogTitle>
                      </DialogHeader>
                      <div className="flex justify-center w-full px-2">
                        <Calendar
                          mode="range"
                          className="p-2"
                          classNames={{
                            months:
                              'flex flex-col sm:flex-row space-y-1 sm:space-x-4 sm:space-y-0',
                            month: 'space-y-1',
                          }}
                          defaultMonth={
                            draftRange?.from
                              ? draftRange.from
                              : newVacationForm.startdatum
                              ? new Date(newVacationForm.startdatum)
                              : new Date()
                          }
                          selected={
                            draftRange ??
                            (newVacationForm.startdatum && newVacationForm.enddatum
                              ? {
                                  from: new Date(newVacationForm.startdatum),
                                  to: new Date(newVacationForm.enddatum),
                                }
                              : undefined)
                          }
                          onSelect={(range: DateRange | undefined) => {
                            if (range?.from) {
                              setDraftRange({
                                from: range.from,
                                to: range.to ?? range.from,
                              })
                            }
                          }}
                          locale={de}
                          numberOfMonths={2}
                          components={{ Caption: RangeCalendarCaption }}
                        />
                      </div>
                      <div className="flex gap-2 p-2 border-t bg-muted/30">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white border-[rgb(45,79,30)]"
                          disabled={!draftRange?.from}
                          onClick={() => {
                            if (!draftRange?.from) return
                            setNewVacationForm((prev) => ({
                              ...prev,
                              startdatum: format(draftRange.from!, 'yyyy-MM-dd'),
                              enddatum: format(
                                (draftRange.to ?? draftRange.from)!,
                                'yyyy-MM-dd'
                              ),
                            }))
                            setRangePopoverOpen(false)
                            setDraftRange(undefined)
                          }}
                        >
                          OK
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                <Popover
                  open={rangePopoverOpen}
                  onOpenChange={(isOpen) => {
                    setRangePopoverOpen(isOpen)
                    if (isOpen) {
                      const from = newVacationForm.startdatum
                        ? new Date(newVacationForm.startdatum)
                        : undefined
                      const to = newVacationForm.enddatum
                        ? new Date(newVacationForm.enddatum)
                        : undefined
                      setDraftRange(from ? { from, to: to ?? from } : undefined)
                    } else {
                      setDraftRange(undefined)
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !newVacationForm.startdatum &&
                          !newVacationForm.enddatum &&
                          'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newVacationForm.startdatum && newVacationForm.enddatum ? (
                        <>
                          {format(new Date(newVacationForm.startdatum), 'EE, dd. MMM yyyy', {
                            locale: de,
                          })}{' '}
                          -{' '}
                          {format(new Date(newVacationForm.enddatum), 'EE, dd. MMM yyyy', {
                            locale: de,
                          })}
                        </>
                      ) : (
                        <span>Start- und Enddatum wählen</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="bottom">
                    <Calendar
                      mode="range"
                      defaultMonth={
                        draftRange?.from
                          ? draftRange.from
                          : newVacationForm.startdatum
                          ? new Date(newVacationForm.startdatum)
                          : new Date()
                      }
                      selected={
                        draftRange ??
                        (newVacationForm.startdatum && newVacationForm.enddatum
                          ? {
                              from: new Date(newVacationForm.startdatum),
                              to: new Date(newVacationForm.enddatum),
                            }
                          : undefined)
                      }
                      onSelect={(range: DateRange | undefined) => {
                        if (range?.from) {
                          setDraftRange({
                            from: range.from,
                            to: range.to ?? range.from,
                          })
                        }
                      }}
                      locale={de}
                      numberOfMonths={2}
                      components={{ Caption: RangeCalendarCaption }}
                    />
                    <div className="flex gap-2 p-3 border-t bg-muted/30">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white border-[rgb(45,79,30)]"
                        disabled={!draftRange?.from}
                        onClick={() => {
                          if (!draftRange?.from) return
                          setNewVacationForm((prev) => ({
                            ...prev,
                            startdatum: format(draftRange.from!, 'yyyy-MM-dd'),
                            enddatum: format(
                              (draftRange.to ?? draftRange.from)!,
                              'yyyy-MM-dd'
                            ),
                          }))
                          setRangePopoverOpen(false)
                          setDraftRange(undefined)
                        }}
                      >
                        OK
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              </div>
            ) : (
              <div className="rounded-md border border-muted-foreground/10 bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Reisezeitraum (automatisch aus den Campingplatz-Dauern)
                </span>
                <div className="text-sm font-medium">{derivedRangeLabel}</div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <Label className="text-xs font-normal text-muted-foreground">
                Reisebeginn (optional)
              </Label>
              {newVacationForm.abfahrtdatum ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-foreground font-medium">
                    {format(new Date(newVacationForm.abfahrtdatum), 'EE, dd. MMM yyyy', {
                      locale: de,
                    })}
                  </span>
                  <Popover open={abfahrtPopoverOpen} onOpenChange={setAbfahrtPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Ändern
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white" align="start">
                      <Calendar
                        mode="single"
                        defaultMonth={new Date(newVacationForm.abfahrtdatum)}
                        selected={new Date(newVacationForm.abfahrtdatum)}
                        onSelect={(date) => {
                          if (date) {
                            setNewVacationForm((prev) => ({
                              ...prev,
                              abfahrtdatum: format(date, 'yyyy-MM-dd'),
                            }))
                          }
                        }}
                        locale={de}
                      />
                      <div className="flex gap-2 p-3 border-t bg-muted/30">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white border-[rgb(45,79,30)]"
                          onClick={() => setAbfahrtPopoverOpen(false)}
                        >
                          OK
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setNewVacationForm((prev) => ({ ...prev, abfahrtdatum: '' }))
                            setAbfahrtPopoverOpen(false)
                          }}
                        >
                          Löschen
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <Popover open={abfahrtPopoverOpen} onOpenChange={setAbfahrtPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1"
                    >
                      Reisebeginn wählen
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white" align="start">
                    <Calendar
                      mode="single"
                      defaultMonth={
                        newVacationForm.startdatum
                          ? new Date(newVacationForm.startdatum)
                          : new Date()
                      }
                      selected={undefined}
                      onSelect={(date) => {
                        if (date) {
                          setNewVacationForm((prev) => ({
                            ...prev,
                            abfahrtdatum: format(date, 'yyyy-MM-dd'),
                          }))
                        }
                      }}
                      locale={de}
                    />
                    <div className="flex gap-2 p-3 border-t bg-muted/30">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white border-[rgb(45,79,30)]"
                        onClick={() => {
                          const start = newVacationForm.startdatum
                            ? new Date(newVacationForm.startdatum)
                            : new Date()
                          setNewVacationForm((prev) => ({
                            ...prev,
                            abfahrtdatum: format(start, 'yyyy-MM-dd'),
                          }))
                          setAbfahrtPopoverOpen(false)
                        }}
                      >
                        OK
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setNewVacationForm((prev) => ({ ...prev, abfahrtdatum: '' }))
                          setAbfahrtPopoverOpen(false)
                        }}
                      >
                        Löschen
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {!newVacationForm.abfahrtdatum && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ohne Angabe gilt das Startdatum als Reisebeginn.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Campingplätze &amp; Dauer</Label>
            <div className="space-y-2">
              <div className="space-y-1.5">
                {sortedStays.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Noch keine Campingplätze ausgewählt.
                  </p>
                ) : (
                  sortedStays.map((stay) => (
                    <div key={stay.key} ref={(el) => registerStayRow(stay.key, el)}>
                      <StayRow
                        stay={stay}
                        campingplatz={campingplatzById.get(stay.campingplatzId)}
                        overlapHint={overlapHints.get(stay.key) ?? null}
                        onChangeDates={(startDatum, endDatum) =>
                          setStays((prev) =>
                            prev.map((s) =>
                              s.key === stay.key ? { ...s, startDatum, endDatum } : s
                            )
                          )
                        }
                        onRemove={() =>
                          setStays((prev) => prev.filter((s) => s.key !== stay.key))
                        }
                      />
                    </div>
                  ))
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => setCampingSearchOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  <span>Campingplatz hinzufügen…</span>
                </Button>
                <Dialog open={campingSearchOpen} onOpenChange={setCampingSearchOpen}>
                  <DialogContent className="p-0 max-w-lg">
                    <DialogHeader className="px-4 pt-4 pb-2">
                      <DialogTitle>Campingplatz auswählen</DialogTitle>
                    </DialogHeader>
                    <Command>
                      <CommandInput placeholder="Name, Ort, Bundesland oder Land eingeben…" />
                      <CommandList>
                        <CommandEmpty>Keine Campingplätze gefunden.</CommandEmpty>
                        <CommandGroup heading="Campingplätze">
                          {allCampingplaetze
                            .filter((c) => !c.is_archived)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.name} ${c.ort} ${c.bundesland ?? ''} ${c.land}`}
                                onSelect={() => {
                                  handleAddCamping(c.id)
                                  setCampingSearchOpen(false)
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{c.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {c.ort}, {c.land}
                                    {c.bundesland && ` (${c.bundesland})`}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </DialogContent>
                </Dialog>
                <p className="text-xs text-muted-foreground mt-1">
                  Der erste Campingplatz übernimmt den Reisezeitraum, weitere schließen mit
                  einer Nacht an. Ein Platz kann mehrfach zugeordnet werden.
                </p>
              </div>
            </div>
          </div>

          <MitreisendeManager
            vacationId={vacationId}
            onMitreisendeChange={setVacationMitreisende}
          />

          <Button onClick={handleSaveVacation} disabled={isLoading} className="w-full">
            {isLoading
              ? 'Wird gespeichert...'
              : isEditing
              ? 'Urlaub aktualisieren'
              : 'Urlaub erstellen'}
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={showVacationSettingsModal}
        onOpenChange={setShowVacationSettingsModal}
        title="Urlaub-Einstellungen"
        description="Optionale Einstellungen für diesen Urlaub"
        contentClassName="max-w-sm"
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">
              Standardansicht der Packliste
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Welche Ansicht beim Öffnen der Packliste standardmäßig angezeigt wird.
            </p>
            <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setNewVacationForm((prev) => ({
                    ...prev,
                    packliste_default_ansicht: 'packliste',
                  }))
                }
                className={cn(
                  'flex-1 py-2 text-sm transition-colors',
                  newVacationForm.packliste_default_ansicht === 'packliste'
                    ? 'bg-white text-[rgb(45,79,30)] shadow-sm rounded-md font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Packliste
              </button>
              <button
                type="button"
                onClick={() =>
                  setNewVacationForm((prev) => ({
                    ...prev,
                    packliste_default_ansicht: 'alles',
                  }))
                }
                className={cn(
                  'flex-1 py-2 text-sm transition-colors',
                  newVacationForm.packliste_default_ansicht === 'alles'
                    ? 'bg-white text-[rgb(45,79,30)] shadow-sm rounded-md font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Alles
              </button>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowVacationSettingsModal(false)}
          >
            Schließen
          </Button>
        </div>
      </ResponsiveModal>
    </>
  )
}
