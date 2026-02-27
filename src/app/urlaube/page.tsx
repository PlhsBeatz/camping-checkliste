'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { MitreisendeManager } from '@/components/mitreisende-manager'
import { Plus, Menu, MoreVertical, Pencil, Trash2, GripVertical, Route } from 'lucide-react'
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
import { format, isSameMonth, isSameYear } from 'date-fns'
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
import Image from 'next/image'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  const [campingSearchOpen, setCampingSearchOpen] = useState(false)
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

  // Routeninfo (Entfernung / Fahrzeit) für alle in Urlaube eingebundenen Campingplätze lazy laden
  useEffect(() => {
    let aborted = false
    const controller = new AbortController()

    const loadRoutes = async () => {
      const seen = new Set<string>()
      const allCampingForVacations = Object.values(vacationCampingplaetze).flat()
      for (const cp of allCampingForVacations) {
        if (aborted) break
        if (!cp.lat || !cp.lng) continue
        if (seen.has(cp.id)) continue
        seen.add(cp.id)
        if (routeInfo[cp.id]) continue
        try {
          const res = await fetch('/api/routes/campingplatz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campingplatzId: cp.id }),
            signal: controller.signal,
          })
          if (!res.ok) continue
          const data = (await res.json()) as {
            success?: boolean
            data?: { distanceKm: number; durationMinutes: number; provider: string }
          }
          if (data.success && data.data && !aborted) {
            setRouteInfo((prev) => ({
              ...prev,
              [cp.id]: data.data!,
            }))
          }
        } catch {
          if (aborted) return
        }
      }
    }

    void loadRoutes()
    return () => {
      aborted = true
      controller.abort()
    }
  }, [vacationCampingplaetze, routeInfo])

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

  const openInAdacMaps = (campingplatz: Campingplatz) => {
    if (routeInfo[campingplatz.id]?.distanceKm != null) {
      // Wir nutzen hier die bekannten Koordinaten von Heimatadresse (aus Routen-API) und Campingplatz.
      // Die Routen-API arbeitet bereits mit user.heimat_lat/lng und campingplatz.lat/lng.
      // Für den ADAC-Link verwenden wir direkt die Koordinaten des Users und des Campingplatzes.
    }
    if (campingplatz.lat == null || campingplatz.lng == null) {
      const labelFallback = `${campingplatz.name}, ${campingplatz.ort}, ${campingplatz.land}`
      const urlFallback = `https://maps.adac.de/routenplaner?poi=${encodeURIComponent(labelFallback)}`
      window.open(urlFallback, '_blank')
      return
    }
    // Startkoordinaten aus der Heimatadresse können clientseitig nicht sicher ermittelt werden,
    // daher nutzen wir den ADAC-Parameter nur mit Zielkoordinaten. Das Fahrzeug wird auf Gespann gesetzt.
    const target = `${campingplatz.lat.toFixed(5)}_${campingplatz.lng.toFixed(5)}_6_0`
    const url = `https://maps.adac.de/route?vehicle-type=trailer&places=${target}`
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

  const formatVacationDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const sameYear = isSameYear(startDate, endDate)
    const sameMonth = isSameMonth(startDate, endDate)

    const dayStart = format(startDate, 'd.', { locale: de })
    const dayEnd = format(endDate, 'd.', { locale: de })

    if (sameYear && sameMonth) {
      const monthYear = format(endDate, 'LLLL yyyy', { locale: de })
      return `${dayStart} bis ${dayEnd} ${monthYear}`
    }

    if (sameYear && !sameMonth) {
      const partStart = format(startDate, 'd. LLLL', { locale: de })
      const partEnd = format(endDate, 'd. LLLL yyyy', { locale: de })
      return `${partStart} bis ${partEnd}`
    }

    const fullStart = format(startDate, 'd. LLLL yyyy', { locale: de })
    const fullEnd = format(endDate, 'd. LLLL yyyy', { locale: de })
    return `${fullStart} bis ${fullEnd}`
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
                            {vacation.abfahrtdatum && (
                              <p>
                                🚗 Reisebeginn:{' '}
                                {format(new Date(vacation.abfahrtdatum), 'd. LLLL yyyy', {
                                  locale: de,
                                })}
                              </p>
                            )}
                            <p>
                              📅 {formatVacationDateRange(vacation.startdatum, vacation.enddatum)}
                            </p>
                            {(vacationCampingplaetze[vacation.id] ?? []).length === 0 && (
                              <p className="text-sm">
                                ⛺ Noch keine Campingplätze zugeordnet
                              </p>
                            )}
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
                                className={cn(
                                  'bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-start justify-between gap-3',
                                  cp.is_archived && 'opacity-60 bg-muted/60'
                                )}
                              >
                                <div className="flex gap-3 flex-1 min-w-0">
                                  {cp.photo_name &&
                                    (() => {
                                      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                                      const photoUrl =
                                        apiKey && cp.photo_name
                                          ? `https://places.googleapis.com/v1/${cp.photo_name}/media?maxWidthPx=96&key=${apiKey}`
                                          : null
                                      return photoUrl ? (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted">
                                          <Image
                                            src={photoUrl}
                                            alt=""
                                            width={48}
                                            height={48}
                                            unoptimized
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : null
                                    })()}
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm truncate">
                                        {cp.name}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {cp.ort}, {cp.land}
                                      {cp.bundesland && ` (${cp.bundesland})`}
                                    </div>
                                    {r && (
                                      <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                                        <Route className="h-3.5 w-3.5 text-[rgb(45,79,30)]" />
                                        <span>
                                          {Math.round(r.distanceKm)} km
                                          {r.durationMinutes != null && (() => {
                                            const hours = Math.floor(r.durationMinutes / 60)
                                            const minutes = Math.round(r.durationMinutes % 60)
                                            const parts: string[] = []
                                            if (hours > 0) parts.push(`${hours} h`)
                                            if (minutes > 0 || hours === 0)
                                              parts.push(`${minutes} min`)
                                            return ` · ${parts.join(' ')}`
                                          })()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <DropdownMenu>
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
                                    <DropdownMenuContent
                                      align="end"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          openInAdacMaps(cp)
                                        }}
                                      >
                                        <Route className="h-4 w-4 mr-2" />
                                        ADAC Routenplanung öffnen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
