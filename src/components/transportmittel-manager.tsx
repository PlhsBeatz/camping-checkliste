'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WeightInput } from '@/components/ui/weight-input'
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, MoreVertical, Pencil, ChevronDown, ChevronRight, Wrench, RefreshCw } from 'lucide-react'
import { BrandEmptyState } from '@/components/brand-empty-state'
import {
  EMPTY_ILLUSTRATION_CLASS,
  TransportEmptyIllustration,
} from '@/components/brand-empty-illustrations'
import {
  TransportVehicle,
  TransportVehicleFestgewichtManuell,
  type TransportVehicleWithFestgewicht,
  type Mitreisender,
  type MitreisendenGruppe,
} from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { cn, formatWeightForDisplay, parseWeightInput } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import {
  TRANSPORT_ICON_OPTIONS,
  TransportIcon,
  resolveTransportIconKeyForForm,
  type TransportIconKey,
} from '@/lib/transport-icons'
import {
  FAHRZEUGTYPEN,
  FAHRZEUGTYP_LABELS,
  groupVehiclesByRole,
  iconKeyFromFahrzeugtyp,
  isAnbau,
  isFahrzeugtyp,
  isGezogen,
  isTransportActiveOn,
  isZugfaehig,
  supportsGrundriss,
  type Fahrzeugtyp,
} from '@/lib/transport-types'
import { todayInAppTimezone } from '@/lib/app-timezone'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'

function TransportmittelRow({
  vehicle,
  onEdit,
  onDelete,
  onReplace,
  onWartung,
  wartungCount,
  canManageWartung,
  showHaushalt,
  isOtherHaushalt = false,
}: {
  vehicle: TransportVehicleWithFestgewicht | TransportVehicle
  onEdit: (v: TransportVehicle) => void
  onDelete: (id: string) => void
  onReplace: (v: TransportVehicle) => void
  onWartung: (v: TransportVehicle) => void
  wartungCount: number
  canManageWartung: boolean
  showHaushalt?: boolean
  /** Visuell zurückgenommen – nicht Standard-Haushalt */
  isOtherHaushalt?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const typ = isFahrzeugtyp(vehicle.fahrzeugtyp) ? vehicle.fahrzeugtyp : 'auto'
  const nutzlast = isAnbau(typ)
    ? vehicle.max_traglast ?? vehicle.zul_gesamtgewicht - vehicle.eigengewicht
    : vehicle.zul_gesamtgewicht - vehicle.eigengewicht
  const festgewichtTotal = 'festgewichtTotal' in vehicle ? vehicle.festgewichtTotal : 0
  const isActive = isTransportActiveOn(vehicle, todayInAppTimezone())
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 border rounded-lg',
        isOtherHaushalt
          ? 'border-dashed bg-muted/40 text-muted-foreground hover:bg-muted/55'
          : 'bg-card hover:bg-muted/50',
        !isActive && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
            isOtherHaushalt ? 'bg-muted' : 'bg-[rgb(45,79,30)]/10'
          )}
        >
          <TransportIcon
            icon={vehicle.icon}
            name={vehicle.name}
            className={cn(
              '[&_svg]:h-5 [&_svg]:w-5',
              isOtherHaushalt ? 'text-muted-foreground' : 'text-brand-heading'
            )}
          />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'font-medium flex flex-wrap items-center gap-2',
              isOtherHaushalt && 'text-foreground/80'
            )}
          >
            {vehicle.name}
            <span className="text-xs font-normal text-muted-foreground">
              {FAHRZEUGTYP_LABELS[typ]}
            </span>
            {showHaushalt && vehicle.gruppe_name ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  isOtherHaushalt
                    ? 'border border-muted-foreground/35 bg-background/80 text-muted-foreground'
                    : 'bg-[rgb(45,79,30)]/10 text-[rgb(45,79,30)]'
                )}
              >
                {vehicle.gruppe_name}
              </span>
            ) : null}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                isActive
                  ? isOtherHaushalt
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-[rgb(45,79,30)]/10 text-[rgb(45,79,30)]'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isActive ? 'Aktiv' : 'Inaktiv'}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {isAnbau(typ) ? (
              <>
                Eigengewicht: {formatWeightForDisplay(vehicle.eigengewicht)} kg · Max. Traglast:{' '}
                {formatWeightForDisplay(nutzlast)} kg
              </>
            ) : (
              <>
                Zul. Gesamt: {formatWeightForDisplay(vehicle.zul_gesamtgewicht)} kg · Eigengewicht:{' '}
                {formatWeightForDisplay(vehicle.eigengewicht)} kg · Nutzlast:{' '}
                {formatWeightForDisplay(nutzlast)} kg
              </>
            )}
            {festgewichtTotal > 0 && (
              <> · Fest Installiert: {formatWeightForDisplay(festgewichtTotal)} kg</>
            )}
          </p>
        </div>
      </div>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onEdit(vehicle)
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          {!isAnbau(typ) && (
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false)
                onReplace(vehicle)
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Ersetzen
            </DropdownMenuItem>
          )}
          {canManageWartung && (
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false)
                onWartung(vehicle)
              }}
            >
              <Wrench className="h-4 w-4 mr-2" />
              {wartungCount > 0 ? 'Wartungen anzeigen' : 'Wartung anlegen'}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onDelete(vehicle.id)
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

type FormState = {
  name: string
  fahrzeugtyp: Fahrzeugtyp
  icon: TransportIconKey
  hersteller: string
  modell: string
  baujahr: string
  laengeM: string
  breiteM: string
  zulGesamtgewicht: string
  eigengewicht: string
  maxStuetzlast: string
  maxTraglast: string
  aktivVon: string
  aktivBis: string
  traegerTransportId: string
  gruppeId: string
  urlaubStandard: boolean
}

const emptyForm = (defaultGruppeId = ''): FormState => ({
  name: '',
  fahrzeugtyp: 'auto',
  icon: 'car',
  hersteller: '',
  modell: '',
  baujahr: '',
  laengeM: '',
  breiteM: '',
  zulGesamtgewicht: '',
  eigengewicht: '',
  maxStuetzlast: '',
  maxTraglast: '',
  aktivVon: '',
  aktivBis: '',
  traegerTransportId: '',
  gruppeId: defaultGruppeId,
  urlaubStandard: false,
})

function VehicleSection({
  title,
  vehicles,
  onEdit,
  onDelete,
  onReplace,
  onWartung,
  wartungCountByTransportId,
  canManageWartung,
  showHaushalt,
  isOtherHaushalt = false,
  titleClassName,
}: {
  title: string
  vehicles: (TransportVehicleWithFestgewicht | TransportVehicle)[]
  onEdit: (v: TransportVehicle) => void
  onDelete: (id: string) => void
  onReplace: (v: TransportVehicle) => void
  onWartung: (v: TransportVehicle) => void
  wartungCountByTransportId: Map<string, number>
  canManageWartung: boolean
  showHaushalt?: boolean
  isOtherHaushalt?: boolean
  titleClassName?: string
}) {
  if (vehicles.length === 0) return null
  return (
    <div className="space-y-2">
      <h3
        className={cn(
          'text-sm font-semibold tracking-tight pt-1',
          titleClassName ?? (isOtherHaushalt ? 'text-muted-foreground' : 'text-brand-heading')
        )}
      >
        {title}
      </h3>
      <div className="space-y-2">
        {vehicles.map((vehicle) => (
          <TransportmittelRow
            key={vehicle.id}
            vehicle={vehicle}
            onEdit={onEdit}
            onDelete={onDelete}
            onReplace={onReplace}
            onWartung={onWartung}
            wartungCount={wartungCountByTransportId.get(vehicle.id) ?? 0}
            canManageWartung={canManageWartung}
            showHaushalt={showHaushalt}
            isOtherHaushalt={isOtherHaushalt}
          />
        ))}
      </div>
    </div>
  )
}

function groupVehiclesByTyp(list: (TransportVehicleWithFestgewicht | TransportVehicle)[]) {
  return groupVehiclesByRole(list)
}

interface TransportmittelManagerProps {
  vehicles: (TransportVehicleWithFestgewicht | TransportVehicle)[]
  onRefresh: () => void
}

export function TransportmittelManager({ vehicles, onRefresh }: TransportmittelManagerProps) {
  const router = useRouter()
  const { canWriteWartung } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null)
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null)
  const [deleteMode, setDeleteMode] = useState<'inactivate' | 'delete'>('inactivate')
  const [deleteUsageLoading, setDeleteUsageLoading] = useState(false)
  const [deleteInUse, setDeleteInUse] = useState<boolean | null>(null)
  const [replaceVehicle, setReplaceVehicle] = useState<TransportVehicle | null>(null)
  const [tauschdatum, setTauschdatum] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aktivDatesExpanded, setAktivDatesExpanded] = useState(false)
  const [wartungCountByTransportId, setWartungCountByTransportId] = useState<Map<string, number>>(
    new Map()
  )
  const [form, setForm] = useState<FormState>(emptyForm)
  const [manuellEntries, setManuellEntries] = useState<TransportVehicleFestgewichtManuell[]>([])
  const [festgewichtEquipment, setFestgewichtEquipment] = useState<
    Array<{ id: string; was: string; einzelgewicht: number; standard_anzahl: number; gesamtgewicht: number }>
  >([])
  const [festInstalliertExpanded, setFestInstalliertExpanded] = useState(false)
  const [mitreisende, setMitreisende] = useState<Mitreisender[]>([])
  const [gruppen, setGruppen] = useState<MitreisendenGruppe[]>([])
  const [personWeights, setPersonWeights] = useState<Record<string, string>>({})
  const [showWeiterePersonen, setShowWeiterePersonen] = useState(false)
  const [katalogHint, setKatalogHint] = useState<string | null>(null)
  const [katalogLoading, setKatalogLoading] = useState(false)
  const [katalogNetLoading, setKatalogNetLoading] = useState(false)
  const [katalogImageUrl, setKatalogImageUrl] = useState<string | null>(null)
  const [katalogId, setKatalogId] = useState<string | null>(null)
  const [imageCandidates, setImageCandidates] = useState<
    Array<{ url: string; score: number; hint: string }>
  >([])
  const [existingPickUrl, setExistingPickUrl] = useState<string | null>(null)
  const [imagePickSelection, setImagePickSelection] = useState<string | null>(null)
  const [imageApplyLoading, setImageApplyLoading] = useState(false)
  const festgewichtLoadedRef = useRef(false)

  const anbauMode = isAnbau(form.fahrzeugtyp)
  const zugfaehigMode = isZugfaehig(form.fahrzeugtyp)
  const showStuetzlast = zugfaehigMode || isGezogen(form.fahrzeugtyp)
  const grundrissMode = supportsGrundriss(form.fahrzeugtyp)
  const traegerOptions = vehicles.filter((v) => isZugfaehig(v.fahrzeugtyp))

  const applyKatalogLookup = async () => {
    if (!grundrissMode) return
    const hersteller = form.hersteller.trim()
    const modell = form.modell.trim()
    if (!hersteller || !modell) {
      setKatalogHint('Bitte Hersteller und Modell eingeben.')
      return
    }
    setKatalogLoading(true)
    setKatalogHint(null)
    try {
      const params = new URLSearchParams({ hersteller, modell })
      if (form.baujahr.trim()) params.set('baujahr', form.baujahr.trim())
      const res = await fetch(`/api/transport-vehicles/katalog-lookup?${params}`)
      const data = (await res.json()) as ApiResponse<{
        id: string
        laenge_m: number
        breite_m: number
        hersteller: string
        modell: string
        imageUrl?: string | null
      } | null>
      if (!data.success || !data.data) {
        setKatalogHint(
          'Kein lokaler Katalog-Treffer – „Aus Netz aktualisieren“ oder Maße manuell.'
        )
        return
      }
      setForm((prev) => ({
        ...prev,
        laengeM: String(data.data!.laenge_m),
        breiteM: String(data.data!.breite_m),
      }))
      setKatalogId(data.data.id)
      clearImagePicker()
      setKatalogImageUrl(data.data.imageUrl ?? null)
      setKatalogHint(
        [
          `Aus lokalem Katalog: ${data.data.hersteller} ${data.data.modell} (${data.data.laenge_m}×${data.data.breite_m} m)`,
          data.data.imageUrl
            ? 'Bestehendes Bild geladen – bei Bedarf „Bild anpassen“.'
            : null,
        ]
          .filter(Boolean)
          .join('\n')
      )
    } catch {
      setKatalogHint('Katalog-Lookup fehlgeschlagen (offline?).')
    } finally {
      setKatalogLoading(false)
    }
  }

  const clearImagePicker = () => {
    setImageCandidates([])
    setExistingPickUrl(null)
    setImagePickSelection(null)
  }

  /** OpenRouter-Websuche → Maße + Bildkandidaten zur Auswahl */
  const refreshKatalogFromNet = async () => {
    if (!grundrissMode) return
    const hersteller = form.hersteller.trim()
    const modell = form.modell.trim()
    if (!hersteller || !modell) {
      setKatalogHint('Bitte Hersteller und Modell eingeben.')
      return
    }
    setKatalogNetLoading(true)
    setKatalogHint(null)
    clearImagePicker()
    try {
      const res = await fetch('/api/transport-vehicles/katalog-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hersteller,
          modell,
          baujahr: form.baujahr.trim() ? Number(form.baujahr.trim()) : null,
          applyToTransportId: editingVehicle?.id ?? null,
        }),
      })
      const data = (await res.json()) as ApiResponse<{
        entry: {
          id: string
          hersteller: string
          modell: string
          laenge_m: number
          breite_m: number
          laenge_gesamt_m?: number | null
          laenge_aufbau_m?: number | null
          baujahr_von?: number | null
          source_url?: string | null
          mass_hinweis?: string | null
        }
        imageUrl: string | null
        imageWarning?: string | null
        sourceNotes?: string | null
        massKlarheit?: string | null
        imageCandidates?: Array<{ url: string; score: number; hint: string }>
        existingImageUrl?: string | null
        katalogId?: string
      }>
      if (!data.success || !data.data) {
        setKatalogHint(data.error ?? 'Netz-Aktualisierung fehlgeschlagen')
        return
      }
      const {
        entry,
        imageWarning,
        sourceNotes,
        massKlarheit,
        imageCandidates: candidates = [],
        existingImageUrl,
        katalogId: kid,
      } = data.data
      const placeLen =
        entry.laenge_aufbau_m ?? entry.laenge_m ?? entry.laenge_gesamt_m ?? null
      setForm((prev) => ({
        ...prev,
        laengeM: placeLen != null ? String(placeLen) : prev.laengeM,
        breiteM: String(entry.breite_m),
        baujahr:
          prev.baujahr.trim() ||
          (entry.baujahr_von != null ? String(entry.baujahr_von) : prev.baujahr),
      }))
      setKatalogId(kid ?? entry.id)
      const existing = existingImageUrl
        ? `${existingImageUrl}${existingImageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
        : null
      setExistingPickUrl(existing)
      setImageCandidates(candidates)
      setKatalogImageUrl(existing)
      if (existing) {
        setImagePickSelection('keep')
      } else if (candidates[0]) {
        setImagePickSelection(`url:${candidates[0].url}`)
      } else {
        setImagePickSelection('skip')
      }
      const parts = [
        `Aus Netz: ${entry.hersteller} ${entry.modell}`,
        massKlarheit || entry.mass_hinweis,
        candidates.length > 0
          ? `${candidates.length} Bildvorschlag(e) – bitte das richtige auswählen und übernehmen.`
          : existing
            ? 'Bestehendes Bild gefunden – behalten, neu zuschneiden oder Suche ohne Bild lassen.'
            : 'Keine Bildkandidaten – Maße übernommen, Grundriss ggf. später erneut suchen.',
        imageWarning && candidates.length === 0 ? imageWarning : null,
        entry.source_url ? `Quelle: ${entry.source_url}` : null,
        sourceNotes && sourceNotes !== massKlarheit ? sourceNotes : null,
        editingVehicle?.id ? 'Maße am Fahrzeug übernommen.' : null,
      ].filter(Boolean)
      setKatalogHint(parts.join('\n'))
      if (editingVehicle?.id) onRefresh()
    } catch {
      setKatalogHint('Netz-Aktualisierung fehlgeschlagen (offline / API?).')
    } finally {
      setKatalogNetLoading(false)
    }
  }

  const applySelectedGrundrissImage = async () => {
    if (!katalogId || !imagePickSelection) return
    setImageApplyLoading(true)
    setKatalogHint(null)
    try {
      let mode: 'url' | 'keep' | 'reprocess-existing' | 'skip' = 'skip'
      let imageUrl: string | null = null
      if (imagePickSelection === 'keep') mode = 'keep'
      else if (imagePickSelection === 'reprocess') mode = 'reprocess-existing'
      else if (imagePickSelection === 'skip') mode = 'skip'
      else if (imagePickSelection.startsWith('url:')) {
        mode = 'url'
        imageUrl = imagePickSelection.slice(4)
      }

      const res = await fetch('/api/transport-vehicles/katalog-apply-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          katalogId,
          applyToTransportId: editingVehicle?.id ?? null,
          mode,
          imageUrl,
        }),
      })
      const data = (await res.json()) as ApiResponse<{
        imageUrl: string | null
        warning?: string | null
        kept?: boolean
        skipped?: boolean
      }>
      if (!data.success || !data.data) {
        setKatalogHint(data.error ?? 'Bildübernahme fehlgeschlagen')
        return
      }
      if (data.data.skipped) {
        clearImagePicker()
        setKatalogHint('Ohne neues Bild belassen.')
        return
      }
      const nextUrl = data.data.imageUrl
        ? `${data.data.imageUrl}${data.data.imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
        : null
      setKatalogImageUrl(nextUrl)
      clearImagePicker()
      setKatalogHint(
        [
          data.data.kept
            ? 'Bestehendes Grundriss-Bild behalten.'
            : 'Grundriss-Bild übernommen und verarbeitet.',
          data.data.warning,
          editingVehicle?.id ? 'Am Fahrzeug gespeichert.' : null,
        ]
          .filter(Boolean)
          .join('\n')
      )
      if (editingVehicle?.id) onRefresh()
    } catch {
      setKatalogHint('Bildübernahme fehlgeschlagen.')
    } finally {
      setImageApplyLoading(false)
    }
  }

  /** Bestehendes Bild ohne Netzsuche anpassen (zuschneiden / behalten). */
  const openExistingImageAdjust = async () => {
    if (!katalogImageUrl) return
    let kid = katalogId
    if (!kid) {
      const hersteller = form.hersteller.trim()
      const modell = form.modell.trim()
      if (hersteller && modell) {
        try {
          const params = new URLSearchParams({ hersteller, modell })
          if (form.baujahr.trim()) params.set('baujahr', form.baujahr.trim())
          const res = await fetch(`/api/transport-vehicles/katalog-lookup?${params}`)
          const data = (await res.json()) as ApiResponse<{ id: string } | null>
          if (data.success && data.data?.id) {
            kid = data.data.id
            setKatalogId(kid)
          }
        } catch {
          /* ignore */
        }
      }
    }
    setExistingPickUrl(katalogImageUrl)
    setImageCandidates([])
    setImagePickSelection('keep')
    if (!kid) {
      setKatalogHint(
        'Kein Katalogeintrag gefunden. Bitte zuerst „Aus Katalog vorschlagen“ oder „Aus Netz aktualisieren“.'
      )
    } else {
      setKatalogHint('Bestehendes Bild: behalten oder neu zuschneiden.')
    }
  }
  const formIsActive = isTransportActiveOn(
    { aktiv_von: form.aktivVon || null, aktiv_bis: form.aktivBis || null },
    todayInAppTimezone()
  )
  const deleteVehicleName =
    vehicles.find((v) => v.id === deleteVehicleId)?.name ?? 'dieses Transportmittel'

  const showHaushaltSelect = gruppen.length > 1
  const defaultGruppeId = useMemo(() => {
    const standard = gruppen.find((g) => g.urlaub_standard_mitnehmen)
    return standard?.id ?? gruppen[0]?.id ?? ''
  }, [gruppen])
  const standardGruppeName = useMemo(() => {
    return gruppen.find((g) => g.id === defaultGruppeId)?.name ?? 'Standard-Haushalt'
  }, [gruppen, defaultGruppeId])

  const { standardGrouped, otherHaushalte } = useMemo(() => {
    if (!showHaushaltSelect || !defaultGruppeId) {
      return {
        standardGrouped: groupVehiclesByTyp(vehicles),
        otherHaushalte: [] as Array<{
          id: string
          name: string
          grouped: ReturnType<typeof groupVehiclesByTyp>
        }>,
      }
    }
    const standardList = vehicles.filter(
      (v) => !v.gruppe_id || v.gruppe_id === defaultGruppeId
    )
    const otherList = vehicles.filter(
      (v) => v.gruppe_id != null && v.gruppe_id !== defaultGruppeId
    )
    const byGruppe = new Map<string, (TransportVehicleWithFestgewicht | TransportVehicle)[]>()
    for (const v of otherList) {
      const gid = v.gruppe_id!
      const arr = byGruppe.get(gid) ?? []
      arr.push(v)
      byGruppe.set(gid, arr)
    }
    const otherHaushalte = [...byGruppe.entries()]
      .map(([id, list]) => ({
        id,
        name: list[0]?.gruppe_name ?? gruppen.find((g) => g.id === id)?.name ?? 'Haushalt',
        grouped: groupVehiclesByTyp(list),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return {
      standardGrouped: groupVehiclesByTyp(standardList),
      otherHaushalte,
    }
  }, [vehicles, showHaushaltSelect, defaultGruppeId, gruppen])

  const haushaltPersonen = useMemo(
    () =>
      form.gruppeId
        ? mitreisende.filter((m) => m.gruppe_id === form.gruppeId)
        : mitreisende.filter((m) => m.urlaub_standard_mitnehmen),
    [mitreisende, form.gruppeId]
  )
  const anderePersonen = useMemo(
    () =>
      form.gruppeId
        ? mitreisende.filter((m) => m.gruppe_id !== form.gruppeId)
        : mitreisende.filter((m) => !m.urlaub_standard_mitnehmen),
    [mitreisende, form.gruppeId]
  )
  const visiblePersonen = showWeiterePersonen
    ? [...haushaltPersonen, ...anderePersonen]
    : haushaltPersonen

  const loadFestgewicht = async (transportId: string) => {
    festgewichtLoadedRef.current = false
    try {
      const res = await fetch(`/api/transport-vehicles/festgewicht?transportId=${transportId}`)
      const data = (await res.json()) as ApiResponse<{
        manuell: TransportVehicleFestgewichtManuell[]
        equipment: Array<{
          id: string
          was: string
          einzelgewicht: number
          standard_anzahl: number
          gesamtgewicht: number
        }>
      }>
      if (data.success && data.data) {
        setManuellEntries(data.data.manuell)
        setFestgewichtEquipment(data.data.equipment ?? [])
        festgewichtLoadedRef.current = true
      }
    } catch (e) {
      console.error('Failed to load festgewicht:', e)
    }
  }

  const loadMitreisende = async () => {
    try {
      const res = await fetch('/api/mitreisende?includeGroups=1')
      const data = (await res.json()) as ApiResponse<Mitreisender[]>
      if (data.success && data.data) {
        setMitreisende(data.data)
        const weights: Record<string, string> = {}
        for (const m of data.data) {
          weights[m.id] =
            m.koerpergewicht != null && m.koerpergewicht > 0 ? String(m.koerpergewicht) : ''
        }
        setPersonWeights(weights)
      }
    } catch {
      /* ignore */
    }
  }

  const loadGruppen = async () => {
    try {
      const res = await fetch('/api/mitreisenden-gruppen')
      const data = (await res.json()) as ApiResponse<MitreisendenGruppe[]>
      if (data.success && data.data) setGruppen(data.data)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadGruppen()
  }, [])

  useEffect(() => {
    if (vehicles.length === 0) {
      setWartungCountByTransportId(new Map())
      return
    }
    const ids = vehicles.map((v) => v.id).join(',')
    void fetch(`/api/faelligkeiten/transport-summary?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const data = raw as ApiResponse<Record<string, number>>
        if (data.success && data.data) {
          setWartungCountByTransportId(new Map(Object.entries(data.data)))
        }
      })
      .catch(() => {})
  }, [vehicles])

  useEffect(() => {
    if (editingVehicle && showDialog) {
      void loadFestgewicht(editingVehicle.id)
      if (isZugfaehig(editingVehicle.fahrzeugtyp)) {
        void loadMitreisende()
      }
      setShowWeiterePersonen(false)
    } else {
      setManuellEntries([])
      setFestgewichtEquipment([])
      setFestInstalliertExpanded(false)
      festgewichtLoadedRef.current = false
      setShowWeiterePersonen(false)
    }
  }, [editingVehicle, showDialog])

  const handleWartung = (vehicle: TransportVehicle) => {
    const count = wartungCountByTransportId.get(vehicle.id) ?? 0
    if (count > 0) {
      router.push(`/tools/wartung?transport=${encodeURIComponent(vehicle.id)}`)
    } else {
      router.push(`/tools/wartung?neu=1&transport=${encodeURIComponent(vehicle.id)}`)
    }
  }

  const buildPayload = () => {
    const name = form.name.trim()
    const eigen = parseWeightInput(form.eigengewicht)
    if (!name) return { error: 'Bitte geben Sie einen Namen ein' }
    if (eigen === null || eigen < 0) return { error: 'Eigengewicht muss 0 oder größer sein' }

    if (anbauMode) {
      const trag = parseWeightInput(form.maxTraglast)
      if (trag === null || trag <= 0) return { error: 'Max. Traglast muss größer als 0 sein' }
      return {
        payload: {
          name,
          fahrzeugtyp: form.fahrzeugtyp,
          hersteller: form.hersteller.trim() || null,
          modell: form.modell.trim() || null,
          baujahr: null,
          laengeM: null,
          breiteM: null,
          icon: form.icon || iconKeyFromFahrzeugtyp(form.fahrzeugtyp),
          eigengewicht: eigen,
          maxTraglast: trag,
          zulGesamtgewicht: eigen + trag,
          aktivVon: form.aktivVon || null,
          aktivBis: form.aktivBis || null,
          traegerTransportId: form.traegerTransportId || null,
          maxStuetzlast: null,
          gruppeId: form.gruppeId || defaultGruppeId || null,
          urlaubStandard: form.urlaubStandard,
        },
      }
    }

    const zul = parseWeightInput(form.zulGesamtgewicht)
    if (zul === null || zul <= 0) return { error: 'Zulässiges Gesamtgewicht muss größer als 0 sein' }
    const stuetz = parseWeightInput(form.maxStuetzlast)
    const baujahrRaw = form.baujahr.trim() ? Number(form.baujahr.trim()) : null
    const laengeRaw = form.laengeM.trim() ? Number(form.laengeM.replace(',', '.')) : null
    const breiteRaw = form.breiteM.trim() ? Number(form.breiteM.replace(',', '.')) : null
    if (supportsGrundriss(form.fahrzeugtyp)) {
      if (laengeRaw != null && (!Number.isFinite(laengeRaw) || laengeRaw <= 0 || laengeRaw > 15)) {
        return { error: 'Länge muss zwischen 0 und 15 m liegen' }
      }
      if (breiteRaw != null && (!Number.isFinite(breiteRaw) || breiteRaw <= 0 || breiteRaw > 15)) {
        return { error: 'Breite muss zwischen 0 und 15 m liegen' }
      }
      if ((laengeRaw == null) !== (breiteRaw == null)) {
        return { error: 'Länge und Breite bitte beide angeben oder beide leer lassen' }
      }
    }
    return {
      payload: {
        name,
        fahrzeugtyp: form.fahrzeugtyp,
        hersteller: form.hersteller.trim() || null,
        modell: form.modell.trim() || null,
        baujahr:
          supportsGrundriss(form.fahrzeugtyp) && baujahrRaw != null && Number.isFinite(baujahrRaw)
            ? baujahrRaw
            : null,
        laengeM: supportsGrundriss(form.fahrzeugtyp) ? laengeRaw : null,
        breiteM: supportsGrundriss(form.fahrzeugtyp) ? breiteRaw : null,
        icon: form.icon || iconKeyFromFahrzeugtyp(form.fahrzeugtyp),
        eigengewicht: eigen,
        zulGesamtgewicht: zul,
        maxStuetzlast: stuetz != null && stuetz > 0 ? stuetz : null,
        maxTraglast: null,
        aktivVon: form.aktivVon || null,
        aktivBis: form.aktivBis || null,
        traegerTransportId: null,
        gruppeId: form.gruppeId || defaultGruppeId || null,
        urlaubStandard: form.urlaubStandard,
      },
    }
  }

  /** Differentielles Sync – nie „alles löschen“, wenn Laden fehlgeschlagen ist. */
  const syncFestgewichte = async (transportId: string) => {
    if (!festgewichtLoadedRef.current) return
    const resFest = await fetch(`/api/transport-vehicles/festgewicht?transportId=${transportId}`)
    const dataFest = (await resFest.json()) as ApiResponse<{
      manuell: TransportVehicleFestgewichtManuell[]
    }>
    const prevManuell = dataFest.success && dataFest.data ? dataFest.data.manuell : []
    const keepIds = new Set(
      manuellEntries.filter((e) => e.id && e.titel.trim()).map((e) => e.id)
    )

    for (const e of prevManuell) {
      if (!keepIds.has(e.id)) {
        await fetch(`/api/transport-vehicles/festgewicht-manuell?id=${e.id}`, { method: 'DELETE' })
      }
    }
    for (const e of manuellEntries) {
      if (!e.titel.trim()) continue
      const gewicht = e.gewicht >= 0 ? e.gewicht : 0
      if (e.id && keepIds.has(e.id)) {
        const prev = prevManuell.find((p) => p.id === e.id)
        if (prev && prev.titel === e.titel.trim() && prev.gewicht === gewicht) continue
        await fetch('/api/transport-vehicles/festgewicht-manuell', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: e.id, titel: e.titel.trim(), gewicht }),
        })
      } else if (!e.id) {
        await fetch('/api/transport-vehicles/festgewicht-manuell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transportId,
            titel: e.titel.trim(),
            gewicht,
          }),
        })
      }
    }
  }

  const savePersonWeights = async () => {
    if (!zugfaehigMode) return
    // Nur sichtbare / relevante Personen speichern (Standard + ggf. weitere)
    const toSave = showWeiterePersonen ? mitreisende : haushaltPersonen
    for (const m of toSave) {
      const raw = personWeights[m.id]
      const parsed = raw != null && raw !== '' ? parseWeightInput(raw) : null
      const next = parsed != null && parsed > 0 ? parsed : null
      const prev = m.koerpergewicht != null && m.koerpergewicht > 0 ? m.koerpergewicht : null
      if (next === prev) continue
      await fetch('/api/mitreisende', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: m.id,
          name: m.name,
          userId: m.user_id ?? null,
          gruppeId: m.gruppe_id ?? null,
          personentyp: m.personentyp,
          farbe: m.farbe ?? null,
          koerpergewicht: next,
        }),
      })
    }
  }

  const handleCreate = async () => {
    const built = buildPayload()
    if ('error' in built && built.error) {
      alert(built.error)
      return
    }
    if (!('payload' in built) || !built.payload) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/transport-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.payload),
      })
      const data = (await res.json()) as ApiResponse<{ id: string }>
      if (data.success && data.data?.id) {
        const newId = data.data.id
        for (const e of manuellEntries) {
          if (!e.titel.trim()) continue
          await fetch('/api/transport-vehicles/festgewicht-manuell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transportId: newId,
              titel: e.titel.trim(),
              gewicht: e.gewicht,
            }),
          })
        }
        setShowDialog(false)
        resetForm()
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create transport vehicle:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingVehicle) return
    const built = buildPayload()
    if ('error' in built && built.error) {
      alert(built.error)
      return
    }
    if (!('payload' in built) || !built.payload) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/transport-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingVehicle.id, ...built.payload }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        try {
          await syncFestgewichte(editingVehicle.id)
        } catch (festErr) {
          console.warn('Festgewicht-Sync fehlgeschlagen:', festErr)
        }
        try {
          await savePersonWeights()
        } catch (pwErr) {
          console.warn('Personengewichte-Sync fehlgeschlagen:', pwErr)
        }
        setShowDialog(false)
        setEditingVehicle(null)
        resetForm()
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to update transport vehicle:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReplace = async () => {
    if (!replaceVehicle || !tauschdatum) {
      alert('Bitte Tauschdatum angeben')
      return
    }
    const built = buildPayload()
    if ('error' in built && built.error) {
      alert(built.error)
      return
    }
    if (!('payload' in built) || !built.payload) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/transport-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...built.payload,
          replaceOfId: replaceVehicle.id,
          tauschdatum,
        }),
      })
      const data = (await res.json()) as ApiResponse<{ id: string }>
      if (data.success) {
        setReplaceVehicle(null)
        setTauschdatum('')
        resetForm()
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to replace transport vehicle:', error)
      alert('Fehler beim Ersetzen')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setForm(emptyForm(defaultGruppeId))
    setManuellEntries([])
  }

  const handleDelete = (id: string) => {
    setDeleteVehicleId(id)
    setDeleteInUse(null)
    setDeleteMode('inactivate')
    setDeleteUsageLoading(true)
    void fetch(`/api/transport-vehicles?usageId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const data = raw as ApiResponse<{ inUse: boolean }>
        const inUse = !!(data.success && data.data?.inUse)
        setDeleteInUse(inUse)
        setDeleteMode(inUse ? 'inactivate' : 'delete')
      })
      .catch(() => {
        setDeleteInUse(true)
        setDeleteMode('inactivate')
      })
      .finally(() => setDeleteUsageLoading(false))
  }

  const executeDeleteOrInactivate = async () => {
    if (!deleteVehicleId) return
    setIsLoading(true)
    try {
      if (deleteMode === 'inactivate') {
        const res = await fetch('/api/transport-vehicles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: deleteVehicleId, action: 'inactivate' }),
        })
        const data = (await res.json()) as ApiResponse<unknown>
        if (data.success) {
          setDeleteVehicleId(null)
          onRefresh()
        } else {
          alert('Fehler: ' + (data.error ?? 'Unbekannt'))
        }
      } else {
        const res = await fetch(`/api/transport-vehicles?id=${deleteVehicleId}`, {
          method: 'DELETE',
        })
        const data = (await res.json()) as ApiResponse<unknown>
        if (data.success) {
          setDeleteVehicleId(null)
          onRefresh()
        } else {
          alert('Fehler: ' + (data.error ?? 'Unbekannt'))
        }
      }
    } catch (error) {
      console.error('Failed to remove transport vehicle:', error)
      alert(deleteMode === 'inactivate' ? 'Fehler beim Inaktivieren' : 'Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const openEdit = (vehicle: TransportVehicle) => {
    setEditingVehicle(vehicle)
    setReplaceVehicle(null)
    setAktivDatesExpanded(false)
    const typ = isFahrzeugtyp(vehicle.fahrzeugtyp) ? vehicle.fahrzeugtyp : 'auto'
    setForm({
      name: vehicle.name,
      fahrzeugtyp: typ,
      icon: resolveTransportIconKeyForForm(
        vehicle.icon ?? iconKeyFromFahrzeugtyp(typ),
        vehicle.name
      ),
      hersteller: vehicle.hersteller ?? '',
      modell: vehicle.modell ?? '',
      baujahr: vehicle.baujahr != null ? String(vehicle.baujahr) : '',
      laengeM: vehicle.laenge_m != null ? String(vehicle.laenge_m) : '',
      breiteM: vehicle.breite_m != null ? String(vehicle.breite_m) : '',
      zulGesamtgewicht: String(vehicle.zul_gesamtgewicht),
      eigengewicht: String(vehicle.eigengewicht),
      maxStuetzlast: vehicle.max_stuetzlast != null ? String(vehicle.max_stuetzlast) : '',
      maxTraglast:
        vehicle.max_traglast != null
          ? String(vehicle.max_traglast)
          : isAnbau(typ)
            ? String(Math.max(vehicle.zul_gesamtgewicht - vehicle.eigengewicht, 0))
            : '',
      aktivVon: vehicle.aktiv_von ?? '',
      aktivBis: vehicle.aktiv_bis ?? '',
      traegerTransportId: vehicle.traeger_transport_id ?? '',
      gruppeId: vehicle.gruppe_id ?? defaultGruppeId,
      urlaubStandard: !!vehicle.urlaub_standard,
    })
    setKatalogHint(null)
    setKatalogId(null)
    clearImagePicker()
    setKatalogImageUrl(
      vehicle.grundriss_bild_r2_key
        ? `/api/transport-vehicles/${encodeURIComponent(vehicle.id)}/grundriss-image`
        : null
    )
    setShowDialog(true)
  }

  const openNew = () => {
    setEditingVehicle(null)
    setReplaceVehicle(null)
    setAktivDatesExpanded(false)
    const today = todayInAppTimezone()
    setForm({ ...emptyForm(defaultGruppeId), aktivVon: today })
    setManuellEntries([])
    festgewichtLoadedRef.current = true
    setKatalogHint(null)
    setKatalogId(null)
    clearImagePicker()
    setKatalogImageUrl(null)
    setShowDialog(true)
  }

  const openReplace = (vehicle: TransportVehicle) => {
    setReplaceVehicle(vehicle)
    setEditingVehicle(null)
    setAktivDatesExpanded(false)
    const typ = isFahrzeugtyp(vehicle.fahrzeugtyp) ? vehicle.fahrzeugtyp : 'auto'
    const swap = todayInAppTimezone()
    setForm({
      name: vehicle.name,
      fahrzeugtyp: typ,
      icon: resolveTransportIconKeyForForm(
        vehicle.icon ?? iconKeyFromFahrzeugtyp(typ),
        vehicle.name
      ),
      hersteller: vehicle.hersteller ?? '',
      modell: vehicle.modell ?? '',
      baujahr: vehicle.baujahr != null ? String(vehicle.baujahr) : '',
      laengeM: vehicle.laenge_m != null ? String(vehicle.laenge_m) : '',
      breiteM: vehicle.breite_m != null ? String(vehicle.breite_m) : '',
      zulGesamtgewicht: String(vehicle.zul_gesamtgewicht),
      eigengewicht: String(vehicle.eigengewicht),
      maxStuetzlast: vehicle.max_stuetzlast != null ? String(vehicle.max_stuetzlast) : '',
      maxTraglast: '',
      // Server setzt aktivVon = Tauschdatum; Form spiegelt das für die Statusanzeige
      aktivVon: swap,
      aktivBis: '',
      traegerTransportId: '',
      gruppeId: vehicle.gruppe_id ?? defaultGruppeId,
      urlaubStandard: !!vehicle.urlaub_standard,
    })
    setKatalogHint(null)
    setKatalogId(null)
    clearImagePicker()
    setKatalogImageUrl(null)
    setTauschdatum(swap)
    festgewichtLoadedRef.current = true
    setShowDialog(true)
  }

  const addManuellEntry = () => {
    setManuellEntries([...manuellEntries, { id: '', transport_id: '', titel: '', gewicht: 0, created_at: '' }])
  }
  const updateManuellEntry = (idx: number, field: 'titel' | 'gewicht', value: string | number) => {
    const next = [...manuellEntries]
    const e = next[idx]
    if (!e) return
    if (field === 'titel') e.titel = String(value)
    else e.gewicht = typeof value === 'number' ? value : parseFloat(String(value)) || 0
    setManuellEntries(next)
  }
  const removeManuellEntry = (idx: number) => {
    setManuellEntries(manuellEntries.filter((_, i) => i !== idx))
  }
  const deleteManuellEntry = async (idx: number) => {
    const e = manuellEntries[idx]
    if (!e?.id) {
      removeManuellEntry(idx)
      return
    }
    const res = await fetch(`/api/transport-vehicles/festgewicht-manuell?id=${e.id}`, {
      method: 'DELETE',
    })
    const data = (await res.json()) as ApiResponse<unknown>
    if (data.success) {
      removeManuellEntry(idx)
      onRefresh()
    }
  }

  const dialogTitle = replaceVehicle
    ? 'Fahrzeug ersetzen'
    : editingVehicle
      ? 'Transportmittel bearbeiten'
      : 'Neues Transportmittel'

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {vehicles.length === 0 ? (
          <BrandEmptyState
            className="min-h-[36vh] py-10"
            illustration={<TransportEmptyIllustration className={EMPTY_ILLUSTRATION_CLASS} />}
            title="Noch keine Transportmittel"
            description="Legt Fahrzeuge oder Anhänger an – für Gewichte, Packstatus und Wartung."
          />
        ) : (
          <div className="space-y-6">
            {showHaushaltSelect ? (
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                <p className="text-sm font-semibold text-brand-heading">{standardGruppeName}</p>
                <span className="inline-flex items-center rounded-full bg-[rgb(45,79,30)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[rgb(45,79,30)]">
                  Standard
                </span>
              </div>
            ) : null}
            <VehicleSection
              title="Fahrzeuge (selbstfahrend)"
              vehicles={standardGrouped.zug}
              onEdit={openEdit}
              onDelete={handleDelete}
              onReplace={openReplace}
              onWartung={handleWartung}
              wartungCountByTransportId={wartungCountByTransportId}
              canManageWartung={canWriteWartung}
              showHaushalt={false}
            />
            <VehicleSection
              title="Anhänger / Wohnwagen"
              vehicles={standardGrouped.gezogen}
              onEdit={openEdit}
              onDelete={handleDelete}
              onReplace={openReplace}
              onWartung={handleWartung}
              wartungCountByTransportId={wartungCountByTransportId}
              canManageWartung={canWriteWartung}
              showHaushalt={false}
            />
            <VehicleSection
              title="Anbauten"
              vehicles={standardGrouped.anbau}
              onEdit={openEdit}
              onDelete={handleDelete}
              onReplace={openReplace}
              onWartung={handleWartung}
              wartungCountByTransportId={wartungCountByTransportId}
              canManageWartung={canWriteWartung}
              showHaushalt={false}
            />

            {otherHaushalte.length > 0 ? (
              <div className="space-y-5 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/25 px-3 py-4 sm:px-4">
                <p className="text-sm font-medium text-muted-foreground">Weitere Haushalte</p>
                {otherHaushalte.map((haushalt) => (
                  <div key={haushalt.id} className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-dashed border-muted-foreground/25 pb-1">
                      {haushalt.name}
                    </p>
                    <VehicleSection
                      title="Fahrzeuge (selbstfahrend)"
                      vehicles={haushalt.grouped.zug}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onReplace={openReplace}
                      onWartung={handleWartung}
                      wartungCountByTransportId={wartungCountByTransportId}
                      canManageWartung={canWriteWartung}
                      showHaushalt={false}
                      isOtherHaushalt
                    />
                    <VehicleSection
                      title="Anhänger / Wohnwagen"
                      vehicles={haushalt.grouped.gezogen}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onReplace={openReplace}
                      onWartung={handleWartung}
                      wartungCountByTransportId={wartungCountByTransportId}
                      canManageWartung={canWriteWartung}
                      showHaushalt={false}
                      isOtherHaushalt
                    />
                    <VehicleSection
                      title="Anbauten"
                      vehicles={haushalt.grouped.anbau}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onReplace={openReplace}
                      onWartung={handleWartung}
                      wartungCountByTransportId={wartungCountByTransportId}
                      canManageWartung={canWriteWartung}
                      showHaushalt={false}
                      isOtherHaushalt
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="icon"
          onClick={openNew}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>

      <ResponsiveModal
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open)
          if (!open) {
            setReplaceVehicle(null)
            setEditingVehicle(null)
          }
        }}
        title={dialogTitle}
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
        noPadding
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          {replaceVehicle && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-2">
              <p>
                Ersetzt <strong>{replaceVehicle.name}</strong>. Vergangene Urlaube behalten das alte
                Fahrzeug; zukünftige und die Ausrüstung werden umgestellt.
              </p>
              <div>
                <Label>Tauschdatum *</Label>
                <CalendarDatePicker
                  value={tauschdatum}
                  onChange={(v) => {
                    setTauschdatum(v)
                    setForm((prev) => ({ ...prev, aktivVon: v }))
                  }}
                  placeholder="Tauschdatum wählen"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Altes Fahrzeug: aktiv bis Vortag · Neues: aktiv ab diesem Datum.
                </p>
              </div>
            </div>
          )}

          <div>
            <Label>Fahrzeugtyp *</Label>
            <Select
              value={form.fahrzeugtyp}
              onValueChange={(v) => {
                const typ = v as Fahrzeugtyp
                setForm((prev) => ({
                  ...prev,
                  fahrzeugtyp: typ,
                  icon: iconKeyFromFahrzeugtyp(typ),
                }))
                if (isZugfaehig(typ) && editingVehicle) {
                  void loadMitreisende()
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAHRZEUGTYPEN.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FAHRZEUGTYP_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="vehicle-name">Name *</Label>
            <Input
              id="vehicle-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. VW Passat, Knaus Südwind"
            />
          </div>

          {showHaushaltSelect && (
            <div>
              <Label>Haushalt</Label>
              <Select
                value={form.gruppeId || defaultGruppeId}
                onValueChange={(v) => setForm((prev) => ({ ...prev, gruppeId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Haushalt wählen" />
                </SelectTrigger>
                <SelectContent>
                  {gruppen.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5">
            <Checkbox
              id="urlaub-standard"
              checked={form.urlaubStandard}
              onCheckedChange={(c) => setForm((prev) => ({ ...prev, urlaubStandard: !!c }))}
              className="mt-0.5"
            />
            <Label htmlFor="urlaub-standard" className="cursor-pointer text-sm font-normal">
              Standardmäßig bei Urlauben vorauswählen
            </Label>
          </div>

          <div>
            <Label>Icon</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Wird beim Typwechsel automatisch gesetzt, kann aber überschrieben werden.
            </p>
            <div className="flex flex-wrap gap-2">
              {TRANSPORT_ICON_OPTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, icon: key }))}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2 min-w-[4.5rem] transition-colors',
                    form.icon === key
                      ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5 dark:bg-[rgb(45,79,30)]/15'
                      : 'border-subtle hover:border-gray-300 dark:hover:border-white/20'
                  )}
                  aria-pressed={form.icon === key}
                  title={label}
                >
                  <Icon className="h-5 w-5 text-brand-heading" strokeWidth={1.75} />
                  <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hersteller</Label>
              <Input
                value={form.hersteller}
                onChange={(e) => setForm({ ...form, hersteller: e.target.value })}
                placeholder="z.B. VW"
              />
            </div>
            <div>
              <Label>Modell</Label>
              <Input
                value={form.modell}
                onChange={(e) => setForm({ ...form, modell: e.target.value })}
                placeholder="z.B. Passat Variant"
              />
            </div>
          </div>

          {grundrissMode && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-brand-heading">
                Maße für Sonnenausrichtung (optional)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Baujahr</Label>
                  <Input
                    inputMode="numeric"
                    value={form.baujahr}
                    onChange={(e) => setForm({ ...form, baujahr: e.target.value })}
                    placeholder="z.B. 2021"
                  />
                </div>
                <div>
                  <Label>Länge Aufbau (m)</Label>
                  <Input
                    inputMode="decimal"
                    value={form.laengeM}
                    onChange={(e) => setForm({ ...form, laengeM: e.target.value })}
                    placeholder="ohne Deichsel, z.B. 6.79"
                  />
                </div>
                <div>
                  <Label>Breite (m)</Label>
                  <Input
                    inputMode="decimal"
                    value={form.breiteM}
                    onChange={(e) => setForm({ ...form, breiteM: e.target.value })}
                    placeholder="z.B. 2.52"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Für die virtuelle Platzierung zählt die <strong>Aufbaulänge</strong> (Karosserie ohne
                Deichsel). „Aus Netz aktualisieren“ speichert zusätzlich Gesamtlänge und
                Maßhinweise, wenn gefunden.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={katalogLoading || katalogNetLoading}
                  onClick={() => void applyKatalogLookup()}
                >
                  Aus Katalog vorschlagen
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={katalogLoading || katalogNetLoading}
                  onClick={() => void refreshKatalogFromNet()}
                >
                  {katalogNetLoading ? 'Suche im Netz…' : 'Aus Netz aktualisieren'}
                </Button>
              </div>
              {katalogHint && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{katalogHint}</p>
              )}

              {(existingPickUrl || imageCandidates.length > 0) && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                  <p className="text-sm font-medium">Grundriss wählen</p>
                  <p className="text-xs text-muted-foreground">
                    Bitte das richtige Bild auswählen. Erst nach „Bild übernehmen“ wird es
                    gespeichert und zugeschnitten.
                  </p>
                  <RadioGroup
                    value={imagePickSelection ?? undefined}
                    onValueChange={setImagePickSelection}
                    className="gap-3"
                  >
                    {existingPickUrl && (
                      <div className="space-y-2 rounded-md border border-border bg-background p-2">
                        <p className="text-xs text-muted-foreground">Aktuelles Bild</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={existingPickUrl}
                          alt="Aktueller Grundriss"
                          className="max-h-36 w-auto max-w-full object-contain mx-auto"
                        />
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <RadioGroupItem value="keep" />
                          Bestehendes Bild behalten
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <RadioGroupItem value="reprocess" />
                          Bestehendes Bild neu zuschneiden
                        </label>
                      </div>
                    )}
                    {imageCandidates.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {imageCandidates.map((c) => {
                          const value = `url:${c.url}`
                          const previewSrc = `/api/transport-vehicles/katalog-image-proxy?url=${encodeURIComponent(c.url)}`
                          return (
                            <label
                              key={c.url}
                              className={cn(
                                'flex flex-col gap-1 rounded-md border p-1.5 cursor-pointer transition-colors',
                                imagePickSelection === value
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border bg-background hover:border-primary/40'
                              )}
                            >
                              <div className="flex items-center gap-1.5 px-0.5">
                                <RadioGroupItem value={value} />
                                <span className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                                  {c.hint}
                                </span>
                              </div>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={previewSrc}
                                alt="Grundriss-Kandidat"
                                className="h-24 w-full object-contain bg-muted/40 rounded"
                                loading="lazy"
                              />
                            </label>
                          )
                        })}
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value="skip" />
                      Kein Bild übernehmen
                    </label>
                  </RadioGroup>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!imagePickSelection || imageApplyLoading || !katalogId}
                      onClick={() => void applySelectedGrundrissImage()}
                    >
                      {imageApplyLoading ? 'Verarbeite…' : 'Bild übernehmen'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={imageApplyLoading}
                      onClick={() => clearImagePicker()}
                    >
                      Auswahl schließen
                    </Button>
                  </div>
                </div>
              )}

              {katalogImageUrl && !existingPickUrl && imageCandidates.length === 0 && (
                <div className="rounded-md border border-border bg-muted/40 p-2 space-y-2">
                  <p className="text-xs text-muted-foreground mb-1">Grundriss-Bild</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={katalogImageUrl}
                    alt="Wohnwagen-Grundriss"
                    className="max-h-48 w-auto max-w-full object-contain mx-auto"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void openExistingImageAdjust()}
                  >
                    Bild anpassen
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                „Aus Netz aktualisieren“ sucht Maße und bis zu 8 Bildvorschläge. Du wählst das
                richtige Grundriss-Bild; erst dann wird es gespeichert und zugeschnitten. Ohne
                Maße: manuell eintragen (Rechteck aus Länge×Breite).
              </p>
            </div>
          )}

          {anbauMode ? (
            <>
              <div>
                <Label>Eigengewicht *</Label>
                <WeightInput
                  value={form.eigengewicht}
                  onChange={(_, parsed) =>
                    setForm({ ...form, eigengewicht: parsed != null ? String(parsed) : '' })
                  }
                  placeholder="z.B. 18"
                />
              </div>
              <div>
                <Label>Max. Traglast *</Label>
                <WeightInput
                  value={form.maxTraglast}
                  onChange={(_, parsed) =>
                    setForm({ ...form, maxTraglast: parsed != null ? String(parsed) : '' })
                  }
                  placeholder="z.B. 50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Beladung wird gegen die Traglast geprüft; Eigengewicht + Beladung zählen am Träger.
                </p>
              </div>
              <div>
                <Label>Trägerfahrzeug</Label>
                <Select
                  value={form.traegerTransportId || '__none__'}
                  onValueChange={(v) => {
                    const tid = v === '__none__' ? '' : v
                    const traeger = tid ? vehicles.find((x) => x.id === tid) : null
                    setForm((prev) => ({
                      ...prev,
                      traegerTransportId: tid,
                      gruppeId: traeger?.gruppe_id || prev.gruppeId || defaultGruppeId,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kein Träger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Kein Träger</SelectItem>
                    {traegerOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Zulässiges Gesamtgewicht *</Label>
                <WeightInput
                  value={form.zulGesamtgewicht}
                  onChange={(_, parsed) =>
                    setForm({ ...form, zulGesamtgewicht: parsed != null ? String(parsed) : '' })
                  }
                  placeholder="z.B. 2000"
                />
              </div>
              <div>
                <Label>Eigengewicht *</Label>
                <WeightInput
                  value={form.eigengewicht}
                  onChange={(_, parsed) =>
                    setForm({ ...form, eigengewicht: parsed != null ? String(parsed) : '' })
                  }
                  placeholder="z.B. 1475"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nutzlast = Zul. Gesamtgewicht − Eigengewicht
                </p>
              </div>
              {showStuetzlast && (
                <div>
                  <Label>Max. Stützlast</Label>
                  <WeightInput
                    value={form.maxStuetzlast}
                    onChange={(_, parsed) =>
                      setForm({ ...form, maxStuetzlast: parsed != null ? String(parsed) : '' })
                    }
                    placeholder="z.B. 100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Bei Zugfahrzeug und Wohnwagen: wirksames Limit = Minimum beider Werte.
                  </p>
                </div>
              )}
            </>
          )}

          <Collapsible open={aktivDatesExpanded} onOpenChange={setAktivDatesExpanded}>
            <div className="rounded-lg border overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {aktivDatesExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">Status</span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        formIsActive
                          ? 'bg-[rgb(45,79,30)]/10 text-[rgb(45,79,30)]'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {formIsActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {aktivDatesExpanded ? 'Zeitraum ausblenden' : 'Zeitraum bearbeiten'}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
                  <p className="text-xs font-medium text-muted-foreground">Aktivitätszeitraum</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Aktiv von</Label>
                        {form.aktivVon ? (
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                            onClick={() => setForm((prev) => ({ ...prev, aktivVon: '' }))}
                          >
                            Leeren
                          </button>
                        ) : null}
                      </div>
                      <CalendarDatePicker
                        value={form.aktivVon}
                        onChange={(ymd) => setForm((prev) => ({ ...prev, aktivVon: ymd }))}
                        placeholder="Optional"
                        dialogTitle="Aktiv von"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Aktiv bis</Label>
                        {form.aktivBis ? (
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                            onClick={() => setForm((prev) => ({ ...prev, aktivBis: '' }))}
                          >
                            Leeren
                          </button>
                        ) : null}
                      </div>
                      <CalendarDatePicker
                        value={form.aktivBis}
                        onChange={(ymd) => setForm((prev) => ({ ...prev, aktivBis: ymd }))}
                        placeholder="Optional"
                        dialogTitle="Aktiv bis"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {editingVehicle && !replaceVehicle && zugfaehigMode && (
            <div className="space-y-2">
              <Label>Personengewichte</Label>
              <p className="text-xs text-muted-foreground">
                Nur bei selbstfahrenden Fahrzeugen. Eine Person zählt nur in einem Auto – nicht bei
                Wohnwagen oder Anbauten. Stammdaten an der Person; alte „Insassen“-Festgewichte bei
                Bedarf später manuell entfernen.
              </p>
              <div className="space-y-2 border rounded-lg p-3">
                {visiblePersonen.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Keine Personen in diesem Haushalt.
                  </p>
                ) : (
                  visiblePersonen.map((m) => (
                    <div key={m.id} className="flex gap-2 items-center">
                      <span className="flex-1 text-sm">
                        {m.name}
                        {form.gruppeId && m.gruppe_id !== form.gruppeId && (
                          <span className="text-muted-foreground/70 text-xs ml-1">
                            · {m.gruppe_name ?? 'anderer Haushalt'}
                          </span>
                        )}
                      </span>
                      <WeightInput
                        value={personWeights[m.id] ?? ''}
                        onChange={(_, parsed) =>
                          setPersonWeights((prev) => ({
                            ...prev,
                            [m.id]: parsed != null ? String(parsed) : '',
                          }))
                        }
                        className="w-28"
                        placeholder="kg"
                      />
                    </div>
                  ))
                )}
                {anderePersonen.length > 0 && !showWeiterePersonen && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline-offset-2 hover:underline pt-1"
                    onClick={() => setShowWeiterePersonen(true)}
                  >
                    Weitere Personen einblenden
                  </button>
                )}
                {showWeiterePersonen && anderePersonen.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline-offset-2 hover:underline pt-1"
                    onClick={() => setShowWeiterePersonen(false)}
                  >
                    Weitere ausblenden
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Weitere Festgewichte</Label>
              <Button type="button" variant="outline" size="sm" onClick={addManuellEntry}>
                <Plus className="h-4 w-4 mr-1" />
                Hinzufügen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              z.B. Tank, Batterie. Nicht für Insassen oder Anbauten nutzen, die bereits als
              Transportmittel geführt werden.
            </p>
            {manuellEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">Keine manuellen Einträge</p>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                {manuellEntries.map((entry, idx) => (
                  <div key={entry.id || idx} className="flex gap-2 items-center">
                    <Input
                      value={entry.titel}
                      onChange={(e) => updateManuellEntry(idx, 'titel', e.target.value)}
                      placeholder="z.B. Tank"
                      className="flex-1"
                    />
                    <WeightInput
                      value={String(entry.gewicht)}
                      onChange={(_, parsed) => updateManuellEntry(idx, 'gewicht', parsed ?? 0)}
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive"
                      onClick={() => deleteManuellEntry(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editingVehicle && !replaceVehicle && (
            <Collapsible open={festInstalliertExpanded} onOpenChange={setFestInstalliertExpanded}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                {festInstalliertExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Fest installierte Ausrüstung ({festgewichtEquipment.length} Einträge)
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {festgewichtEquipment.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Keine Ausrüstung mit Status „Fest Installiert“ für dieses Transportmittel.
                    </p>
                  ) : (
                    festgewichtEquipment.map((eq) => (
                      <div
                        key={eq.id}
                        className="flex justify-between text-sm py-1 border-b border-muted last:border-0"
                      >
                        <span>
                          {eq.was}
                          {eq.standard_anzahl > 1 && (
                            <span className="text-muted-foreground"> × {eq.standard_anzahl}</span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {formatWeightForDisplay(eq.gesamtgewicht ?? eq.einzelgewicht)} kg
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Button
            onClick={
              replaceVehicle ? handleReplace : editingVehicle ? handleUpdate : handleCreate
            }
            disabled={isLoading}
            className="w-full"
          >
            {isLoading
              ? 'Wird gespeichert...'
              : replaceVehicle
                ? 'Ersetzen'
                : editingVehicle
                  ? 'Aktualisieren'
                  : 'Erstellen'}
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={!!deleteVehicleId}
        onOpenChange={(open) => {
          if (!open) setDeleteVehicleId(null)
        }}
        title="Transportmittel entfernen"
        description={`Was soll mit „${deleteVehicleName}“ geschehen?`}
      >
        <div className="space-y-4 pt-1">
          {deleteUsageLoading ? (
            <p className="text-sm text-muted-foreground">Nutzung wird geprüft…</p>
          ) : (
            <RadioGroup
              value={deleteMode}
              onValueChange={(v) => setDeleteMode(v as 'inactivate' | 'delete')}
              className="gap-3"
            >
              <label
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                  deleteMode === 'inactivate' ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5' : 'border-border'
                )}
              >
                <RadioGroupItem value="inactivate" className="mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Inaktivieren</p>
                  <p className="text-xs text-muted-foreground">
                    Bleibt in der Historie, erscheint aber nicht mehr in neuen Urlauben.
                    {deleteInUse === true ? ' Empfohlen, weil bereits verwendet.' : ''}
                  </p>
                </div>
              </label>
              <label
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                  deleteMode === 'delete' ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                )}
              >
                <RadioGroupItem value="delete" className="mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Endgültig löschen</p>
                  <p className="text-xs text-muted-foreground">
                    Entfernt Zuordnungen in Ausrüstung und Packlisten.
                    {deleteInUse === false ? ' Empfohlen, weil noch nicht verwendet.' : ''}
                  </p>
                </div>
              </label>
            </RadioGroup>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setDeleteVehicleId(null)}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Abbrechen
            </Button>
            <Button
              variant={deleteMode === 'delete' ? 'destructive' : 'default'}
              onClick={() => void executeDeleteOrInactivate()}
              disabled={isLoading || deleteUsageLoading}
              className="w-full sm:w-auto"
            >
              {isLoading
                ? deleteMode === 'inactivate'
                  ? 'Wird inaktiviert…'
                  : 'Wird gelöscht…'
                : deleteMode === 'inactivate'
                  ? 'Inaktivieren'
                  : 'Löschen'}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  )
}
