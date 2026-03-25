'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ChecklisteEintrag, ChecklisteMitStruktur } from '@/lib/db'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  ListChecks,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const P_CL = 'cl:'
const P_K = 'k:'
const P_E = 'e:'
const P_DROP = 'drop:'

function clId(id: string) {
  return `${P_CL}${id}`
}
function parseClId(s: string) {
  return s.startsWith(P_CL) ? s.slice(P_CL.length) : null
}
function kId(id: string) {
  return `${P_K}${id}`
}
function parseKId(s: string) {
  return s.startsWith(P_K) ? s.slice(P_K.length) : null
}
function eId(id: string) {
  return `${P_E}${id}`
}
function parseEId(s: string) {
  return s.startsWith(P_E) ? s.slice(P_E.length) : null
}
function dropId(kategorieId: string) {
  return `${P_DROP}${kategorieId}`
}
function parseDropId(s: string) {
  return s.startsWith(P_DROP) ? s.slice(P_DROP.length) : null
}

async function fetchChecklisten(): Promise<ChecklisteMitStruktur[]> {
  const res = await fetch('/api/checklisten')
  const data = (await res.json()) as { success?: boolean; data?: ChecklisteMitStruktur[]; error?: string }
  if (!res.ok || !data.success || !data.data) {
    throw new Error(data.error || 'Laden fehlgeschlagen')
  }
  return data.data
}

function SortableChecklistCard({
  checklist,
  onOpen,
}: {
  checklist: ChecklisteMitStruktur
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clId(checklist.id),
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }
  const total = checklist.kategorien.reduce((n, k) => n + k.eintraege.length, 0)
  const done = checklist.kategorien.reduce(
    (n, k) => n + k.eintraege.filter(e => e.erledigt).length,
    0
  )
  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className="cursor-pointer hover:border-[rgb(45,79,30)]/40 transition-colors"
        onClick={() => onOpen()}
      >
        <CardHeader className="pb-2 flex flex-row items-start gap-2 space-y-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 -mt-1 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
            style={{ touchAction: 'none' }}
            aria-label="Checkliste sortieren"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold text-[rgb(45,79,30)] leading-tight">
              {checklist.titel}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {done}/{total} erledigt
            </p>
          </div>
          <ListChecks className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        </CardHeader>
      </Card>
    </div>
  )
}

function CategoryDropZone({ kategorieId, children }: { kategorieId: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(kategorieId) })
  return (
    <div
      ref={setNodeRef}
      className={cn('rounded-md min-h-[48px] transition-colors', isOver && 'bg-[rgb(45,79,30)]/5')}
    >
      {children}
    </div>
  )
}

function SortableEditorCategoryBlock({
  katId,
  titel,
  onRename,
  onDelete,
  children,
}: {
  katId: string
  titel: string
  onRename: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: kId(katId),
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b bg-[rgb(250,250,249)]">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          style={{ touchAction: 'none' }}
          aria-label="Kategorie sortieren"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <p className="font-semibold text-[rgb(45,79,30)] flex-1 min-w-0 truncate">{titel}</p>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false)
                onRename()
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false)
                onDelete()
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </div>
  )
}

function SortableEntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: ChecklisteEintrag
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: eId(entry.id),
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 px-3 border-b border-border/50 last:border-0 hover:bg-muted/40"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex items-center justify-center min-w-[40px] min-h-[40px] -my-1 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
        style={{ touchAction: 'none' }}
        aria-label="Eintrag sortieren"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <p className="text-sm flex-1 min-w-0">{entry.text}</p>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onEdit()
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onDelete()
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

function buildEntryReorderPayload(c: ChecklisteMitStruktur): {
  id: string
  kategorie_id: string
  reihenfolge: number
}[] {
  const updates: { id: string; kategorie_id: string; reihenfolge: number }[] = []
  for (const kat of c.kategorien) {
    kat.eintraege.forEach((e, i) => {
      updates.push({ id: e.id, kategorie_id: kat.id, reihenfolge: i })
    })
  }
  return updates
}

export function ChecklistenTool() {
  const { canAccessConfig } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ChecklisteMitStruktur[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [newListOpen, setNewListOpen] = useState(false)
  const [newListTitel, setNewListTitel] = useState('')
  const [deleteListId, setDeleteListId] = useState<string | null>(null)
  const [resetListId, setResetListId] = useState<string | null>(null)
  const [deleteKat, setDeleteKat] = useState<{ checklistId: string; katId: string; titel: string } | null>(
    null
  )
  const [entryModal, setEntryModal] = useState<{
    checklistId: string
    kategorieId: string
    entry: ChecklisteEintrag | null
  } | null>(null)
  const [entryText, setEntryText] = useState('')
  const [katModal, setKatModal] = useState<{
    checklistId: string
    katId: string | null
    titel: string
  } | null>(null)
  const [katTitel, setKatTitel] = useState('')

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const lists = await fetchChecklisten()
      setData(lists)
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : 'Fehler beim Laden',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const activeChecklist = useMemo(
    () => (detailId ? data.find(c => c.id === detailId) : null),
    [data, detailId]
  )

  const sortedLists = useMemo(
    () => [...data].sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)),
    [data]
  )

  const allEditorSortableIds = useMemo(() => {
    if (!activeChecklist || !editMode) return []
    const ids: string[] = []
    for (const k of activeChecklist.kategorien) {
      ids.push(kId(k.id))
      for (const e of k.eintraege) ids.push(eId(e.id))
    }
    return ids
  }, [activeChecklist, editMode])

  const persistEntryOrder = async (c: ChecklisteMitStruktur) => {
    const updates = buildEntryReorderPayload(c)
    const res = await fetch(`/api/checklisten/${c.id}/eintraege/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    const j = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !j.success) {
      toast({
        title: j.error || 'Sortierung speichern fehlgeschlagen',
        variant: 'destructive',
      })
      await load()
      return
    }
    await load()
  }

  const handleDragEndOverview = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const a = parseClId(String(active.id))
    const o = parseClId(String(over.id))
    if (!a || !o) return
    const oldIndex = sortedLists.findIndex(c => c.id === a)
    const newIndex = sortedLists.findIndex(c => c.id === o)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove([...sortedLists], oldIndex, newIndex)
    const orderedIds = reordered.map(c => c.id)
    const res = await fetch('/api/checklisten', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    })
    const j = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !j.success) {
      toast({
        title: j.error || 'Reihenfolge speichern fehlgeschlagen',
        variant: 'destructive',
      })
    }
    await load()
  }

  const handleDragEndEditor = async (event: DragEndEvent) => {
    if (!activeChecklist || !canAccessConfig) return
    const { active, over } = event
    if (!over) return

    const activeStr = String(active.id)
    const overStr = String(over.id)

    // Kategorie-Reihenfolge
    const ak = parseKId(activeStr)
    if (ak) {
      const ok = parseKId(overStr)
      if (!ok) return
      const cats = [...activeChecklist.kategorien].sort(
        (a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)
      )
      const oldIndex = cats.findIndex(k => k.id === ak)
      const newIndex = cats.findIndex(k => k.id === ok)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const reordered = arrayMove(cats, oldIndex, newIndex)
      const orderedIds = reordered.map(k => k.id)
      const res = await fetch(`/api/checklisten/${activeChecklist.id}/kategorien/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      })
      const j = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !j.success)
        toast({ title: j.error || 'Fehler', variant: 'destructive' })
      await load()
      return
    }

    // Eintrag
    const entryId = parseEId(activeStr)
    if (!entryId) return

    const findCatOfEntry = (eid: string) =>
      activeChecklist.kategorien.find(k => k.eintraege.some(e => e.id === eid))

    const fromKat = findCatOfEntry(entryId)
    if (!fromKat) return

    const entry = fromKat.eintraege.find(e => e.id === entryId)
    if (!entry) return

    const dropK = parseDropId(overStr)
    const overEntryId = parseEId(overStr)
    const overKatId = parseKId(overStr)

    let toKatId: string | null = null
    if (dropK) toKatId = dropK
    else if (overEntryId) {
      const ok = findCatOfEntry(overEntryId)
      if (ok) toKatId = ok.id
    } else if (overKatId) toKatId = overKatId

    if (!toKatId) return

    const next: ChecklisteMitStruktur = {
      ...activeChecklist,
      kategorien: activeChecklist.kategorien.map(k => ({
        ...k,
        eintraege: [...k.eintraege],
      })),
    }

    if (fromKat.id === toKatId) {
      const bucket = next.kategorien.find(k => k.id === toKatId)
      if (!bucket) return
      const list = [...bucket.eintraege]
      const oldIdx = list.findIndex(e => e.id === entryId)
      if (oldIdx < 0) return

      if (dropK === toKatId) {
        bucket.eintraege = arrayMove(list, oldIdx, list.length - 1)
      } else if (overEntryId && overEntryId !== entryId) {
        const newIdx = list.findIndex(e => e.id === overEntryId)
        if (newIdx < 0) return
        bucket.eintraege = arrayMove(list, oldIdx, newIdx)
      } else {
        return
      }
    } else {
      for (const k of next.kategorien) {
        k.eintraege = k.eintraege.filter(e => e.id !== entryId)
      }
      const target = next.kategorien.find(k => k.id === toKatId)
      if (!target) return
      const moved: ChecklisteEintrag = { ...entry, kategorie_id: toKatId }
      let insertIndex = target.eintraege.length
      if (overEntryId) {
        const i = target.eintraege.findIndex(e => e.id === overEntryId)
        if (i >= 0) insertIndex = i
      }
      target.eintraege.splice(insertIndex, 0, moved)
    }

    await persistEntryOrder(next)
  }

  const toggleErledigt = async (checklistId: string, entryId: string, erledigt: boolean) => {
    const res = await fetch(`/api/checklisten/${checklistId}/eintraege/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ erledigt }),
    })
    const j = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !j.success) {
      toast({ title: j.error || 'Speichern fehlgeschlagen', variant: 'destructive' })
      return
    }
    setData(prev =>
      prev.map(c => {
        if (c.id !== checklistId) return c
        return {
          ...c,
          kategorien: c.kategorien.map(k => ({
            ...k,
            eintraege: k.eintraege.map(e =>
              e.id === entryId ? { ...e, erledigt } : e
            ),
          })),
        }
      })
    )
  }

  const createList = async () => {
    const t = newListTitel.trim()
    if (!t) return
    const res = await fetch('/api/checklisten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titel: t }),
    })
    const j = (await res.json()) as { success?: boolean; id?: string; error?: string }
    if (!res.ok || !j.success) {
      toast({ title: j.error || 'Anlegen fehlgeschlagen', variant: 'destructive' })
      return
    }
    setNewListOpen(false)
    setNewListTitel('')
    toast({ title: 'Checkliste angelegt' })
    await load()
  }

  const confirmDeleteList = async () => {
    if (!deleteListId) return
    const res = await fetch(`/api/checklisten/${deleteListId}`, { method: 'DELETE' })
    const j = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !j.success) {
      toast({ title: j.error || 'Löschen fehlgeschlagen', variant: 'destructive' })
      return
    }
    if (detailId === deleteListId) {
      setDetailId(null)
      setEditMode(false)
    }
    setDeleteListId(null)
    toast({ title: 'Checkliste gelöscht' })
    await load()
  }

  const confirmReset = async () => {
    if (!resetListId) return
    const res = await fetch(`/api/checklisten/${resetListId}/reset`, { method: 'POST' })
    const j = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !j.success) {
      toast({ title: j.error || 'Zurücksetzen fehlgeschlagen', variant: 'destructive' })
      return
    }
    setResetListId(null)
    toast({ title: 'Alle Haken entfernt' })
    await load()
  }

  const saveEntry = async () => {
    if (!entryModal) return
    const text = entryText.trim()
    if (!text) {
      toast({ title: 'Text eingeben', variant: 'destructive' })
      return
    }
    if (entryModal.entry) {
      const res = await fetch(
        `/api/checklisten/${entryModal.checklistId}/eintraege/${entryModal.entry.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        }
      )
      const j = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !j.success) {
        toast({ title: j.error || 'Speichern fehlgeschlagen', variant: 'destructive' })
        return
      }
    } else {
      const res = await fetch(`/api/checklisten/${entryModal.checklistId}/eintraege`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategorieId: entryModal.kategorieId, text }),
      })
      const j = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !j.success) {
        toast({ title: j.error || 'Anlegen fehlgeschlagen', variant: 'destructive' })
        return
      }
    }
    setEntryModal(null)
    setEntryText('')
    await load()
  }

  const saveKategorie = async () => {
    if (!katModal) return
    const t = katTitel.trim()
    if (!t) {
      toast({ title: 'Titel eingeben', variant: 'destructive' })
      return
    }
    if (katModal.katId) {
      const res = await fetch(
        `/api/checklisten/${katModal.checklistId}/kategorien/${katModal.katId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titel: t }),
        }
      )
      const j = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !j.success) {
        toast({ title: j.error || 'Speichern fehlgeschlagen', variant: 'destructive' })
        return
      }
    } else {
      const res = await fetch(`/api/checklisten/${katModal.checklistId}/kategorien`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel: t }),
      })
      const j = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !j.success) {
        toast({ title: j.error || 'Anlegen fehlgeschlagen', variant: 'destructive' })
        return
      }
    }
    setKatModal(null)
    setKatTitel('')
    await load()
  }

  const deleteKategorieConfirmed = async () => {
    if (!deleteKat) return
    const res = await fetch(
      `/api/checklisten/${deleteKat.checklistId}/kategorien/${deleteKat.katId}`,
      { method: 'DELETE' }
    )
    const j = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !j.success) {
      toast({ title: j.error || 'Löschen fehlgeschlagen', variant: 'destructive' })
      return
    }
    setDeleteKat(null)
    toast({ title: 'Kategorie gelöscht' })
    await load()
  }

  const overviewIds = useMemo(() => sortedLists.map(c => clId(c.id)), [sortedLists])

  if (loading && data.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">Checklisten werden geladen…</div>
    )
  }

  // Detail-Ansicht
  if (detailId && activeChecklist) {
    const total = activeChecklist.kategorien.reduce((n, k) => n + k.eintraege.length, 0)
    const done = activeChecklist.kategorien.reduce(
      (n, k) => n + k.eintraege.filter(e => e.erledigt).length,
      0
    )
    const catsSorted = [...activeChecklist.kategorien].sort(
      (a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)
    )

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setDetailId(null); setEditMode(false) }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zur Übersicht
          </Button>
          <h2 className="text-lg font-semibold text-[rgb(45,79,30)] flex-1 min-w-[200px]">
            {activeChecklist.titel}
          </h2>
          {!editMode && (
            <Button variant="outline" size="sm" onClick={() => setResetListId(detailId)}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Zurücksetzen
            </Button>
          )}
          {canAccessConfig && !editMode && (
            <Button size="sm" onClick={() => setEditMode(true)}>
              Bearbeiten
            </Button>
          )}
          {canAccessConfig && editMode && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditMode(false)}>
                Fertig
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteListId(detailId)}
              >
                Liste löschen
              </Button>
            </>
          )}
        </div>

        {!editMode && (
          <p className="text-sm text-muted-foreground">
            Fortschritt: {done} von {total} erledigt
          </p>
        )}

        {editMode && canAccessConfig ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEndEditor}
          >
            <SortableContext items={allEditorSortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setKatModal({ checklistId: detailId, katId: null, titel: '' })
                    setKatTitel('')
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Kategorie hinzufügen
                </Button>
                {catsSorted.map(kat => (
                  <SortableEditorCategoryBlock
                    key={kat.id}
                    katId={kat.id}
                    titel={kat.titel}
                    onRename={() => {
                      setKatModal({ checklistId: detailId, katId: kat.id, titel: kat.titel })
                      setKatTitel(kat.titel)
                    }}
                    onDelete={() =>
                      setDeleteKat({
                        checklistId: detailId,
                        katId: kat.id,
                        titel: kat.titel,
                      })
                    }
                  >
                    <CategoryDropZone kategorieId={kat.id}>
                      {kat.eintraege.map(e => (
                        <SortableEntryRow
                          key={e.id}
                          entry={e}
                          onEdit={() => {
                            setEntryModal({
                              checklistId: detailId,
                              kategorieId: kat.id,
                              entry: e,
                            })
                            setEntryText(e.text)
                          }}
                          onDelete={async () => {
                            const res = await fetch(
                              `/api/checklisten/${detailId}/eintraege/${e.id}`,
                              { method: 'DELETE' }
                            )
                            const j = (await res.json()) as { success?: boolean; error?: string }
                            if (!res.ok || !j.success)
                              toast({
                                title: j.error || 'Löschen fehlgeschlagen',
                                variant: 'destructive',
                              })
                            else await load()
                          }}
                        />
                      ))}
                      <div className="px-3 py-2 border-t border-dashed">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[rgb(45,79,30)]"
                          onClick={() => {
                            setEntryModal({
                              checklistId: detailId,
                              kategorieId: kat.id,
                              entry: null,
                            })
                            setEntryText('')
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Eintrag
                        </Button>
                      </div>
                    </CategoryDropZone>
                  </SortableEditorCategoryBlock>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-6">
            {catsSorted.map(kat => (
              <div key={kat.id}>
                <h3 className="text-sm font-semibold text-[rgb(45,79,30)] mb-2 tracking-wide">
                  {kat.titel}
                </h3>
                <ul className="space-y-2">
                  {kat.eintraege.map(e => (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm"
                    >
                      <Checkbox
                        id={e.id}
                        checked={e.erledigt}
                        onCheckedChange={v =>
                          toggleErledigt(detailId, e.id, v === true)
                        }
                        className="mt-0.5"
                      />
                      <label htmlFor={e.id} className="text-sm leading-snug cursor-pointer flex-1">
                        {e.text}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <ConfirmDialog
          open={resetListId !== null}
          onOpenChange={o => !o && setResetListId(null)}
          title="Checkliste zurücksetzen?"
          description="Alle abgehakten Einträge werden wieder geöffnet."
          confirmLabel="Zurücksetzen"
          variant="default"
          onConfirm={confirmReset}
        />
        <ConfirmDialog
          open={deleteListId !== null}
          onOpenChange={o => !o && setDeleteListId(null)}
          title="Checkliste löschen?"
          description="Die Liste mit allen Kategorien und Einträgen wird unwiderruflich gelöscht."
          confirmLabel="Löschen"
          variant="destructive"
          onConfirm={confirmDeleteList}
        />
        <ConfirmDialog
          open={deleteKat !== null}
          onOpenChange={o => !o && setDeleteKat(null)}
          title="Kategorie löschen?"
          description={`„${deleteKat?.titel ?? ''}“ und alle zugehörigen Einträge werden gelöscht.`}
          confirmLabel="Löschen"
          variant="destructive"
          onConfirm={deleteKategorieConfirmed}
        />
        <ResponsiveModal
          open={entryModal !== null}
          onOpenChange={o => {
            if (!o) {
              setEntryModal(null)
              setEntryText('')
            }
          }}
          title={entryModal?.entry ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
        >
          <div className="space-y-3 pt-2">
            <Label htmlFor="entry-text">Text</Label>
            <Input
              id="entry-text"
              value={entryText}
              onChange={e => setEntryText(e.target.value)}
              placeholder="Beschreibung"
            />
            <Button onClick={saveEntry}>Speichern</Button>
          </div>
        </ResponsiveModal>
        <ResponsiveModal
          open={katModal !== null}
          onOpenChange={o => {
            if (!o) {
              setKatModal(null)
              setKatTitel('')
            }
          }}
          title={katModal?.katId ? 'Kategorie umbenennen' : 'Neue Kategorie'}
        >
          <div className="space-y-3 pt-2">
            <Label htmlFor="kat-titel">Titel</Label>
            <Input
              id="kat-titel"
              value={katTitel}
              onChange={e => setKatTitel(e.target.value)}
              placeholder="Kategoriename"
            />
            <Button onClick={saveKategorie}>Speichern</Button>
          </div>
        </ResponsiveModal>
      </div>
    )
  }

  // Übersicht
  return (
    <div className="space-y-4">
      {canAccessConfig && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setNewListOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Neue Checkliste
          </Button>
        </div>
      )}

      {canAccessConfig ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEndOverview}
        >
          <SortableContext items={overviewIds} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedLists.map(c => (
                <SortableChecklistCard
                  key={c.id}
                  checklist={c}
                  onOpen={() => setDetailId(c.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedLists.map(c => (
            <div key={c.id}>
              <Card
                className="cursor-pointer hover:border-[rgb(45,79,30)]/40 transition-colors"
                onClick={() => setDetailId(c.id)}
              >
                <CardHeader className="pb-2 flex flex-row items-start gap-2 space-y-0">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold text-[rgb(45,79,30)] leading-tight">
                      {c.titel}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.kategorien.reduce((n, k) => n + k.eintraege.filter(e => e.erledigt).length, 0)}/
                      {c.kategorien.reduce((n, k) => n + k.eintraege.length, 0)} erledigt
                    </p>
                  </div>
                  <ListChecks className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                </CardHeader>
              </Card>
            </div>
          ))}
        </div>
      )}

      {sortedLists.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">Keine Checklisten vorhanden.</p>
      )}

      <ResponsiveModal open={newListOpen} onOpenChange={setNewListOpen} title="Neue Checkliste">
        <div className="space-y-3 pt-2">
          <Label htmlFor="new-chk-titel">Titel</Label>
          <Input
            id="new-chk-titel"
            value={newListTitel}
            onChange={e => setNewListTitel(e.target.value)}
            placeholder="z. B. Abfahrt"
          />
          <Button onClick={createList}>Anlegen</Button>
        </div>
      </ResponsiveModal>
    </div>
  )
}
