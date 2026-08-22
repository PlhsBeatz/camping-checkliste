'use client'

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  Faelligkeit,
  FaelligkeitHistorie,
  FaelligkeitHistorieInitial,
  FaelligkeitEreignisTyp,
  FaelligkeitIntervallEinheit,
} from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import {
  faelligkeitToHistorieInitial,
  getInitialHistorieDatum,
  isHistorieViewPayload,
} from '@/lib/faelligkeit-historie-utils'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FAELLIGKEIT_TYP_LABELS } from '@/lib/faelligkeit-status'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'

const EREIGNIS_LABELS: Record<FaelligkeitEreignisTyp, string> = {
  erledigt: 'Erledigt',
  quittiert: 'Quittiert',
  notiz: 'Notiz',
}

const INTERVALL_EINHEIT_LABEL: Record<FaelligkeitIntervallEinheit, string> = {
  tage: 'Tage',
  monate: 'Monate',
  jahre: 'Jahre',
}

type EditForm = {
  ereignis_typ: FaelligkeitEreignisTyp
  datum: string
  notiz: string
}

function toEditForm(h: FaelligkeitHistorie): EditForm {
  return {
    ereignis_typ: h.ereignis_typ,
    datum: h.datum.slice(0, 10),
    notiz: h.notiz ?? '',
  }
}

function formatIntervall(initial: FaelligkeitHistorieInitial): string | null {
  if (!initial.intervall_einheit || initial.intervall_wert == null || initial.intervall_wert <= 0) {
    return null
  }
  return `${initial.intervall_wert} ${INTERVALL_EINHEIT_LABEL[initial.intervall_einheit]}`
}

function InitialdatenBlock({
  initial,
  canAdmin,
}: {
  initial: FaelligkeitHistorieInitial
  canAdmin: boolean
}) {
  const intervall = formatIntervall(initial)
  const datum = getInitialHistorieDatum(initial)
  const details: string[] = [`Typ: ${FAELLIGKEIT_TYP_LABELS[initial.typ]}`]
  if (initial.bezug_datum && initial.bezug_datum !== datum) {
    details.push(`Kauf-/Herstell-Datum: ${initial.bezug_datum}`)
  }
  if (initial.initial_erledigung_am && initial.initial_erledigung_am !== datum) {
    details.push(`Erste Erledigung: ${initial.initial_erledigung_am}`)
  }
  if (initial.gueltig_bis) details.push(`Gültig bis: ${initial.gueltig_bis}`)
  if (intervall) details.push(`Intervall: ${intervall}`)

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Initialdaten</span>
          {datum && <span className="text-muted-foreground shrink-0">{datum}</span>}
        </div>
        <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          {details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {initial.notizen?.trim() && (
          <p className="text-sm mt-2 text-foreground/90">{initial.notizen}</p>
        )}
      </div>
      {canAdmin && <div className="shrink-0 w-8" aria-hidden="true" />}
    </div>
  )
}

function HistorieEntryRow({
  h,
  canAdmin,
  isEditing,
  editForm,
  saving,
  openMenuId,
  setOpenMenuId,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDeleteRequest,
  setEditForm,
}: {
  h: FaelligkeitHistorie
  canAdmin: boolean
  isEditing: boolean
  editForm: EditForm | null
  saving: boolean
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onDeleteRequest: () => void
  setEditForm: Dispatch<SetStateAction<EditForm | null>>
}) {
  const showUser =
    (h.ereignis_typ === 'quittiert' || h.ereignis_typ === 'erledigt') && h.user_name

  if (isEditing && editForm) {
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Ereignis</Label>
          <Select
            value={editForm.ereignis_typ}
            onValueChange={(v) =>
              setEditForm((f) => (f ? { ...f, ereignis_typ: v as FaelligkeitEreignisTyp } : f))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EREIGNIS_LABELS) as FaelligkeitEreignisTyp[]).map((typ) => (
                <SelectItem key={typ} value={typ}>
                  {EREIGNIS_LABELS[typ]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Datum</Label>
          <CalendarDatePicker
            value={editForm.datum}
            onChange={(ymd) => setEditForm((f) => (f ? { ...f, datum: ymd } : f))}
            dialogTitle="Datum wählen"
          />
        </div>
        <div className="space-y-2">
          <Label>Notiz</Label>
          <Textarea
            value={editForm.notiz}
            onChange={(e) => setEditForm((f) => (f ? { ...f, notiz: e.target.value } : f))}
            rows={2}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={saving}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={() => void onSave()} disabled={saving}>
            Speichern
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium">{EREIGNIS_LABELS[h.ereignis_typ] ?? h.ereignis_typ}</span>
          <span className="text-muted-foreground shrink-0">{h.datum.slice(0, 10)}</span>
        </div>
        {showUser && <p className="text-xs text-muted-foreground">{h.user_name}</p>}
        {h.notiz && <p className="text-sm mt-1">{h.notiz}</p>}
      </div>
      {canAdmin && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu
            open={openMenuId === h.id}
            onOpenChange={(o) => setOpenMenuId(o ? h.id : null)}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Aktionen">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setOpenMenuId(null)
                  onStartEdit()
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => {
                  setOpenMenuId(null)
                  onDeleteRequest()
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

export function FaelligkeitHistorieList({
  open,
  onOpenChange,
  faelligkeitId,
  faelligkeitName,
  faelligkeit,
  canAdmin,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  faelligkeitId: string | null
  faelligkeitName: string
  faelligkeit?: Faelligkeit | null
  canAdmin: boolean
  onChanged?: () => void
}) {
  const [items, setItems] = useState<FaelligkeitHistorie[]>([])
  const [initial, setInitial] = useState<FaelligkeitHistorieInitial | null>(null)
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    if (!faelligkeitId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/faelligkeiten/${faelligkeitId}/historie?limit=50&_=${Date.now()}`,
        { cache: 'no-store' }
      )
      const data = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Historie konnte nicht geladen werden')
        setItems([])
        setInitial(faelligkeit ? faelligkeitToHistorieInitial(faelligkeit) : null)
        return
      }
      if (isHistorieViewPayload(data.data)) {
        setItems(data.data.entries as FaelligkeitHistorie[])
        setInitial(data.data.initial)
      } else if (Array.isArray(data.data)) {
        setItems(data.data as FaelligkeitHistorie[])
        setInitial(faelligkeit ? faelligkeitToHistorieInitial(faelligkeit) : null)
      } else {
        setItems([])
        setInitial(faelligkeit ? faelligkeitToHistorieInitial(faelligkeit) : null)
      }
    } catch {
      setError('Historie konnte nicht geladen werden')
      setItems([])
      setInitial(faelligkeit ? faelligkeitToHistorieInitial(faelligkeit) : null)
    } finally {
      setLoading(false)
    }
  }, [faelligkeitId, faelligkeit])

  useEffect(() => {
    if (!open || !faelligkeitId) return
    setEditId(null)
    setEditForm(null)
    setDeleteId(null)
    setOpenMenuId(null)
    void loadItems()
  }, [open, faelligkeitId, loadItems])

  const startEdit = (h: FaelligkeitHistorie) => {
    setEditId(h.id)
    setEditForm(toEditForm(h))
    setError(null)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditForm(null)
    setError(null)
  }

  const handleSave = async () => {
    if (!faelligkeitId || !editId || !editForm) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/faelligkeiten/${faelligkeitId}/historie/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ereignis_typ: editForm.ereignis_typ,
          datum: editForm.datum,
          notiz: editForm.notiz || null,
        }),
      })
      const data = (await res.json()) as ApiResponse<FaelligkeitHistorie>
      if (!res.ok || !data.success || !data.data) {
        setError(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      setItems((prev) => prev.map((h) => (h.id === editId ? data.data! : h)))
      cancelEdit()
      onChanged?.()
    } catch {
      setError('Netzwerkfehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!faelligkeitId || !deleteId) return
    const id = deleteId
    setDeleteId(null)
    setItems((prev) => prev.filter((h) => h.id !== id))
    if (editId === id) cancelEdit()
    try {
      const res = await fetch(`/api/faelligkeiten/${faelligkeitId}/historie/${id}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Löschen fehlgeschlagen')
        await loadItems()
        return
      }
      onChanged?.()
    } catch {
      setError('Netzwerkfehler beim Löschen')
      await loadItems()
    }
  }

  const displayInitial =
    initial ?? (faelligkeit ? faelligkeitToHistorieInitial(faelligkeit) : null)

  const hasContent = items.length > 0 || displayInitial != null

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title={`Historie: ${faelligkeitName}`}
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : !hasContent ? (
          <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
        ) : (
          <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
            {items.map((h) => (
              <li key={h.id} className="border-b border-border pb-3">
                <HistorieEntryRow
                  h={h}
                  canAdmin={canAdmin}
                  isEditing={editId === h.id}
                  editForm={editId === h.id ? editForm : null}
                  saving={saving}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  onStartEdit={() => startEdit(h)}
                  onCancelEdit={cancelEdit}
                  onSave={() => void handleSave()}
                  onDeleteRequest={() => setDeleteId(h.id)}
                  setEditForm={setEditForm}
                />
              </li>
            ))}
            {displayInitial && (
              <li>
                <InitialdatenBlock initial={displayInitial} canAdmin={canAdmin} />
              </li>
            )}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Historieneintrag löschen?"
        description="Der Eintrag wird unwiderruflich entfernt. Bei Quittierungen/Erledigungen wird die Fälligkeit neu berechnet."
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
