'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Car } from 'lucide-react'
import type { Mitreisender, TransportVehicle } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { filterVehiclesByGruppeIds, getVacationGruppeIds } from '@/lib/pauschal-gruppen'
import {
  defaultTransportIdsForDate,
  FAHRZEUGTYP_LABELS,
  groupVehiclesByRole,
  isAnbau,
  isFahrzeugtyp,
  isTransportActiveOn,
  isZugfaehig,
  vacationActivityDate,
} from '@/lib/transport-types'
import { TransportIcon } from '@/lib/transport-icons'
import { cn } from '@/lib/utils'
import {
  cacheVacationTransports,
  enqueueSync,
  getCachedTransportVehicles,
  getCachedVacationTransports,
} from '@/lib/offline-sync'
import { cacheTransportVehicles } from '@/lib/offline-db'
import { isOffline, showQueuedToast } from '@/lib/offline-toast'

type Props = {
  vacationId?: string | null
  startdatum: string
  abfahrtdatum?: string | null
  mitreisende: Mitreisender[]
  /** Create-Modus: lokale Auswahl an Parent melden */
  onSelectionChange?: (transportIds: string[], sitz: Record<string, string | null>) => void
}

function VehicleChip({
  vehicle,
  checked,
  onToggle,
  disabled,
}: {
  vehicle: TransportVehicle
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  const typ = isFahrzeugtyp(vehicle.fahrzeugtyp) ? vehicle.fahrzeugtyp : 'auto'
  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
        checked ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5' : 'border-border hover:bg-muted/50',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <Checkbox checked={checked} onCheckedChange={() => onToggle()} disabled={disabled} />
      <TransportIcon icon={vehicle.icon} name={vehicle.name} className="[&_svg]:h-4 [&_svg]:w-4" />
      <span className="text-sm">
        {vehicle.name}
        <span className="text-muted-foreground ml-1 text-xs">({FAHRZEUGTYP_LABELS[typ]})</span>
      </span>
    </label>
  )
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

export function UrlaubTransportManager({
  vacationId,
  startdatum,
  abfahrtdatum,
  mitreisende,
  onSelectionChange,
}: Props) {
  const [catalogVehicles, setCatalogVehicles] = useState<TransportVehicle[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sitz, setSitz] = useState<Record<string, string | null>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [standardGruppeIds, setStandardGruppeIds] = useState<string[]>([])
  const persistRef = useRef<(ids: string[], sitzMap: Record<string, string | null>) => void>(
    () => {}
  )
  const prevAllowedRef = useRef<string[]>([])
  const syncReadyRef = useRef(false)
  const selectedIdsRef = useRef<string[]>([])
  const sitzRef = useRef<Record<string, string | null>>({})

  selectedIdsRef.current = selectedIds
  sitzRef.current = sitz

  const activityDate = vacationActivityDate({ startdatum, abfahrtdatum })

  const plannedGruppeIds = useMemo(() => {
    const fromPeople = getVacationGruppeIds(mitreisende)
    if (fromPeople.length > 0) return fromPeople
    return standardGruppeIds
  }, [mitreisende, standardGruppeIds])

  const plannedGruppeKey = plannedGruppeIds.slice().sort().join(',')

  const allVehicles = useMemo(
    () => filterVehiclesByGruppeIds(catalogVehicles, plannedGruppeIds),
    [catalogVehicles, plannedGruppeIds]
  )

  const visibleVehicles = useMemo(() => {
    return allVehicles.filter(
      (v) => isTransportActiveOn(v, activityDate) || selectedIds.includes(v.id)
    )
  }, [allVehicles, activityDate, selectedIds])

  const groups = useMemo(() => groupVehiclesByRole(visibleVehicles), [visibleVehicles])

  const selectedZug = useMemo(
    () =>
      selectedIds.filter((id) => {
        const v = allVehicles.find((x) => x.id === id)
        return v && isZugfaehig(v.fahrzeugtyp)
      }),
    [selectedIds, allVehicles]
  )

  const persist = useCallback(
    async (ids: string[], sitzMap: Record<string, string | null>) => {
      onSelectionChange?.(ids, sitzMap)
      if (!vacationId) return
      setSaving(true)
      const payload = {
        vacationId,
        transportIds: ids,
        sitzTransportByMitreisender: sitzMap,
      }
      try {
        await cacheVacationTransports(vacationId, ids, sitzMap)
        if (isOffline()) {
          await enqueueSync('vacation-transports', 'put', vacationId, payload)
          showQueuedToast()
          return
        }
        const res = await fetch('/api/vacations/transports', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          await enqueueSync('vacation-transports', 'put', vacationId, payload)
          showQueuedToast()
        }
      } catch (e) {
        console.error('Failed to save vacation transports:', e)
        try {
          await enqueueSync('vacation-transports', 'put', vacationId, payload)
          showQueuedToast()
        } catch {
          /* ignore */
        }
      } finally {
        setSaving(false)
      }
    },
    [vacationId, onSelectionChange]
  )

  persistRef.current = (ids, sitzMap) => {
    void persist(ids, sitzMap)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/mitreisenden-gruppen')
        const data = (await res.json()) as ApiResponse<
          Array<{ id: string; urlaub_standard_mitnehmen: boolean }>
        >
        if (cancelled || !data.success || !data.data) return
        const ids = data.data.filter((g) => g.urlaub_standard_mitnehmen).map((g) => g.id)
        setStandardGruppeIds(ids.length > 0 ? ids : data.data[0] ? [data.data[0].id] : [])
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Vollständigen Katalog laden; Auswahl separat aus dem Urlaub
  useEffect(() => {
    let cancelled = false
    syncReadyRef.current = false
    prevAllowedRef.current = []
    setLoaded(false)

    const load = async () => {
      try {
        let catalog: TransportVehicle[] = []
        try {
          const catalogRes = await fetch('/api/transport-vehicles')
          const catalogJson = (await catalogRes.json()) as ApiResponse<TransportVehicle[]>
          if (catalogJson.success && catalogJson.data) {
            catalog = catalogJson.data
            await cacheTransportVehicles(catalog)
          }
        } catch {
          catalog = await getCachedTransportVehicles()
        }
        if (cancelled) return
        if (catalog.length === 0) {
          catalog = await getCachedTransportVehicles()
        }
        setCatalogVehicles(catalog)

        if (vacationId) {
          let transportIds: string[] = []
          let mitreisendeSitz: Record<string, string | null> = {}
          let suggestedIds: string[] = []
          let needsPrune = false
          let fromNetwork = false

          try {
            const res = await fetch(`/api/vacations/transports?vacationId=${vacationId}`)
            const data = (await res.json()) as ApiResponse<{
              transportIds: string[]
              mitreisendeSitz: Record<string, string | null>
              suggestedIds: string[]
              needsPrune?: boolean
            }>
            if (data.success && data.data) {
              fromNetwork = true
              transportIds = data.data.transportIds
              mitreisendeSitz = data.data.mitreisendeSitz ?? {}
              suggestedIds = data.data.suggestedIds
              needsPrune = !!data.data.needsPrune
              await cacheVacationTransports(vacationId, transportIds, mitreisendeSitz)
            }
          } catch {
            /* offline fallback below */
          }

          if (!fromNetwork) {
            const cached = await getCachedVacationTransports(vacationId)
            if (cached) {
              transportIds = cached.transportIds
              mitreisendeSitz = cached.mitreisendeSitz ?? {}
            }
          }

          if (cancelled) return
          const ids =
            transportIds.length > 0
              ? transportIds
              : suggestedIds.length > 0
                ? suggestedIds
                : defaultTransportIdsForDate(
                    filterVehiclesByGruppeIds(catalog, plannedGruppeIds),
                    activityDate
                  )
          setSelectedIds(ids)
          setSitz(mitreisendeSitz)
          if (fromNetwork && (transportIds.length === 0 || needsPrune) && ids.length > 0) {
            await persist(ids, mitreisendeSitz)
          }
        } else {
          setSelectedIds([])
          setSitz({})
        }
      } catch (e) {
        console.error('Failed to load vacation transports:', e)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacationId])

  // Create-Modus: Defaults sobald Katalog + Haushalte bekannt
  useEffect(() => {
    if (vacationId || !loaded || catalogVehicles.length === 0) return
    if (selectedIdsRef.current.length > 0) return
    if (plannedGruppeIds.length === 0) return
    const eligible = filterVehiclesByGruppeIds(catalogVehicles, plannedGruppeIds)
    const ids = defaultTransportIdsForDate(eligible, activityDate)
    if (ids.length === 0) return
    setSelectedIds(ids)
    onSelectionChange?.(ids, sitzRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacationId, loaded, catalogVehicles, plannedGruppeKey, activityDate])

  // Mitreisenden-/Haushalts-Wechsel: entfernen + Standards neu hinzugekommener Haushalte setzen
  useEffect(() => {
    if (!loaded || plannedGruppeIds.length === 0 || catalogVehicles.length === 0) return

    const eligible = filterVehiclesByGruppeIds(catalogVehicles, plannedGruppeIds)
    const allowedIds = eligible.map((v) => v.id)
    const allowed = new Set(allowedIds)

    if (!syncReadyRef.current) {
      prevAllowedRef.current = allowedIds
      syncReadyRef.current = true
      return
    }

    const prevAllowed = new Set(prevAllowedRef.current)
    const newlyEligible = allowedIds.filter((id) => !prevAllowed.has(id))
    const defaults = new Set(defaultTransportIdsForDate(eligible, activityDate))
    const kept = selectedIdsRef.current.filter((id) => allowed.has(id))
    const toAdd = newlyEligible.filter((id) => defaults.has(id))
    const next = [...new Set([...kept, ...toAdd])]

    prevAllowedRef.current = allowedIds

    if (sameIdSet(next, selectedIdsRef.current)) return

    const nextSitz = { ...sitzRef.current }
    const zugSet = new Set(
      next.filter((tid) => {
        const v = catalogVehicles.find((x) => x.id === tid)
        return v && isZugfaehig(v.fahrzeugtyp)
      })
    )
    for (const [mid, tid] of Object.entries(nextSitz)) {
      if (tid && !zugSet.has(tid)) nextSitz[mid] = null
    }
    setSelectedIds(next)
    setSitz(nextSitz)
    persistRef.current(next, nextSitz)
  }, [plannedGruppeKey, catalogVehicles, loaded, activityDate, plannedGruppeIds])

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    // Anbauten ohne Träger aus Auswahl entfernen (nicht automatisch hinzufügen)
    let withAnbau = [...next]
    const selectedSet = new Set(withAnbau)
    for (const a of allVehicles.filter((v) => isAnbau(v.fahrzeugtyp))) {
      const traeger = a.traeger_transport_id
      if (traeger && selectedSet.has(a.id) && !selectedSet.has(traeger)) {
        withAnbau = withAnbau.filter((x) => x !== a.id)
        selectedSet.delete(a.id)
      }
    }
    const nextSitz = { ...sitz }
    const zugSet = new Set(
      withAnbau.filter((tid) => {
        const v = allVehicles.find((x) => x.id === tid)
        return v && isZugfaehig(v.fahrzeugtyp)
      })
    )
    for (const [mid, tid] of Object.entries(nextSitz)) {
      if (tid && !zugSet.has(tid)) nextSitz[mid] = null
    }
    setSelectedIds(withAnbau)
    setSitz(nextSitz)
    void persist(withAnbau, nextSitz)
  }

  const updateSitz = (mitreisenderId: string, transportId: string | null) => {
    const next = { ...sitz, [mitreisenderId]: transportId }
    setSitz(next)
    void persist(selectedIds, next)
  }

  if (!loaded) {
    return (
      <div className="space-y-2">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Car className="h-4 w-4" />
          Transportmittel
        </Label>
        <p className="text-sm text-muted-foreground">Wird geladen…</p>
      </div>
    )
  }

  const catalogLargerThanEligible =
    catalogVehicles.length > 0 && allVehicles.length < catalogVehicles.length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Car className="h-4 w-4" />
          Transportmittel
        </Label>
        {saving && <span className="text-xs text-muted-foreground">Speichern…</span>}
      </div>

      {visibleVehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {catalogVehicles.length === 0
            ? 'Keine Transportmittel vorhanden. Bitte unter Konfiguration anlegen.'
            : 'Keine Transportmittel für die geplanten Haushalte. Andere Haushalte auswählen oder Fahrzeuge zuordnen.'}
        </p>
      ) : (
        <div className="space-y-3">
          {catalogLargerThanEligible ? (
            <p className="text-xs text-muted-foreground">
              Nur Fahrzeuge der geplanten Haushalte.
            </p>
          ) : null}
          {groups.zug.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Zugfahrzeug / Wohnmobil
              </p>
              <div className="flex flex-col gap-2">
                {groups.zug.map((v) => (
                  <VehicleChip
                    key={v.id}
                    vehicle={v}
                    checked={selectedIds.includes(v.id)}
                    onToggle={() => toggle(v.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {groups.gezogen.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Wohnwagen / Anhänger
              </p>
              <div className="flex flex-col gap-2">
                {groups.gezogen.map((v) => (
                  <VehicleChip
                    key={v.id}
                    vehicle={v}
                    checked={selectedIds.includes(v.id)}
                    onToggle={() => toggle(v.id)}
                  />
                ))}
              </div>
            </div>
          )}
          {groups.anbau.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Aufbauten
              </p>
              <div className="flex flex-col gap-2">
                {groups.anbau.map((v) => (
                  <VehicleChip
                    key={v.id}
                    vehicle={v}
                    checked={selectedIds.includes(v.id)}
                    onToggle={() => toggle(v.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedZug.length > 1 && mitreisende.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium">Wer sitzt wo?</p>
          {mitreisende.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-sm flex-1">{m.name}</span>
              <Select
                value={sitz[m.id] ?? '__auto__'}
                onValueChange={(v) => updateSitz(m.id, v === '__auto__' ? null : v)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Automatisch</SelectItem>
                  {selectedZug.map((id) => {
                    const v = allVehicles.find((x) => x.id === id)
                    return (
                      <SelectItem key={id} value={id}>
                        {v?.name ?? id}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {!vacationId && selectedIds.length === 0 && allVehicles.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const ids = defaultTransportIdsForDate(allVehicles, activityDate)
            setSelectedIds(ids)
            onSelectionChange?.(ids, sitz)
          }}
        >
          Standardauswahl übernehmen
        </Button>
      )}
    </div>
  )
}
