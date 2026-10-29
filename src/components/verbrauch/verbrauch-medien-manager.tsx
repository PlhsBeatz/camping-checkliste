'use client'

import { useEffect, useMemo, useState } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ListTile } from '@/components/list-tile'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BrandEmptyState } from '@/components/brand-empty-state'
import {
  EMPTY_ILLUSTRATION_CLASS,
  GearEmptyIllustration,
} from '@/components/brand-empty-illustrations'
import type { EquipmentItem, VerbrauchMedium } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import type { VerbrauchMediumAusruestungLink } from '@/lib/db-verbrauch'
import {
  VERBRAUCH_MEDIEN_KATALOG,
  type VerbrauchMessmodus,
} from '@/lib/verbrauch-medien-katalog'
import {
  Fuel,
  MoreVertical,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  X,
} from 'lucide-react'

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function messmodusLabel(modus: VerbrauchMessmodus): string {
  return modus === 'zunahme' ? 'Zähler' : 'Tank/Flasche'
}

function formatMediumSummary(m: VerbrauchMedium): string {
  const parts = [m.einheit, messmodusLabel(m.messmodus)]
  if (m.dichte_kg_pro_l != null) parts.push(`ρ ${m.dichte_kg_pro_l} kg/l`)
  if (m.leergewicht_kg != null) parts.push(`Leergewicht ${m.leergewicht_kg} kg`)
  return parts.join(' · ')
}

/** Wie bei Alternativen: Namenssuche; leer → Vorschläge zum Medium-Namen/Schlüssel. */
function equipmentHitsForMedium(
  medium: VerbrauchMedium,
  equipment: EquipmentItem[],
  linkedIds: Set<string>,
  query: string
): { mode: 'suggest' | 'search'; items: EquipmentItem[] } {
  const available = equipment.filter(
    (e) => !linkedIds.has(e.id) && e.status !== 'Ausgemustert'
  )
  const q = query.trim().toLowerCase()
  if (q.length >= 1) {
    return {
      mode: 'search',
      items: available.filter((e) => e.was.toLowerCase().includes(q)).slice(0, 8),
    }
  }
  const needles = [medium.name, medium.schluessel]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2)
  if (needles.length === 0) return { mode: 'suggest', items: [] }
  const scored = available
    .map((e) => {
      const was = e.was.toLowerCase()
      let score = 0
      for (const n of needles) {
        if (was === n) score = Math.max(score, 100)
        else if (was.startsWith(n)) score = Math.max(score, 80)
        else if (was.includes(n)) score = Math.max(score, 60)
        else if (n.includes(was) && was.length >= 3) score = Math.max(score, 40)
      }
      return { e, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.was.localeCompare(b.e.was, 'de'))
  return { mode: 'suggest', items: scored.slice(0, 8).map((x) => x.e) }
}

function MediumRow({
  medium,
  links,
  menuOpenId,
  setMenuOpenId,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  medium: VerbrauchMedium
  links: VerbrauchMediumAusruestungLink[]
  menuOpenId: string | null
  setMenuOpenId: (id: string | null) => void
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  return (
    <ListTile
      className={`flex items-start justify-between gap-2 ${
        medium.ist_aktiv ? '' : 'opacity-75'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Fuel className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-brand-heading">{medium.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatMediumSummary(medium)}</p>
          {links.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-2">
              Ausrüstung:{' '}
              {links
                .map((l) =>
                  l.status === 'Fest Installiert' ? `${l.was} (fest)` : l.was
                )
                .join(', ')}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground/70">Keine Ausrüstung zugeordnet</p>
          )}
          {!medium.ist_aktiv && (
            <p className="mt-1 text-xs text-muted-foreground">Deaktiviert</p>
          )}
        </div>
      </div>
      <DropdownMenu
        open={menuOpenId === medium.id}
        onOpenChange={(o) => setMenuOpenId(o ? medium.id : null)}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpenId(null)
              onEdit()
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpenId(null)
              onToggleActive()
            }}
          >
            {medium.ist_aktiv ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Deaktivieren
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Aktivieren
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => {
              setMenuOpenId(null)
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ListTile>
  )
}

function AusruestungEditor({
  medium,
  equipment,
  links,
  saving,
  onAdd,
  onRemove,
}: {
  medium: VerbrauchMedium
  equipment: EquipmentItem[]
  links: VerbrauchMediumAusruestungLink[]
  saving: boolean
  onAdd: (equipmentId: string) => void
  onRemove: (equipmentId: string) => void
}) {
  const [query, setQuery] = useState('')
  const linkedIds = useMemo(() => new Set(links.map((l) => l.equipment_id)), [links])
  const hits = equipmentHitsForMedium(medium, equipment, linkedIds, query)
  const showSuggest = links.length === 0 && hits.mode === 'suggest' && hits.items.length > 0
  const showSearchHits = hits.mode === 'search' && hits.items.length > 0

  return (
    <div className="space-y-3 rounded-xl border border-subtle bg-muted/30 p-3">
      <div className="space-y-1">
        <Label htmlFor="eq-search-edit">Zugeordnete Ausrüstung</Label>
        <p className="text-xs text-muted-foreground">
          Verknüpfe z. B. Gastank oder Wassertank. Das Medium erscheint im Urlaub nur, wenn
          eines dieser Teile gepackt oder fest installiert ist.
        </p>
      </div>
      {links.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {links.map((l) => (
            <li
              key={l.equipment_id}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
            >
              <span>
                {l.was}
                {l.status === 'Fest Installiert' ? ' · fest' : ''}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                disabled={saving}
                aria-label="Entfernen"
                onClick={() => onRemove(l.equipment_id)}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {showSuggest && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Vorschläge – mit Klick übernehmen</p>
          <ul className="max-h-32 overflow-y-auto rounded-md border bg-card divide-y">
            {hits.items.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={saving}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                  onClick={() => {
                    onAdd(e.id)
                    setQuery('')
                  }}
                >
                  {e.was}
                  {e.status === 'Fest Installiert' ? ' · fest' : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Input
        id="eq-search-edit"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Namen suchen…"
        className="h-8 text-sm"
        disabled={saving || equipment.length === 0}
      />
      {showSearchHits && (
        <ul className="max-h-32 overflow-y-auto rounded-md border bg-card divide-y">
          {hits.items.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={saving}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                onClick={() => {
                  onAdd(e.id)
                  setQuery('')
                }}
              >
                {e.was}
                {e.status === 'Fest Installiert' ? ' · fest' : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hits.mode === 'search' && query.trim() && hits.items.length === 0 && (
        <p className="text-xs text-muted-foreground">Kein Treffer.</p>
      )}
      {equipment.length === 0 && (
        <p className="text-xs text-muted-foreground">Keine Ausrüstung vorhanden.</p>
      )}
    </div>
  )
}

export function VerbrauchMedienManager({
  medien,
  onRefresh,
  openCatalogTrigger,
  onOpenCatalogConsumed,
  openCreateTrigger,
  onOpenCreateConsumed,
}: {
  medien: VerbrauchMedium[]
  onRefresh: () => void
  openCatalogTrigger?: boolean
  onOpenCatalogConsumed?: () => void
  openCreateTrigger?: boolean
  onOpenCreateConsumed?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customEinheit, setCustomEinheit] = useState('l')
  const [customModus, setCustomModus] = useState<VerbrauchMessmodus>('abnahme')
  const [customDichte, setCustomDichte] = useState('')
  const [customLeer, setCustomLeer] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<VerbrauchMedium | null>(null)
  const [editDichte, setEditDichte] = useState('')
  const [editLeer, setEditLeer] = useState('')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [linksByMedium, setLinksByMedium] = useState<
    Record<string, VerbrauchMediumAusruestungLink[]>
  >({})

  const configuredKeys = useMemo(() => new Set(medien.map((m) => m.schluessel)), [medien])

  const availablePresets = VERBRAUCH_MEDIEN_KATALOG.filter(
    (k) => !configuredKeys.has(k.schluessel)
  )

  const mediumIdsKey = medien.map((m) => m.id).join(',')

  useEffect(() => {
    if (medien.length === 0) {
      setLinksByMedium({})
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const [eqRes, linksRes] = await Promise.all([
          fetch('/api/equipment-items'),
          fetch('/api/verbrauch-medien/ausruestung'),
        ])
        if (cancelled) return
        const eqData = (await eqRes.json()) as ApiResponse<EquipmentItem[]>
        if (eqData.success && eqData.data) setEquipment(eqData.data)

        const linksData = (await linksRes.json()) as ApiResponse<
          VerbrauchMediumAusruestungLink[]
        >
        const next: Record<string, VerbrauchMediumAusruestungLink[]> = {}
        for (const m of medien) next[m.id] = []
        if (linksData.success && linksData.data) {
          for (const link of linksData.data) {
            const list = next[link.medium_id] ?? (next[link.medium_id] = [])
            list.push(link)
          }
        }
        setLinksByMedium(next)
      } catch (e) {
        console.error('Failed to load Ausrüstung-Links:', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mediumIdsKey, medien])

  useEffect(() => {
    if (!editItem) return
    if (!medien.some((m) => m.id === editItem.id)) {
      setEditItem(null)
    }
  }, [medien, editItem])

  useEffect(() => {
    if (!openCatalogTrigger) return
    setCatalogOpen(true)
    onOpenCatalogConsumed?.()
  }, [openCatalogTrigger, onOpenCatalogConsumed])

  useEffect(() => {
    if (!openCreateTrigger) return
    setCreateOpen(true)
    onOpenCreateConsumed?.()
  }, [openCreateTrigger, onOpenCreateConsumed])

  useEffect(() => {
    if (catalogOpen && availablePresets.length === 0) {
      setCatalogOpen(false)
    }
  }, [catalogOpen, availablePresets.length])

  const openEdit = (m: VerbrauchMedium) => {
    setEditDichte(m.dichte_kg_pro_l != null ? String(m.dichte_kg_pro_l) : '')
    setEditLeer(m.leergewicht_kg != null ? String(m.leergewicht_kg) : '')
    setEditItem(m)
  }

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

  const saveEdit = async () => {
    if (!editItem) return
    const isLiter = editItem.einheit.trim().toLowerCase() === 'l'
    if (!isLiter) {
      setEditItem(null)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/verbrauch-medien/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dichte_kg_pro_l: parseOptionalNumber(editDichte),
          leergewicht_kg: parseOptionalNumber(editLeer),
        }),
      })
      if (res.ok) {
        setEditItem(null)
        onRefresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const saveAusruestung = async (mediumId: string, equipmentIds: string[]) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/verbrauch-medien/${mediumId}/ausruestung`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment_ids: equipmentIds }),
      })
      const data = (await res.json()) as ApiResponse<VerbrauchMediumAusruestungLink[]>
      if (data.success && data.data) {
        setLinksByMedium((prev) => ({ ...prev, [mediumId]: data.data! }))
      }
    } finally {
      setSaving(false)
    }
  }

  const addLink = async (mediumId: string, equipmentId: string) => {
    if (!equipmentId) return
    const current = linksByMedium[mediumId] ?? []
    if (current.some((l) => l.equipment_id === equipmentId)) return
    await saveAusruestung(mediumId, [
      ...current.map((l) => l.equipment_id),
      equipmentId,
    ])
  }

  const removeLink = async (mediumId: string, equipmentId: string) => {
    const current = linksByMedium[mediumId] ?? []
    await saveAusruestung(
      mediumId,
      current.filter((l) => l.equipment_id !== equipmentId).map((l) => l.equipment_id)
    )
  }

  const resetCustomForm = () => {
    setCustomName('')
    setCustomEinheit('l')
    setCustomModus('abnahme')
    setCustomDichte('')
    setCustomLeer('')
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
          einheit: customEinheit.trim() || 'l',
          messmodus: customModus,
          dichte_kg_pro_l: parseOptionalNumber(customDichte),
          leergewicht_kg: parseOptionalNumber(customLeer),
        }),
      })
      if (res.ok) {
        resetCustomForm()
        setCreateOpen(false)
        onRefresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/verbrauch-medien/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteId(null)
        onRefresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const active = medien.filter((m) => m.ist_aktiv)
  const inactive = medien.filter((m) => !m.ist_aktiv)
  const showCustomDichte = customEinheit.trim().toLowerCase() === 'l'
  const editIsLiter = editItem?.einheit.trim().toLowerCase() === 'l'

  return (
    <>
      <p className="text-sm text-muted-foreground max-w-2xl mb-4">
        Typische Medien schnell aktivieren. Nur aktive Medien erscheinen unter Tools → Verbrauch.
      </p>

      {medien.length === 0 ? (
        <BrandEmptyState
          className="min-h-[40vh]"
          illustration={<GearEmptyIllustration className={EMPTY_ILLUSTRATION_CLASS} />}
          title="Noch keine Medien"
          description="Aktiviere Einträge aus dem Katalog oder lege ein eigenes Medium an – über den Plus-Button."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Aktiv</h3>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">Noch keine Medien aktiv.</p>
            ) : (
              <div className="space-y-2">
                {active.map((m) => (
                  <MediumRow
                    key={m.id}
                    medium={m}
                    links={linksByMedium[m.id] ?? []}
                    menuOpenId={menuOpenId}
                    setMenuOpenId={setMenuOpenId}
                    onEdit={() => openEdit(m)}
                    onToggleActive={() => void setActive(m.id, false)}
                    onDelete={() => setDeleteId(m.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {inactive.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Deaktiviert</h3>
              <div className="space-y-2">
                {inactive.map((m) => (
                  <MediumRow
                    key={m.id}
                    medium={m}
                    links={linksByMedium[m.id] ?? []}
                    menuOpenId={menuOpenId}
                    setMenuOpenId={setMenuOpenId}
                    onEdit={() => openEdit(m)}
                    onToggleActive={() => void setActive(m.id, true)}
                    onDelete={() => setDeleteId(m.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ResponsiveModal
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        title="Aus Katalog aktivieren"
        description="Wähle ein vordefiniertes Medium. Es erscheint anschließend in der Liste und kann dort angepasst werden."
      >
        {availablePresets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine weiteren Katalog-Medien verfügbar.</p>
        ) : (
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
            {availablePresets.map((p) => (
              <li key={p.schluessel}>
                <button
                  type="button"
                  disabled={saving}
                  className="w-full rounded-xl border border-subtle bg-card px-4 py-3 text-left shadow-sm hover:bg-muted/40 disabled:opacity-50 transition-colors"
                  onClick={() => void activatePreset(p.schluessel)}
                >
                  <p className="font-medium text-brand-heading">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.einheit} · {messmodusLabel(p.messmodus)}
                    {p.dichte_kg_pro_l != null ? ` · ρ ${p.dichte_kg_pro_l} kg/l` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => setCatalogOpen(false)}>
            Schließen
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCustomForm()
        }}
        title="Eigenes Medium"
      >
        {/* p-2 -m-2: Platz für Focus-Ring (ring + ring-offset); kein overflow (schneidet Ringe ab) */}
        <div className="space-y-4 p-2 -m-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="z. B. Benzin"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setCreateOpen(false)
              resetCustomForm()
            }}
          >
            Abbrechen
          </Button>
          <Button
            disabled={saving || !customName.trim()}
            onClick={() => void createCustom()}
          >
            {saving ? 'Anlegen…' : 'Anlegen'}
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) setEditItem(null)
        }}
        title={editItem ? `„${editItem.name}“ bearbeiten` : 'Medium bearbeiten'}
        description={
          editItem
            ? `${editItem.einheit} · ${messmodusLabel(editItem.messmodus)}`
            : undefined
        }
      >
        {editItem && (
          <>
            {/* p-2 -m-2: Platz für Focus-Ring; kein overflow (schneidet Ringe ab) */}
            <div className="space-y-4 p-2 -m-2">
              {editIsLiter && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Dichte (kg/l)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editDichte}
                      onChange={(e) => setEditDichte(e.target.value)}
                      placeholder="z. B. 0,80"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Leergewicht Kanister (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editLeer}
                      onChange={(e) => setEditLeer(e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                </div>
              )}
              <AusruestungEditor
                medium={editItem}
                equipment={equipment}
                links={linksByMedium[editItem.id] ?? []}
                saving={saving}
                onAdd={(equipmentId) => void addLink(editItem.id, equipmentId)}
                onRemove={(equipmentId) => void removeLink(editItem.id, equipmentId)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  const id = editItem.id
                  const nextActive = !editItem.ist_aktiv
                  setEditItem(null)
                  void setActive(id, nextActive)
                }}
              >
                {editItem.ist_aktiv ? (
                  <>
                    <PowerOff className="mr-2 h-4 w-4" />
                    Deaktivieren
                  </>
                ) : (
                  <>
                    <Power className="mr-2 h-4 w-4" />
                    Aktivieren
                  </>
                )}
              </Button>
              <div className="flex gap-2 ml-auto">
                {editIsLiter ? (
                  <>
                    <Button variant="outline" onClick={() => setEditItem(null)}>
                      Abbrechen
                    </Button>
                    <Button disabled={saving} onClick={() => void saveEdit()}>
                      {saving ? 'Speichern…' : 'Speichern'}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setEditItem(null)}>Fertig</Button>
                )}
              </div>
            </div>
          </>
        )}
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Medium löschen?"
        description="Das Medium wird entfernt. Bestehende Messungen bleiben erhalten, sind aber keinem aktiven Medium mehr zugeordnet."
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
