'use client'

import { useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Trash2, Plus, MoreVertical, Pencil, Truck } from 'lucide-react'
import { TransportVehicle } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'

function TransportmittelRow({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: TransportVehicle
  onEdit: (v: TransportVehicle) => void
  onDelete: (id: string) => void
}) {
  const nutzlast = vehicle.zul_gesamtgewicht - vehicle.eigengewicht
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 bg-white">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[rgb(45,79,30)]/10 flex items-center justify-center flex-shrink-0">
          <Truck className="h-5 w-5 text-[rgb(45,79,30)]" />
        </div>
        <div>
          <p className="font-medium">{vehicle.name}</p>
          <p className="text-xs text-muted-foreground">
            Zul. Gesamt: {vehicle.zul_gesamtgewicht} kg · Eigengewicht: {vehicle.eigengewicht} kg · Nutzlast: {nutzlast.toFixed(1)} kg
          </p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              onEdit(vehicle)
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
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
  vehicles: TransportVehicle[]
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
    eigengewicht: ''
  })

  const handleCreate = async () => {
    const name = form.name.trim()
    const zul = parseFloat(form.zulGesamtgewicht.replace(',', '.'))
    const eigen = parseFloat(form.eigengewicht.replace(',', '.'))
    if (!name) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }
    if (isNaN(zul) || zul <= 0) {
      alert('Zulässiges Gesamtgewicht muss größer als 0 sein')
      return
    }
    if (isNaN(eigen) || eigen < 0) {
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
          eigengewicht: eigen
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setForm({ name: '', zulGesamtgewicht: '', eigengewicht: '' })
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
    const zul = parseFloat(form.zulGesamtgewicht.replace(',', '.'))
    const eigen = parseFloat(form.eigengewicht.replace(',', '.'))
    if (!name) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }
    if (isNaN(zul) || zul <= 0) {
      alert('Zulässiges Gesamtgewicht muss größer als 0 sein')
      return
    }
    if (isNaN(eigen) || eigen < 0) {
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
          eigengewicht: eigen
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setEditingVehicle(null)
        setForm({ name: '', zulGesamtgewicht: '', eigengewicht: '' })
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

  const handleDelete = (id: string) => {
    setDeleteVehicleId(id)
  }

  const executeDelete = async () => {
    if (!deleteVehicleId) return
    const id = deleteVehicleId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/transport-vehicles?id=${id}`, {
        method: 'DELETE'
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
      eigengewicht: String(vehicle.eigengewicht)
    })
    setShowDialog(true)
  }

  const openNew = () => {
    setEditingVehicle(null)
    setForm({ name: '', zulGesamtgewicht: '', eigengewicht: '' })
    setShowDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Ihre Transportmittel (z.B. Wohnwagen, Auto). Die Gewichtsangaben werden für die Packlisten-Berechnung verwendet.
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

      {/* FAB: Neues Transportmittel */}
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="icon"
          onClick={openNew}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>

      {/* Create/Edit Dialog */}
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
            <Label htmlFor="vehicle-zul">Zulässiges Gesamtgewicht (kg) *</Label>
            <Input
              id="vehicle-zul"
              type="number"
              step="0.1"
              min="0.1"
              value={form.zulGesamtgewicht}
              onChange={(e) => setForm({ ...form, zulGesamtgewicht: e.target.value })}
              placeholder="z.B. 2000"
            />
          </div>
          <div>
            <Label htmlFor="vehicle-eigen">Eigengewicht (kg) *</Label>
            <Input
              id="vehicle-eigen"
              type="number"
              step="0.1"
              min="0"
              value={form.eigengewicht}
              onChange={(e) => setForm({ ...form, eigengewicht: e.target.value })}
              placeholder="z.B. 1475"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nutzlast = Zul. Gesamtgewicht − Eigengewicht
            </p>
          </div>
          <Button
            onClick={editingVehicle ? handleUpdate : handleCreate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Wird gespeichert...' : editingVehicle ? 'Aktualisieren' : 'Erstellen'}
          </Button>
        </div>
      </ResponsiveModal>

      {/* Löschen – Bestätigung */}
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
