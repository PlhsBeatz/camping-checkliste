'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { format } from 'date-fns'
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
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  GripVertical,
  Settings,
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

type VacationEditResponse = {
  vacation: Vacation
  mitreisende: Mitreisender[]
  campingplaetze: Campingplatz[]
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

function SortableSelectedCampingRow({ campingplatz }: { campingplatz: Campingplatz }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: campingplatz.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/60 border border-muted-foreground/10"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center h-8 w-6 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
        style={{ touchAction: 'none' }}
        aria-label="Campingplatz-Reihenfolge ändern"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{campingplatz.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {campingplatz.ort}, {campingplatz.land}
          {campingplatz.bundesland && ` (${campingplatz.bundesland})`}
        </div>
      </div>
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
  const [campingSelectionIds, setCampingSelectionIds] = useState<string[]>([])
  const [campingSearchOpen, setCampingSearchOpen] = useState(false)
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  const [newVacationForm, setNewVacationForm] = useState<VacationFormState>(emptyVacationForm)
  const [showVacationSettingsModal, setShowVacationSettingsModal] = useState(false)
  const [abfahrtPopoverOpen, setAbfahrtPopoverOpen] = useState(false)
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const isEditing = Boolean(vacationId)

  const selectedCampingplaetze = useMemo(
    () => allCampingplaetze.filter((c) => campingSelectionIds.includes(c.id)),
    [allCampingplaetze, campingSelectionIds]
  )

  const resetInternalState = () => {
    setIsLoading(false)
    setNewVacationForm(emptyVacationForm())
    setVacationMitreisende([])
    setCampingSelectionIds([])
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
          setCampingSelectionIds((payload.campingplaetze ?? []).map((c) => c.id))
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
    if (!newVacationForm.titel || !newVacationForm.startdatum || !newVacationForm.enddatum) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus')
      return
    }

    setIsLoading(true)
    try {
      const method = isEditing ? 'PUT' : 'POST'
      const { packliste_default_ansicht, ...restForm } = newVacationForm
      const normalizedReisezielName = deriveReisezielName(
        restForm.reiseziel_name,
        campingSelectionIds,
        allCampingplaetze
      )
      const body = isEditing
        ? {
            ...restForm,
            id: vacationId,
            reiseziel_name: normalizedReisezielName,
            packliste_default_ansicht,
          }
        : {
            ...restForm,
            reiseziel_name: normalizedReisezielName,
            packliste_default_ansicht,
          }

      const res = await fetch('/api/vacations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as ApiResponse<Vacation>
      if (data.success && data.data) {
        const savedVacation = data.data
        const vacationIdForCamping = savedVacation.id

        if (campingSelectionIds.length >= 0) {
          try {
            const campingRes = await fetch('/api/vacations/campingplaetze', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                urlaubId: vacationIdForCamping,
                campingplatzIds: campingSelectionIds,
              }),
            })
            const campingData = (await campingRes.json()) as {
              success?: boolean
              error?: string
            }
            if (!campingData.success) {
              alert(
                'Fehler beim Speichern der Campingplätze: ' +
                  (campingData.error ?? 'Unbekannt')
              )
              return
            }
          } catch (error) {
            console.error('Failed to save vacation campingplaetze:', error)
            alert('Fehler beim Speichern der Campingplätze.')
            return
          }
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

        onSaved?.({
          vacation: savedVacation,
          campingplaetze: selectedCampingplaetze,
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
            <Label>Campingplätze für diesen Urlaub</Label>
            <div className="space-y-2">
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setCampingSearchOpen(true)}
                >
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
                                  setCampingSelectionIds((prev) =>
                                    prev.includes(c.id) ? prev : [...prev, c.id]
                                  )
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
                  Öffnen Sie die Suche, um einen Campingplatz zu finden und zur Liste
                  hinzuzufügen.
                </p>
              </div>
              <div className="space-y-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event
                    if (!over || active.id === over.id) return
                    setCampingSelectionIds((prev) => {
                      const oldIndex = prev.indexOf(String(active.id))
                      const newIndex = prev.indexOf(String(over.id))
                      if (oldIndex === -1 || newIndex === -1) return prev
                      return arrayMove(prev, oldIndex, newIndex)
                    })
                  }}
                >
                  <SortableContext
                    items={campingSelectionIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {campingSelectionIds.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Noch keine Campingplätze ausgewählt.
                        </p>
                      ) : (
                        campingSelectionIds.map((id) => {
                          const c = allCampingplaetze.find((cp) => cp.id === id)
                          if (!c) return null
                          return (
                            <div key={id} className="flex items-center gap-2">
                              <div className="flex-1">
                                <SortableSelectedCampingRow campingplatz={c} />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-xs"
                                onClick={() =>
                                  setCampingSelectionIds((prev) =>
                                    prev.filter((x) => x !== id)
                                  )
                                }
                              >
                                ×
                              </Button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
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
