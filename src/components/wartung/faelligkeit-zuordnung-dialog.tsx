'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category, EquipmentItem, MainCategory, TransportVehicle } from '@/lib/db'
import { groupEquipmentForPicker } from '@/lib/equipment-picker-groups'
import { cn } from '@/lib/utils'

export type FaelligkeitZuordnungTyp = 'none' | 'equipment' | 'transport'

export function FaelligkeitZuordnungDialog({
  open,
  onOpenChange,
  equipment,
  categories,
  mainCategories,
  transports,
  equipmentId,
  transportId,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentItem[]
  categories: Category[]
  mainCategories: MainCategory[]
  transports: TransportVehicle[]
  equipmentId: string | null
  transportId: string | null
  onConfirm: (equipmentId: string | null, transportId: string | null) => void
}) {
  const [typ, setTyp] = useState<FaelligkeitZuordnungTyp>('none')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    if (equipmentId) {
      setTyp('equipment')
      setSelectedEquipmentId(equipmentId)
      setSelectedTransportId(null)
    } else if (transportId) {
      setTyp('transport')
      setSelectedTransportId(transportId)
      setSelectedEquipmentId(null)
    } else {
      setTyp('none')
      setSelectedEquipmentId(null)
      setSelectedTransportId(null)
    }
    setSearch('')
  }, [open, equipmentId, transportId])

  const grouped = useMemo(
    () => groupEquipmentForPicker(equipment, categories, mainCategories, search),
    [equipment, categories, mainCategories, search]
  )

  const handleConfirm = () => {
    if (typ === 'equipment') {
      onConfirm(selectedEquipmentId, null)
    } else if (typ === 'transport') {
      onConfirm(null, selectedTransportId)
    } else {
      onConfirm(null, null)
    }
    onOpenChange(false)
  }

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Zuordnung wählen">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['none', 'Keine'],
              ['equipment', 'Ausrüstung'],
              ['transport', 'Transportmittel'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={typ === value ? 'default' : 'outline'}
              onClick={() => setTyp(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {typ === 'transport' && (
          <div className="space-y-2">
            <Label>Transportmittel</Label>
            <Select
              value={selectedTransportId ?? '__none__'}
              onValueChange={(v) => setSelectedTransportId(v === '__none__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Transportmittel wählen…" />
              </SelectTrigger>
              <SelectContent>
                {transports.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {typ === 'equipment' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Gegenständen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border">
              {grouped.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  {search ? 'Keine Gegenstände gefunden' : 'Keine Ausrüstung vorhanden'}
                </p>
              ) : (
                <div className="space-y-4 p-2">
                  {grouped.map((main) => (
                    <div key={main.mainCategoryId}>
                      <div className="rounded-t-md bg-[rgb(45,79,30)] px-3 py-1.5 text-sm font-semibold text-white">
                        {main.mainName}
                      </div>
                      {main.categories.map((cat) => (
                        <div
                          key={`${main.mainCategoryId}-${cat.categoryId}`}
                          className="border-x border-b last:rounded-b-md"
                        >
                          <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold">
                            {cat.name} ({cat.items.length})
                          </div>
                          <div className="divide-y divide-border">
                            {cat.items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={cn(
                                  'w-full px-3 py-2.5 text-left text-sm hover:bg-muted/40 transition-colors',
                                  selectedEquipmentId === item.id && 'bg-muted font-medium'
                                )}
                                onClick={() => setSelectedEquipmentId(item.id)}
                              >
                                {item.was}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={typ === 'equipment' && !selectedEquipmentId}
          >
            Übernehmen
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}

export function formatFaelligkeitZuordnung(
  equipmentId: string | null,
  transportId: string | null,
  equipment: EquipmentItem[],
  transports: TransportVehicle[]
): string | null {
  if (equipmentId) {
    const eq = equipment.find((e) => e.id === equipmentId)
    return eq ? `Ausrüstung: ${eq.was}` : 'Ausrüstung'
  }
  if (transportId) {
    const tr = transports.find((t) => t.id === transportId)
    return tr ? `Transport: ${tr.name}` : 'Transportmittel'
  }
  return null
}
