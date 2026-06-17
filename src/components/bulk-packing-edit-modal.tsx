'use client'

import { useEffect, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TransportVehicle } from '@/lib/db'
import type { BulkEditFieldDefaults, BulkEditBemerkungMode } from '@/lib/bulk-packing-profile'

export type BulkPackingPatch = {
  transport_id?: string | null
  bemerkung?: string | null
  anzahl?: number
}

interface BulkPackingEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemCount: number
  transportVehicles: TransportVehicle[]
  fieldDefaults?: BulkEditFieldDefaults
  bemerkungMode?: BulkEditBemerkungMode
  onConfirm: (patch: BulkPackingPatch) => void
}

export function BulkPackingEditModal({
  open,
  onOpenChange,
  itemCount,
  transportVehicles,
  fieldDefaults,
  bemerkungMode = 'normal',
  onConfirm,
}: BulkPackingEditModalProps) {
  const [changeTransport, setChangeTransport] = useState(false)
  const [transportId, setTransportId] = useState('')
  const [changeBemerkung, setChangeBemerkung] = useState(false)
  const [bemerkung, setBemerkung] = useState('')
  const [changeAnzahl, setChangeAnzahl] = useState(false)
  const [anzahl, setAnzahl] = useState('1')

  useEffect(() => {
    if (!open) return
    setChangeTransport(false)
    setChangeBemerkung(false)
    setChangeAnzahl(false)
    setTransportId(fieldDefaults?.transport_id ?? '')
    setBemerkung(fieldDefaults?.bemerkung ?? '')
    setAnzahl(
      fieldDefaults?.anzahl !== undefined ? String(fieldDefaults.anzahl) : '1'
    )
  }, [open, fieldDefaults])

  const showBemerkung = bemerkungMode !== 'hidden'

  const handleSubmit = () => {
    const patch: BulkPackingPatch = {}
    if (changeTransport) {
      patch.transport_id = transportId || null
    }
    if (changeBemerkung) {
      patch.bemerkung = bemerkung.trim() || null
    }
    if (changeAnzahl) {
      const n = parseInt(anzahl, 10)
      if (!Number.isFinite(n) || n < 1) return
      patch.anzahl = n
    }
    if (Object.keys(patch).length === 0) return
    onConfirm(patch)
  }

  const canSubmit = changeTransport || changeBemerkung || changeAnzahl

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${itemCount} Einträge bearbeiten`}
      description="Nur aktivierte Felder werden geändert. Alle anderen Werte bleiben pro Eintrag unverändert."
      contentClassName="sm:max-w-md"
    >
      <div className="space-y-4 pt-2">
        <div className="space-y-2 rounded-lg border border-subtle p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={changeTransport}
              onCheckedChange={(c) => setChangeTransport(!!c)}
            />
            <span className="text-sm font-medium">Transport ändern</span>
          </label>
          {changeTransport && (
            <Select
              value={transportId || 'none'}
              onValueChange={(v) => setTransportId(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Transport wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Transport</SelectItem>
                {transportVehicles.map((tv) => (
                  <SelectItem key={tv.id} value={tv.id}>
                    {tv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {showBemerkung && (
        <div className="space-y-2 rounded-lg border border-subtle p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={changeBemerkung}
              onCheckedChange={(c) => setChangeBemerkung(!!c)}
            />
            <span className="text-sm font-medium">Bemerkung ändern</span>
          </label>
          {bemerkungMode === 'mixed' && (
            <p className="text-xs text-muted-foreground">
              Bemerkungen gelten nur für pauschale bzw. ganze Einträge, nicht für
              personenbezogene Zeilen in der Auswahl.
            </p>
          )}
          {changeBemerkung && (
            <Input
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
              placeholder="Neue Bemerkung (leer = entfernen)"
            />
          )}
        </div>
        )}

        <div className="space-y-2 rounded-lg border border-subtle p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={changeAnzahl}
              onCheckedChange={(c) => setChangeAnzahl(!!c)}
            />
            <span className="text-sm font-medium">Anzahl ändern</span>
          </label>
          {changeAnzahl && (
            <>
              <Input
                type="number"
                min={1}
                value={anzahl}
                onChange={(e) => setAnzahl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Setzt für alle ausgewählten Einträge dieselbe Anzahl – individuelle Werte gehen verloren.
              </p>
            </>
          )}
        </div>

        <Button
          type="button"
          className="w-full bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Änderungen übernehmen
        </Button>
      </div>
    </ResponsiveModal>
  )
}
