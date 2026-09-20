'use client'

import { useMemo, useState } from 'react'
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
import type { VerbrauchMedium } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import {
  VERBRAUCH_MEDIEN_KATALOG,
  type VerbrauchMessmodus,
} from '@/lib/verbrauch-medien-katalog'
import { Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function VerbrauchMedienManager({
  medien,
  onRefresh,
}: {
  medien: VerbrauchMedium[]
  onRefresh: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customEinheit, setCustomEinheit] = useState('l')
  const [customModus, setCustomModus] = useState<VerbrauchMessmodus>('abnahme')
  const [customDichte, setCustomDichte] = useState('')
  const [customLeer, setCustomLeer] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editDichte, setEditDichte] = useState<Record<string, string>>({})
  const [editLeer, setEditLeer] = useState<Record<string, string>>({})

  const configuredKeys = useMemo(
    () => new Set(medien.map((m) => m.schluessel)),
    [medien]
  )

  const availablePresets = VERBRAUCH_MEDIEN_KATALOG.filter(
    (k) => !configuredKeys.has(k.schluessel)
  )

  const activatePreset = async (schluessel: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/verbrauch-medien', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schluessel }),
      })
      if (res.ok) onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (id: string, ist_aktiv: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/verbrauch-medien/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ist_aktiv }),
      })
      if (res.ok) onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const saveDichte = async (m: VerbrauchMedium) => {
    setSaving(true)
    try {
      const dichteRaw = editDichte[m.id] ?? (m.dichte_kg_pro_l != null ? String(m.dichte_kg_pro_l) : '')
      const leerRaw = editLeer[m.id] ?? (m.leergewicht_kg != null ? String(m.leergewicht_kg) : '')
      const res = await fetch(`/api/verbrauch-medien/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dichte_kg_pro_l: parseOptionalNumber(dichteRaw),
          leergewicht_kg: parseOptionalNumber(leerRaw),
        }),
      })
      if (res.ok) onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const createCustom = async () => {
    if (!customName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/verbrauch-medien', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName.trim(),
          einheit: customEinheit.trim() || 'kg',
          messmodus: customModus,
          dichte_kg_pro_l: parseOptionalNumber(customDichte),
          leergewicht_kg: parseOptionalNumber(customLeer),
        }),
      })
      const data = (await res.json()) as ApiResponse<VerbrauchMedium>
      if (res.ok && data.success) {
        setCustomName('')
        setCustomEinheit('l')
        setCustomModus('abnahme')
        setCustomDichte('')
        setCustomLeer('')
        onRefresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    setDeleteId(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/verbrauch-medien/${id}`, { method: 'DELETE' })
      if (res.ok) onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const active = medien.filter((m) => m.ist_aktiv)
  const inactive = medien.filter((m) => !m.ist_aktiv)
  const showCustomDichte = customEinheit.trim().toLowerCase() === 'l'

  return (
    <div className="space-y-8 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Typische Medien schnell aktivieren. Nur aktive Medien erscheinen unter Tools → Verbrauch.
        Bei Einheit „l“ kannst du Dichte und Leergewicht für die Umrechnung Gewicht → Liter setzen.
      </p>

      {availablePresets.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Aus Katalog aktivieren</h3>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((p) => (
              <Button
                key={p.schluessel}
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => void activatePreset(p.schluessel)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {p.name} ({p.einheit})
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Aktiv</h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Medien aktiv.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((m) => {
              const isLiter = m.einheit.trim().toLowerCase() === 'l'
              const dichteVal =
                editDichte[m.id] ?? (m.dichte_kg_pro_l != null ? String(m.dichte_kg_pro_l) : '')
              const leerVal =
                editLeer[m.id] ?? (m.leergewicht_kg != null ? String(m.leergewicht_kg) : '')
              return (
                <li key={m.id} className="rounded-md border px-3 py-2 text-sm bg-card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {m.einheit} · {m.messmodus === 'zunahme' ? 'Zähler' : 'Tank/Flasche'}
                        {m.dichte_kg_pro_l != null && (
                          <> · ρ {m.dichte_kg_pro_l} kg/l</>
                        )}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        title="Deaktivieren"
                        onClick={() => void setActive(m.id, false)}
                      >
                        <PowerOff className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        title="Löschen"
                        onClick={() => setDeleteId(m.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {isLiter && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] items-end border-t pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Dichte (kg/l)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={dichteVal}
                          onChange={(e) =>
                            setEditDichte((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          placeholder="z. B. 0,80"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Leergewicht Kanister (kg)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={leerVal}
                          onChange={(e) =>
                            setEditLeer((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          placeholder="optional"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => void saveDichte(m)}
                      >
                        Speichern
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {inactive.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Deaktiviert</h3>
          <ul className="space-y-2">
            {inactive.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
              >
                <span>
                  {m.name} · {m.einheit}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    title="Aktivieren"
                    onClick={() => void setActive(m.id, true)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    title="Löschen"
                    onClick={() => setDeleteId(m.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 border-t pt-6">
        <h3 className="text-sm font-medium">Eigenes Medium</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Name</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="z. B. Benzin"
            />
          </div>
          <div className="space-y-2">
            <Label>Einheit</Label>
            <Input
              value={customEinheit}
              onChange={(e) => setCustomEinheit(e.target.value)}
              placeholder="l"
            />
          </div>
          <div className="space-y-2">
            <Label>Messmodus</Label>
            <Select
              value={customModus}
              onValueChange={(v) => setCustomModus(v as VerbrauchMessmodus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="abnahme">Tank/Flasche (Abnahme)</SelectItem>
                <SelectItem value="zunahme">Zähler (Zunahme)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showCustomDichte && (
            <>
              <div className="space-y-2">
                <Label>Dichte (kg/l)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={customDichte}
                  onChange={(e) => setCustomDichte(e.target.value)}
                  placeholder="z. B. 0,75"
                />
              </div>
              <div className="space-y-2">
                <Label>Leergewicht (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={customLeer}
                  onChange={(e) => setCustomLeer(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </>
          )}
        </div>
        <Button
          type="button"
          disabled={saving || !customName.trim()}
          onClick={() => void createCustom()}
        >
          <Plus className="mr-1 h-4 w-4" />
          Anlegen
        </Button>
      </section>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Medium löschen?"
        description="Das Medium wird entfernt. Bestehende Messungen bleiben erhalten, sind aber keinem aktiven Medium mehr zugeordnet."
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
