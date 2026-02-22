'use client'

import { useState, useEffect } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WeightInput } from '@/components/ui/weight-input'
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
import { Trash2, Plus, MoreVertical, Pencil, Truck, ChevronDown, ChevronRight } from 'lucide-react'
import {
  TransportVehicle,
  TransportVehicleFestgewichtManuell,
  type TransportVehicleWithFestgewicht,
} from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { formatWeightForDisplay, parseWeightInput } from '@/lib/utils'

function TransportmittelRow({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: TransportVehicleWithFestgewicht | TransportVehicle
  onEdit: (v: TransportVehicle) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const nutzlast = vehicle.zul_gesamtgewicht - vehicle.eigengewicht
  const festgewichtTotal = 'festgewichtTotal' in vehicle ? vehicle.festgewichtTotal : 0
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 bg-white">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[rgb(45,79,30)]/10 flex items-center justify-center flex-shrink-0">
          <Truck className="h-5 w-5 text-[rgb(45,79,30)]" />
        </div>
        <div>
          <p className="font-medium">{vehicle.name}</p>
          <p className="text-xs text-muted-foreground">
            Zul. Gesamt: {formatWeightForDisplay(vehicle.zul_gesamtgewicht)} kg · Eigengewicht:{' '}
            {formatWeightForDisplay(vehicle.eigengewicht)} kg · Nutzlast:{' '}
            {formatWeightForDisplay(nutzlast)} kg
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

interface TransportmittelManagerProps {
  vehicles: (TransportVehicleWithFestgewicht | TransportVehicle)[]
  onRefresh: () => void
}

export function TransportmittelManager({ vehicles, onRefresh }: TransportmittelManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null)
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    zulGesamtgewicht: '',
    eigengewicht: '',
  })
  const [manuellEntries, setManuellEntries] = useState<TransportVehicleFestgewichtManuell[]>([])
  const [festgewichtEquipment, setFestgewichtEquipment] = useState<
    Array<{ id: string; was: string; einzelgewicht: number; standard_anzahl: number; gesamtgewicht: number }>
  >([])
  const [festInstalliertExpanded, setFestInstalliertExpanded] = useState(false)

  const loadFestgewicht = async (transportId: string) => {
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
      }
    } catch (e) {
      console.error('Failed to load festgewicht:', e)
    }
  }

  useEffect(() => {
    if (editingVehicle && showDialog) {
      loadFestgewicht(editingVehicle.id)
    } else {
      setManuellEntries([])
      setFestgewichtEquipment([])
      setFestInstalliertExpanded(false)
    }
  }, [editingVehicle, showDialog])

  const handleCreate = async () => {
    const name = form.name.trim()
    const zul = parseWeightInput(form.zulGesamtgewicht)
    const eigen = parseWeightInput(form.eigengewicht)
    if (!name) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }
    if (zul === null || zul <= 0) {
      alert('Zulässiges Gesamtgewicht muss größer als 0 sein')
      return
    }
    if (eigen === null || eigen < 0) {
      alert('Eigengewicht muss 0 oder größer sein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/transport-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          zulGesamtgewicht: zul,
          eigengewicht: eigen,
        }),
      })
      const data = (await res.json()) as ApiResponse<{ id: string }>
      if (data.success && data.data?.id) {
        const newId = data.data.id
        for (const e of manuellEntries) {
          await fetch('/api/transport-vehicles/festgewicht-manuell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transportId: newId,
              titel: e.titel,
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
    const name = form.name.trim()
    const zul = parseWeightInput(form.zulGesamtgewicht)
    const eigen = parseWeightInput(form.eigengewicht)
    if (!name) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }
    if (zul === null || zul <= 0) {
      alert('Zulässiges Gesamtgewicht muss größer als 0 sein')
      return
    }
    if (eigen === null || eigen < 0) {
      alert('Eigengewicht muss 0 oder größer sein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/transport-vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVehicle.id,
          name,
          zulGesamtgewicht: zul,
          eigengewicht: eigen,
        }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        try {
          const resFest = await fetch(
            `/api/transport-vehicles/festgewicht?transportId=${editingVehicle.id}`
          )
          const dataFest = (await resFest.json()) as ApiResponse<{
            manuell: TransportVehicleFestgewichtManuell[]
          }>
          const prevManuell = dataFest.success && dataFest.data ? dataFest.data.manuell : []
          for (const e of prevManuell) {
            await fetch(`/api/transport-vehicles/festgewicht-manuell?id=${e.id}`, {
              method: 'DELETE',
            })
          }
          for (const e of manuellEntries) {
            if (e.titel.trim()) {
              await fetch('/api/transport-vehicles/festgewicht-manuell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transportId: editingVehicle.id,
                  titel: e.titel.trim(),
                  gewicht: e.gewicht >= 0 ? e.gewicht : 0,
                }),
              })
            }
          }
        } catch (festErr) {
          console.warn('Festgewicht-Sync fehlgeschlagen (Migration 0006 evtl. nicht ausgeführt):', festErr)
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

  const resetForm = () => {
    setForm({
      name: '',
      zulGesamtgewicht: '',
      eigengewicht: '',
    })
    setManuellEntries([])
  }

  const handleDelete = (id: string) => setDeleteVehicleId(id)

  const executeDelete = async () => {
    if (!deleteVehicleId) return
    setIsLoading(true)
    try {
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
    } catch (error) {
      console.error('Failed to delete transport vehicle:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const openEdit = (vehicle: TransportVehicle) => {
    setEditingVehicle(vehicle)
    setForm({
      name: vehicle.name,
      zulGesamtgewicht: String(vehicle.zul_gesamtgewicht),
      eigengewicht: String(vehicle.eigengewicht),
    })
    setShowDialog(true)
  }

  const openNew = () => {
    setEditingVehicle(null)
    resetForm()
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre Transportmittel (z.B. Wohnwagen, Auto). Die Gewichtsangaben werden für
          die Packlisten-Berechnung verwendet.
        </p>
        {vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
            Noch keine Transportmittel angelegt
          </p>
        ) : (
          <div className="space-y-2">
            {vehicles.map((vehicle) => (
              <TransportmittelRow
                key={vehicle.id}
                vehicle={vehicle}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
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
        onOpenChange={setShowDialog}
        title={editingVehicle ? 'Transportmittel bearbeiten' : 'Neues Transportmittel'}
        description={
          editingVehicle
            ? 'Ändern Sie die Details des Transportmittels'
            : 'Erstellen Sie ein neues Transportmittel'
        }
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
        noPadding
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          <div>
            <Label htmlFor="vehicle-name">Name *</Label>
            <Input
              id="vehicle-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Wohnwagen, Auto"
            />
          </div>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Manuelle Festgewicht-Einträge</Label>
              <Button type="button" variant="outline" size="sm" onClick={addManuellEntry}>
                <Plus className="h-4 w-4 mr-1" />
                Hinzufügen
              </Button>
            </div>
            {manuellEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">
                Keine manuellen Einträge (z.B. Stützlast, Insassen, Tank)
              </p>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                {manuellEntries.map((entry, idx) => (
                  <div key={entry.id || idx} className="flex gap-2 items-center">
                    <Input
                      value={entry.titel}
                      onChange={(e) => updateManuellEntry(idx, 'titel', e.target.value)}
                      placeholder="z.B. Stützlast"
                      className="flex-1"
                    />
                    <WeightInput
                      value={String(entry.gewicht)}
                      onChange={(_, parsed) =>
                        updateManuellEntry(idx, 'gewicht', parsed ?? 0)
                      }
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

          {editingVehicle && (
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
            onClick={editingVehicle ? handleUpdate : handleCreate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Wird gespeichert...' : editingVehicle ? 'Aktualisieren' : 'Erstellen'}
          </Button>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteVehicleId}
        onOpenChange={(open) => !open && setDeleteVehicleId(null)}
        title="Transportmittel löschen"
        description="Möchten Sie dieses Transportmittel wirklich löschen? Die Zuordnung bei Ausrüstungsgegenständen und Packlisten-Einträgen wird entfernt."
        onConfirm={executeDelete}
        isLoading={isLoading}
      />
    </div>
  )
}
