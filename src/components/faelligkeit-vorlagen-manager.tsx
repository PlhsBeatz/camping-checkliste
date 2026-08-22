'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FaelligkeitVorlage } from '@/lib/db'
import type {
  FaelligkeitIntervallEinheit,
  FaelligkeitIntervallRhythmus,
  FaelligkeitKategorie,
  FaelligkeitTyp,
} from '@/lib/faelligkeit-status'
import {
  FAELLIGKEIT_INTERVALL_RHYTHMUS_LABELS,
  FAELLIGKEIT_KATEGORIE_LABELS,
  FAELLIGKEIT_TYP_LABELS,
} from '@/lib/faelligkeit-status'
import type { ApiResponse } from '@/lib/api-types'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FabMenuM3 } from '@/components/fab-menu-m3'
import { GripVertical, MoreVertical, Pencil, Plus, Trash2, Wrench } from 'lucide-react'

const COMPACT_NUMBER_INPUT =
  'h-9 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]'

const INTERVALL_EINHEIT_LABEL: Record<FaelligkeitIntervallEinheit, string> = {
  tage: 'Tage',
  monate: 'Monate',
  jahre: 'Jahre',
}

type VorlageForm = {
  name: string
  kategorie: FaelligkeitKategorie
  typ: FaelligkeitTyp
  intervall_einheit: FaelligkeitIntervallEinheit | ''
  intervall_wert: string
  intervall_rhythmus: FaelligkeitIntervallRhythmus
  warnung_tage_vorher: string
  sicherheitsrelevant: boolean
  quittierung_erforderlich: boolean
  notizen: string
  hinweis: string
}

const EMPTY_FORM: VorlageForm = {
  name: '',
  kategorie: 'sonstiges',
  typ: 'festes_datum',
  intervall_einheit: '',
  intervall_wert: '',
  intervall_rhythmus: 'taggenau',
  warnung_tage_vorher: '30',
  sicherheitsrelevant: false,
  quittierung_erforderlich: false,
  notizen: '',
  hinweis: '',
}

function sortVorlagen(list: FaelligkeitVorlage[]): FaelligkeitVorlage[] {
  return [...list].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'de')
  )
}

function vorlageToForm(v: FaelligkeitVorlage): VorlageForm {
  return {
    name: v.name,
    kategorie: v.kategorie,
    typ: v.typ,
    intervall_einheit: v.intervall_einheit ?? '',
    intervall_wert: v.intervall_wert != null ? String(v.intervall_wert) : '',
    intervall_rhythmus: v.intervall_rhythmus,
    warnung_tage_vorher: String(v.warnung_tage_vorher),
    sicherheitsrelevant: v.sicherheitsrelevant,
    quittierung_erforderlich: v.quittierung_erforderlich,
    notizen: v.notizen ?? '',
    hinweis: v.hinweis ?? '',
  }
}

function formatVorlageSummary(v: FaelligkeitVorlage): string {
  const parts = [FAELLIGKEIT_TYP_LABELS[v.typ]]
  if (v.intervall_wert != null && v.intervall_einheit) {
    parts.push(`${v.intervall_wert} ${INTERVALL_EINHEIT_LABEL[v.intervall_einheit]}`)
    if (v.intervall_rhythmus === 'monatsende') {
      parts.push(FAELLIGKEIT_INTERVALL_RHYTHMUS_LABELS.monatsende)
    }
  }
  parts.push(`Warnung ${v.warnung_tage_vorher} Tage`)
  if (v.sicherheitsrelevant) parts.push('Sicherheitsrelevant')
  return parts.join(' · ')
}

function formToPayload(form: VorlageForm) {
  return {
    name: form.name.trim(),
    kategorie: form.kategorie,
    typ: form.typ,
    intervall_einheit: form.intervall_einheit || null,
    intervall_wert: form.intervall_wert ? Number(form.intervall_wert) : null,
    intervall_rhythmus:
      form.intervall_einheit === 'tage' || !form.intervall_einheit
        ? 'taggenau'
        : form.intervall_rhythmus,
    warnung_tage_vorher: Number(form.warnung_tage_vorher) || 30,
    sicherheitsrelevant: form.sicherheitsrelevant,
    quittierung_erforderlich: form.quittierung_erforderlich,
    notizen: form.notizen.trim() || null,
    hinweis: form.hinweis.trim() || null,
  }
}

function SortableVorlageRow({
  vorlage,
  menuOpenId,
  setMenuOpenId,
  onEdit,
  onDelete,
}: {
  vorlage: FaelligkeitVorlage
  menuOpenId: string | null
  setMenuOpenId: (id: string | null) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: vorlage.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card rounded-xl border border-subtle shadow-sm px-2 py-3 sm:px-4 flex items-start justify-between gap-2"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-1 text-muted-foreground/70 cursor-grab active:cursor-grabbing shrink-0"
          style={{ touchAction: 'none' }}
          aria-label="Zum Sortieren ziehen"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-brand-heading">{vorlage.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatVorlageSummary(vorlage)}</p>
          {vorlage.hinweis && (
            <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-2">{vorlage.hinweis}</p>
          )}
        </div>
      </div>
      <DropdownMenu
        open={menuOpenId === vorlage.id}
        onOpenChange={(o) => setMenuOpenId(o ? vorlage.id : null)}
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
    </div>
  )
}

function VorlageFormFields({
  form,
  setForm,
}: {
  form: VorlageForm
  setForm: React.Dispatch<React.SetStateAction<VorlageForm>>
}) {
  const showIntervall = form.typ === 'intervall' || form.typ === 'alter_anzeige'
  const showRhythmus =
    showIntervall && form.intervall_einheit !== 'tage' && form.intervall_einheit !== ''

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Typ</Label>
          <Select
            value={form.typ}
            onValueChange={(v) => setForm((f) => ({ ...f, typ: v as FaelligkeitTyp }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FAELLIGKEIT_TYP_LABELS) as FaelligkeitTyp[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {FAELLIGKEIT_TYP_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Kategorie (intern)</Label>
          <Select
            value={form.kategorie}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, kategorie: v as FaelligkeitKategorie }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FAELLIGKEIT_KATEGORIE_LABELS) as FaelligkeitKategorie[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {FAELLIGKEIT_KATEGORIE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showIntervall && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Intervall</Label>
            <Input
              type="number"
              min={1}
              className={COMPACT_NUMBER_INPUT}
              value={form.intervall_wert}
              onChange={(e) => setForm((f) => ({ ...f, intervall_wert: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Einheit</Label>
            <Select
              value={form.intervall_einheit || '__none__'}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  intervall_einheit: v === '__none__' ? '' : (v as FaelligkeitIntervallEinheit),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {(Object.keys(INTERVALL_EINHEIT_LABEL) as FaelligkeitIntervallEinheit[]).map(
                  (e) => (
                    <SelectItem key={e} value={e}>
                      {INTERVALL_EINHEIT_LABEL[e]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          {showRhythmus && (
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>Rhythmus</Label>
              <Select
                value={form.intervall_rhythmus}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    intervall_rhythmus: v as FaelligkeitIntervallRhythmus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(FAELLIGKEIT_INTERVALL_RHYTHMUS_LABELS) as [
                      FaelligkeitIntervallRhythmus,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 max-w-[12rem]">
        <Label>Warnung (Tage vorher)</Label>
        <Input
          type="number"
          min={0}
          className={COMPACT_NUMBER_INPUT}
          value={form.warnung_tage_vorher}
          onChange={(e) => setForm((f) => ({ ...f, warnung_tage_vorher: e.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="vorlage-sicherheitsrelevant"
            checked={form.sicherheitsrelevant}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, sicherheitsrelevant: checked === true }))
            }
          />
          <Label htmlFor="vorlage-sicherheitsrelevant" className="font-normal cursor-pointer">
            Sicherheitsrelevant
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="vorlage-quittierung"
            checked={form.quittierung_erforderlich}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, quittierung_erforderlich: checked === true }))
            }
          />
          <Label htmlFor="vorlage-quittierung" className="font-normal cursor-pointer">
            Quittierung erforderlich
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Standard-Notizen</Label>
        <Textarea
          value={form.notizen}
          onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Hinweis (nur in Vorlagen-Verwaltung)</Label>
        <Textarea
          value={form.hinweis}
          onChange={(e) => setForm((f) => ({ ...f, hinweis: e.target.value }))}
          rows={2}
          placeholder="Optionaler Hinweis für die Konfiguration…"
        />
      </div>
    </div>
  )
}

export function FaelligkeitVorlagenManager({
  vorlagen,
  onRefresh,
}: {
  vorlagen: FaelligkeitVorlage[]
  onRefresh: () => void
}) {
  const [items, setItems] = useState<FaelligkeitVorlage[]>(() => sortVorlagen(vorlagen))
  const [editItem, setEditItem] = useState<FaelligkeitVorlage | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<FaelligkeitVorlage | null>(null)
  const [form, setForm] = useState<VorlageForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [fabOpen, setFabOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const itemIds = useMemo(() => items.map((v) => v.id), [items])

  useEffect(() => {
    setItems(sortVorlagen(vorlagen))
  }, [vorlagen])

  useEffect(() => {
    if (!createOpen && !editItem) return
    setForm(editItem ? vorlageToForm(editItem) : { ...EMPTY_FORM })
    setError(null)
  }, [createOpen, editItem])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.findIndex((v) => v.id === active.id)
      const newIndex = items.findIndex((v) => v.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove([...items], oldIndex, newIndex)
      setItems(reordered)
      setReordering(true)

      try {
        for (let i = 0; i < reordered.length; i++) {
          const v = reordered[i]
          if (!v) continue
          const sort_order = (i + 1) * 10
          if (v.sort_order === sort_order) continue
          await fetch(`/api/faelligkeit-vorlagen/${v.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order }),
          })
        }
        onRefresh()
      } catch (e) {
        console.error('Failed to reorder vorlagen:', e)
        onRefresh()
      } finally {
        setReordering(false)
      }
    },
    [items, onRefresh]
  )

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      setError('Name ist erforderlich')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = formToPayload(form)
      const url = editItem
        ? `/api/faelligkeit-vorlagen/${editItem.id}`
        : '/api/faelligkeit-vorlagen'
      const res = await fetch(url, {
        method: editItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as ApiResponse<FaelligkeitVorlage>
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      setCreateOpen(false)
      setEditItem(null)
      onRefresh()
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }, [editItem, form, onRefresh])

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return
    const id = deleteItem.id
    setDeleteItem(null)
    try {
      const res = await fetch(`/api/faelligkeit-vorlagen/${id}`, { method: 'DELETE' })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !data.success) {
        console.error('Vorlage löschen fehlgeschlagen:', data.error)
        return
      }
      onRefresh()
    } catch (error) {
      console.error('Vorlage löschen fehlgeschlagen:', error)
    }
  }, [deleteItem, onRefresh])

  return (
    <>
      <p className="text-sm text-muted-foreground max-w-2xl mb-4">
        Vorlagen erscheinen beim Anlegen neuer Fälligkeiten unter Wartung & Verbrauch. Die
        Reihenfolge legen Sie per Ziehen am Griff-Symbol fest.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Noch keine Vorlagen vorhanden.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className={`space-y-2 ${reordering ? 'opacity-70 pointer-events-none' : ''}`}>
              {items.map((v) => (
                <SortableVorlageRow
                  key={v.id}
                  vorlage={v}
                  menuOpenId={menuOpenId}
                  setMenuOpenId={setMenuOpenId}
                  onEdit={() => setEditItem(v)}
                  onDelete={() => setDeleteItem(v)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FabMenuM3
        open={fabOpen}
        onOpenChange={setFabOpen}
        actions={[
          {
            icon: Plus,
            label: 'Neue Vorlage',
            onClick: () => {
              setFabOpen(false)
              setCreateOpen(true)
            },
          },
        ]}
      />

      <ResponsiveModal
        open={createOpen || !!editItem}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditItem(null)
          }
        }}
        title={editItem ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
      >
        <VorlageFormFields form={form} setForm={setForm} />
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setCreateOpen(false)
              setEditItem(null)
            }}
          >
            Abbrechen
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Vorlage löschen?"
        description={
          deleteItem
            ? `„${deleteItem.name}" wirklich löschen? Bereits angelegte Fälligkeiten bleiben erhalten.`
            : ''
        }
        confirmLabel="Löschen"
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
