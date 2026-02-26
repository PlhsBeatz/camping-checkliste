'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { MitreisendeManager } from '@/components/mitreisende-manager'
import { Plus, Menu, MoreVertical, Pencil, Trash2, GripVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState, useEffect, useRef } from 'react'
import { Vacation, Mitreisender, Campingplatz } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { getCachedVacations } from '@/lib/offline-sync'
import { cacheVacations } from '@/lib/offline-db'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { useNavigation, type CaptionProps } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { buttonVariants } from '@/components/ui/button'
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

export default function UrlaubePage() {
  const router = useRouter()
  const isSmallViewport = useIsSmallViewport()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewVacationDialog, setShowNewVacationDialog] = useState(false)
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null)
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  const [deleteVacationId, setDeleteVacationId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [vacationCampingplaetze, setVacationCampingplaetze] = useState<Record<string, Campingplatz[]>>(
    {}
  )
  const [allCampingplaetze, setAllCampingplaetze] = useState<Campingplatz[]>([])
  const [campingSelectionIds, setCampingSelectionIds] = useState<string[]>([])
  const [routeLoadingId, setRouteLoadingId] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<
    Record<string, { distanceKm: number; durationMinutes: number; provider: string }>
  >({})
  
  const [newVacationForm, setNewVacationForm] = useState({
    titel: '',
    startdatum: '',
    abfahrtdatum: '',
    enddatum: '',
    reiseziel_name: '',
    reiseziel_adresse: '',
    land_region: ''
  })
  const [abfahrtPopoverOpen, setAbfahrtPopoverOpen] = useState(false)
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Sidebar offen: Body-Scroll sperren
  useEffect(() => {
    if (showNavSidebar) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNavSidebar])

  // Fetch Vacations
  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = (await res.json()) as ApiResponse<Vacation[]>
        if (data.success && data.data) {
          setVacations(data.data)
          await cacheVacations(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch vacations:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedVacations()
          if (cached.length > 0) setVacations(cached)
        }
      }
    }
    fetchVacations()
  }, [])

  // Campingplätze für alle Urlaube laden (lazy)
  useEffect(() => {
    const loadCamping = async () => {
      try {
        const resAll = await fetch('/api/campingplaetze')
        const dataAll = (await resAll.json()) as ApiResponse<Campingplatz[]>
        if (dataAll.success && dataAll.data) {
          setAllCampingplaetze(dataAll.data)
        }
      } catch (error) {
        console.error('Failed to fetch campingplaetze:', error)
      }
    }
    void loadCamping()
  }, [])

  useEffect(() => {
    const loadPerVacation = async () => {
      const map: Record<string, Campingplatz[]> = {}
      for (const v of vacations) {
        try {
          const res = await fetch(
            `/api/vacations/campingplaetze?urlaubId=${encodeURIComponent(v.id)}`
          )
          const data = (await res.json()) as ApiResponse<Campingplatz[]>
          if (data.success && data.data) {
            map[v.id] = data.data
          }
        } catch {
          // ignorieren
        }
      }
      setVacationCampingplaetze(map)
    }
    if (vacations.length > 0) {
      void loadPerVacation()
    }
  }, [vacations])

  // Sortieren nach Startdatum (chronologisch), vergangene ausblenden (Enddatum > 7 Tage zurück)
  const displayedVacations = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() - 7)

    return [...vacations]
      .filter(v => {
        const endDate = new Date(v.enddatum)
        endDate.setHours(0, 0, 0, 0)
        return endDate >= cutoffDate
      })
      .sort((a, b) => new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime())
  })()

  const handleCreateVacation = async () => {
    if (!newVacationForm.titel || !newVacationForm.startdatum || !newVacationForm.enddatum) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus')
      return
    }

    setIsLoading(true)
    try {
      const method = editingVacationId ? 'PUT' : 'POST'
      const body = editingVacationId ? { ...newVacationForm, id: editingVacationId } : newVacationForm

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
            } else {
              const selected = allCampingplaetze.filter((c) =>
                campingSelectionIds.includes(c.id)
              )
              setVacationCampingplaetze((prev) => ({
                ...prev,
                [vacationIdForCamping]: selected,
              }))
            }
          } catch (error) {
            console.error('Failed to save vacation campingplaetze:', error)
            alert('Fehler beim Speichern der Campingplätze.')
          }
        }

        if (editingVacationId) {
          setVacations(vacations.map((v) => (v.id === editingVacationId ? savedVacation : v)))
        } else {
          const newVacationId = savedVacation.id

          if (vacationMitreisende.length > 0) {
            const selectedIds = vacationMitreisende.map((m) => m.id)
            await fetch('/api/mitreisende', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vacationId: newVacationId,
                mitreisendeIds: selectedIds,
              }),
            })
          }

          setVacations([...vacations, savedVacation])
        }
        setShowNewVacationDialog(false)
        setEditingVacationId(null)
        setNewVacationForm({
          titel: '',
          startdatum: '',
          abfahrtdatum: '',
          enddatum: '',
          reiseziel_name: '',
          reiseziel_adresse: '',
          land_region: '',
        })
        setVacationMitreisende([])
        setCampingSelectionIds([])
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

  const handleEditVacation = (vacation: Vacation, fromDropdown = false) => {
    setEditingVacationId(vacation.id)
    setNewVacationForm({
      titel: vacation.titel,
      startdatum: vacation.startdatum,
      abfahrtdatum: vacation.abfahrtdatum || '',
      enddatum: vacation.enddatum,
      reiseziel_name: vacation.reiseziel_name,
      reiseziel_adresse: vacation.reiseziel_adresse || '',
      land_region: vacation.land_region || ''
    })
    const existingCamping = vacationCampingplaetze[vacation.id] ?? []
    setCampingSelectionIds(existingCamping.map((c) => c.id))
    if (fromDropdown) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShowNewVacationDialog(true))
      })
    } else {
      setShowNewVacationDialog(true)
    }
  }

  const handleCloseVacationDialog = () => {
    setShowNewVacationDialog(false)
    setEditingVacationId(null)
    setAbfahrtPopoverOpen(false)
    setNewVacationForm({
      titel: '',
      startdatum: '',
      abfahrtdatum: '',
      enddatum: '',
      reiseziel_name: '',
      reiseziel_adresse: '',
      land_region: ''
    })
    setVacationMitreisende([])
    setCampingSelectionIds([])
  }

  const handleDeleteVacation = (vacationId: string) => {
    setDeleteVacationId(vacationId)
  }

  const executeDeleteVacation = async () => {
    if (!deleteVacationId) return
    const vacationId = deleteVacationId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/vacations?id=${vacationId}`, {
        method: 'DELETE'
      })
      const data = (await res.json()) as ApiResponse<boolean>
      if (data.success) {
        setVacations(vacations.filter(v => v.id !== vacationId))
      } else {
        alert('Fehler beim Löschen des Urlaubs: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete vacation:', error)
      alert('Fehler beim Löschen des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectVacation = (vacationId: string) => {
    // Navigate to home page with selected vacation
    router.push(`/?vacation=${vacationId}`)
  }

  const toggleCampingSelection = (id: string) => {
    setCampingSelectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const calculateRoute = async (campingplatzId: string) => {
    setRouteLoadingId(campingplatzId)
    try {
      const res = await fetch('/api/routes/campingplatz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campingplatzId }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        data?: { distanceKm: number; durationMinutes: number; provider: string }
      }
      if (!data.success || !data.data) {
        alert('Fehler bei der Routenberechnung: ' + (data.error ?? 'Unbekannt'))
        return
      }
      setRouteInfo((prev) => ({
        ...prev,
        [campingplatzId]: data.data!,
      }))
    } catch (error) {
      console.error('Failed to calculate route:', error)
      alert('Fehler bei der Routenberechnung.')
    } finally {
      setRouteLoadingId(null)
    }
  }

  const openInAdacMaps = (campingplatz: Campingplatz) => {
    const label = `${campingplatz.name}, ${campingplatz.ort}`
    const url = `https://maps.adac.de/?poi=${encodeURIComponent(label)}`
    window.open(url, '_blank')
  }

  // Verhindert, dass der Card-Touch (nach Dropdown-Auswahl) als Klick zählt – nur auf Mobile relevant
  const ignoreNextCardClickRef = useRef(false)

  const handleCardClick = (vacationId: string) => {
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false
      return
    }
    handleSelectVacation(vacationId)
  }

  return (
    <div className="min-h-screen flex">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        "lg:ml-[280px]"
      )}>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                  Meine Urlaube
                </h1>
              </div>
            </div>
          </div>

          {/* Dialog für Neuer Urlaub - Drawer auf Mobile */}
          <ResponsiveModal
            open={showNewVacationDialog}
            onOpenChange={(open) => {
              if (!open) handleCloseVacationDialog()
              else setShowNewVacationDialog(true)
            }}
            title={editingVacationId ? 'Urlaub bearbeiten' : 'Neuen Urlaub erstellen'}
            description={editingVacationId ? 'Bearbeiten Sie die Details des Urlaubs' : 'Geben Sie die Details für Ihren neuen Urlaub ein'}
            contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="space-y-4">
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
                              !newVacationForm.startdatum && !newVacationForm.enddatum && 'text-muted-foreground'
                            )}
                            onClick={() => {
                              const from = newVacationForm.startdatum ? new Date(newVacationForm.startdatum) : undefined
                              const to = newVacationForm.enddatum ? new Date(newVacationForm.enddatum) : undefined
                              setDraftRange(from ? { from, to: to ?? from } : undefined)
                              setRangePopoverOpen(true)
                            }}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newVacationForm.startdatum && newVacationForm.enddatum ? (
                              <>
                                {format(new Date(newVacationForm.startdatum), 'EE, dd. MMM yyyy', { locale: de })} - {format(new Date(newVacationForm.enddatum), 'EE, dd. MMM yyyy', { locale: de })}
                              </>
                            ) : (
                              <span>Start- und Enddatum wählen</span>
                            )}
                          </Button>
                          <Dialog
                            open={rangePopoverOpen}
                            onOpenChange={(open) => {
                              setRangePopoverOpen(open)
                              if (!open) setDraftRange(undefined)
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
                                    months: 'flex flex-col sm:flex-row space-y-1 sm:space-x-4 sm:space-y-0',
                                    month: 'space-y-1'
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
                                          to: new Date(newVacationForm.enddatum)
                                        }
                                      : undefined)
                                  }
                                  onSelect={(range: DateRange | undefined) => {
                                    if (range?.from) {
                                      setDraftRange({
                                        from: range.from,
                                        to: range.to ?? range.from
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
                                      enddatum: format((draftRange.to ?? draftRange.from)!, 'yyyy-MM-dd')
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
                          onOpenChange={(open) => {
                            setRangePopoverOpen(open)
                            if (open) {
                              const from = newVacationForm.startdatum ? new Date(newVacationForm.startdatum) : undefined
                              const to = newVacationForm.enddatum ? new Date(newVacationForm.enddatum) : undefined
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
                                !newVacationForm.startdatum && !newVacationForm.enddatum && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newVacationForm.startdatum && newVacationForm.enddatum ? (
                                <>
                                  {format(new Date(newVacationForm.startdatum), 'EE, dd. MMM yyyy', { locale: de })} - {format(new Date(newVacationForm.enddatum), 'EE, dd. MMM yyyy', { locale: de })}
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
                                      to: new Date(newVacationForm.enddatum)
                                    }
                                  : undefined)
                              }
                              onSelect={(range: DateRange | undefined) => {
                                if (range?.from) {
                                  setDraftRange({
                                    from: range.from,
                                    to: range.to ?? range.from
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
                                    enddatum: format((draftRange.to ?? draftRange.from)!, 'yyyy-MM-dd')
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

                    {/* Reisebeginn – dezenter, nur bei Abweichung prominent */}
                    <div className="text-sm text-muted-foreground">
                      <Label className="text-xs font-normal text-muted-foreground">Reisebeginn (optional)</Label>
                      {newVacationForm.abfahrtdatum ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-foreground font-medium">
                            {format(new Date(newVacationForm.abfahrtdatum), 'EE, dd. MMM yyyy', { locale: de })}
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
                                      abfahrtdatum: format(date, 'yyyy-MM-dd')
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
                                    abfahrtdatum: format(date, 'yyyy-MM-dd')
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
                                    abfahrtdatum: format(start, 'yyyy-MM-dd')
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
                    <p className="text-xs text-muted-foreground">
                      Wählen Sie einen oder mehrere Campingplätze aus. Die Reihenfolge in der
                      folgenden Liste bestimmt die Reihenfolge im Urlaub.
                    </p>
                    <div className="space-y-2">
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto border rounded-md p-2 bg-muted/30">
                        {allCampingplaetze.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Noch keine Campingplätze angelegt.
                          </p>
                        ) : (
                          allCampingplaetze
                            .filter((c) => !c.is_archived)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((c) => (
                              <label
                                key={c.id}
                                className="flex items-start gap-2 text-sm cursor-pointer rounded-md px-2 py-1 hover:bg-muted/60"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-3 w-3"
                                  checked={campingSelectionIds.includes(c.id)}
                                  onChange={() => toggleCampingSelection(c.id)}
                                />
                                <div>
                                  <div className="font-medium text-xs">
                                    {c.name} ({c.platz_typ})
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {c.ort}, {c.land}
                                    {c.bundesland && ` (${c.bundesland})`}
                                  </div>
                                </div>
                              </label>
                            ))
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">
                          Ausgewählte Campingplätze (Reihenfolge per Drag &amp; Drop ändern)
                        </div>
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
                                    <SortableSelectedCampingRow
                                      key={id}
                                      campingplatz={c}
                                    />
                                  )
                                })
                              )}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    </div>
                  </div>
                  
                  {/* Mitreisenden-Verwaltung */}
                  <MitreisendeManager 
                    vacationId={editingVacationId}
                    onMitreisendeChange={setVacationMitreisende}
                  />
                  
                  <Button onClick={handleCreateVacation} disabled={isLoading} className="w-full">
                    {isLoading ? 'Wird gespeichert...' : editingVacationId ? 'Urlaub aktualisieren' : 'Urlaub erstellen'}
                  </Button>
                </div>
          </ResponsiveModal>

          {/* Urlaub löschen – Bestätigung */}
          <ConfirmDialog
            open={!!deleteVacationId}
            onOpenChange={(open) => !open && setDeleteVacationId(null)}
            title="Urlaub löschen"
            description="Sind Sie sicher, dass Sie diesen Urlaub löschen möchten?"
            onConfirm={executeDeleteVacation}
            isLoading={isLoading}
          />

          {/* Vacations List */}
          <div className="grid gap-4">
            {displayedVacations.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub!
                  </p>
                </CardContent>
              </Card>
            ) : (
              displayedVacations.map((vacation) => (
                <Card
                  key={vacation.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleCardClick(vacation.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>{vacation.titel}</CardTitle>
                        <CardDescription>
                          <div className="space-y-1 mt-2">
                            {vacation.abfahrtdatum && <p>🚗 Reisebeginn: {vacation.abfahrtdatum}</p>}
                            <p>📅 {vacation.startdatum} bis {vacation.enddatum}</p>
                            <p className="text-sm">
                              ⛺{' '}
                              {(vacationCampingplaetze[vacation.id] ?? []).length > 0
                                ? `${(vacationCampingplaetze[vacation.id] ?? []).length} Campingplatz${
                                    (vacationCampingplaetze[vacation.id] ?? []).length > 1
                                      ? 'e'
                                      : ''
                                  }`
                                : 'Noch keine Campingplätze zugeordnet'}
                            </p>
                          </div>
                        </CardDescription>
                      </div>
                      <DropdownMenu open={openMenuId === vacation.id} onOpenChange={(o) => setOpenMenuId(o ? vacation.id : null)}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={() => {
                              ignoreNextCardClickRef.current = true
                              setOpenMenuId(null)
                              handleEditVacation(vacation, true)
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              ignoreNextCardClickRef.current = true
                              setOpenMenuId(null)
                              handleDeleteVacation(vacation.id)
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectVacation(vacation.id)
                      }}
                    >
                      Packliste öffnen
                    </Button>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Campingplätze</span>
                      </div>
                      <div className="space-y-1">
                        {(vacationCampingplaetze[vacation.id] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Noch keine Campingplätze zugeordnet.
                          </p>
                        ) : (
                          (vacationCampingplaetze[vacation.id] ?? []).map((cp) => {
                            const r = routeInfo[cp.id]
                            return (
                              <div
                                key={cp.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs"
                              >
                                <div>
                                  <div className="font-medium">
                                    {cp.name} ({cp.platz_typ})
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {cp.ort}, {cp.land}
                                  </div>
                                  {r && (
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                      Entfernung ca. {r.distanceKm.toFixed(1).replace('.', ',')} km,{' '}
                                      {Math.round(r.durationMinutes)} Min. ({r.provider})
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void calculateRoute(cp.id)
                                    }}
                                    disabled={routeLoadingId === cp.id}
                                  >
                                    {routeLoadingId === cp.id ? 'Berechne…' : 'Route berechnen'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openInAdacMaps(cp)
                                    }}
                                  >
                                    In ADAC Maps öffnen
                                  </Button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* FAB: Neuer Urlaub - Plus-Symbol, runder Kreis wie Ausrüstung und Packliste */}
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            size="icon"
            onClick={() => {
              setEditingVacationId(null)
              setNewVacationForm({
                titel: '',
                startdatum: '',
                abfahrtdatum: '',
                enddatum: '',
                reiseziel_name: '',
                reiseziel_adresse: '',
                land_region: ''
              })
              setVacationMitreisende([])
              setCampingSelectionIds([])
              setShowNewVacationDialog(true)
            }}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </div>
      </div>

    </div>
  )
}
