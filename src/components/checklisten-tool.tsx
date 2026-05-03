'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { getCachedChecklisten } from '@/lib/offline-sync'
import { cacheChecklisten } from '@/lib/offline-db'

/** Checkbox wie in der Packliste (Pauschal / normales Abhaken) */
const CHECKLIST_RUNNER_CHECKBOX_CLASS =
  'h-6 w-6 min-h-6 min-w-6 rounded-md border-2 border-gray-300 data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]'

function ChecklisteRunnerEintrag({
  entry,
  checklistId,
  onToggle,
}: {
  entry: ChecklisteEintrag
  checklistId: string
  onToggle: (checklistId: string, entryId: string, erledigt: boolean) => void
}) {
  const [tickAnim, setTickAnim] = useState(false)
  const tickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (tickTimeoutRef.current != null) clearTimeout(tickTimeoutRef.current)
    }
  }, [])

  const handleChecked = (checked: boolean) => {
    if (checked) {
      if (tickTimeoutRef.current != null) clearTimeout(tickTimeoutRef.current)
      setTickAnim(true)
      tickTimeoutRef.current = setTimeout(() => {
        tickTimeoutRef.current = null
        setTickAnim(false)
      }, 360)
    }
    onToggle(checklistId, entry.id, checked)
  }

  return (
    <div
      className={cn(
        'mb-2 py-2 px-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200',
        tickAnim && 'animate-checklist-row-tick',
        entry.erledigt ? 'opacity-60' : 'hover:shadow-md'
      )}
    >
      <div className="flex items-start space-x-3">
        <div className="mt-0.5 flex-shrink-0">
          <Checkbox
            id={`chk-runner-${entry.id}`}
            checked={entry.erledigt}
            onCheckedChange={v => handleChecked(v === true)}
            className={CHECKLIST_RUNNER_CHECKBOX_CLASS}
          />
        </div>
        <label
          htmlFor={`chk-runner-${entry.id}`}
          className={cn(
            'text-sm font-medium leading-snug cursor-pointer transition-colors flex-1 min-w-0 pt-0.5',
            entry.erledigt ? 'line-through text-muted-foreground' : 'text-foreground'
          )}
        >
          {entry.text}
        </label>
      </div>
    </div>
  )
}

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

/**
 * Lädt Checklisten online und persistiert sie in IndexedDB,
 * damit die Seite auch offline weiterhin sinnvolle Daten zeigen kann.
 */
async function fetchChecklisten(): Promise<ChecklisteMitStruktur[]> {
  const res = await fetch('/api/checklisten')
  const data = (await res.json()) as { success?: boolean; data?: ChecklisteMitStruktur[]; error?: string }
  if (!res.ok || !data.success || !data.data) {
    throw new Error(data.error || 'Laden fehlgeschlagen')
  }
  // Erfolgreiche Antwort in den Offline-Cache spiegeln (best effort)
  try {
    await cacheChecklisten(data.data)
  } catch (err) {
    console.warn('Checklisten konnten nicht in IndexedDB gecached werden:', err)
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
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
            style={{ touchAction: 'none' }}
            aria-label="Checkliste sortieren"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 py-0.5">
            <CardTitle className="text-base font-semibold text-[rgb(45,79,30)] leading-tight">
              {checklist.titel}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {done}/{total} erledigt
            </p>
          </div>
          <ListChecks className="h-5 w-5 text-muted-foreground shrink-0" />
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

export type ChecklistenHeaderContext = {
  subtitle: string | null
  progress: { done: number; total: number } | null
}

export interface ChecklistenToolProps {
  /** Steuert Sticky-Header (Untertitel + Fortschritt) auf der Checklisten-Seite */
  onHeaderContextChange?: (ctx: ChecklistenHeaderContext) => void
  /** Ziel für Drei-Punkte-Menü rechts im Sticky-Header (Detailansicht) */
  headerTrailingRef?: RefObject<HTMLDivElement | null>
}

const CHECKLISTEN_PATH = '/tools/checklisten'

export function ChecklistenTool({ onHeaderContextChange, headerTrailingRef }: ChecklistenToolProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const detailId = searchParams.get('id')?.trim() || null

  const { canAccessConfig } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ChecklisteMitStruktur[]>([])
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
      // Offline-Fallback: zuletzt erfolgreich geladene Checklisten aus IndexedDB anzeigen
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      try {
        const cached = await getCachedChecklisten()
        if (cached.length > 0) {
          setData(cached)
          if (offline) {
            toast({
              title: 'Offline-Modus',
              description: 'Checklisten werden aus dem lokalen Cache angezeigt.',
            })
            return
          }
        }
      } catch (cacheErr) {
        console.warn('Cache-Lesen fehlgeschlagen:', cacheErr)
      }
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

  useEffect(() => {
    if (!detailId) setEditMode(false)
  }, [detailId])

  const openChecklist = useCallback((id: string) => {
    router.push(`${CHECKLISTEN_PATH}?id=${encodeURIComponent(id)}`, { scroll: false })
  }, [router])

  const goToChecklistenOverview = useCallback(() => {
    router.replace(CHECKLISTEN_PATH, { scroll: false })
    setEditMode(false)
  }, [router])

  useEffect(() => {
    if (loading) return
    if (detailId && !data.some(c => c.id === detailId)) {
      router.replace(CHECKLISTEN_PATH, { scroll: false })
    }
  }, [loading, detailId, data, router])

  const activeChecklist = useMemo(
    () => (detailId ? data.find(c => c.id === detailId) : null),
    [data, detailId]
  )

  useEffect(() => {
    if (!onHeaderContextChange) return
    if (!detailId) {
      onHeaderContextChange({ subtitle: null, progress: null })
      return
    }
    const c = data.find(x => x.id === detailId)
    if (!c) {
      onHeaderContextChange({ subtitle: null, progress: null })
      return
    }
    const total = c.kategorien.reduce((n, k) => n + k.eintraege.length, 0)
    const done = c.kategorien.reduce(
      (n, k) => n + k.eintraege.filter(e => e.erledigt).length,
      0
    )
    onHeaderContextChange({
      subtitle: c.titel,
      progress: total > 0 ? { done, total } : null,
    })
  }, [detailId, data, onHeaderContextChange])

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
      router.replace(CHECKLISTEN_PATH, { scroll: false })
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
    const catsSorted = [...activeChecklist.kategorien].sort(
      (a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)
    )

    const headerTrailingEl = headerTrailingRef?.current ?? null
    const detailActionsMenu =
      headerTrailingEl && !editMode ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full border-0 bg-transparent text-foreground shadow-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]/30"
              aria-label="Weitere Aktionen"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            <DropdownMenuItem className="cursor-pointer gap-2" onSelect={() => setResetListId(detailId)}>
              <RotateCcw className="h-4 w-4" />
              Zurücksetzen
            </DropdownMenuItem>
            {canAccessConfig ? (
              <>
                <DropdownMenuItem className="cursor-pointer gap-2" onSelect={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  onSelect={() => setDeleteListId(detailId)}
                >
                  <Trash2 className="h-4 w-4" />
                  Löschen
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null

    return (
      <div className="space-y-4">
        {headerTrailingEl && detailActionsMenu ? createPortal(detailActionsMenu, headerTrailingEl) : null}

        {editMode && canAccessConfig ? (
          <>
            <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-scroll-pattern rounded-lg flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToChecklistenOverview}
                className="bg-white hover:bg-neutral-50"
              >
                <ArrowLeft className="h-4 w-4 mr-1 shrink-0" />
                Zur Übersicht
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditMode(false)}>
                  Fertig
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteListId(detailId)}>
                  Liste löschen
                </Button>
              </div>
            </div>
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
          </>
        ) : (
          <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-scroll-pattern rounded-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToChecklistenOverview}
                className="bg-white hover:bg-neutral-50"
              >
                <ArrowLeft className="h-4 w-4 mr-1 shrink-0" />
                Zur Übersicht
              </Button>
            </div>
            <div className="space-y-6">
              {catsSorted.map(kat => (
                <div key={kat.id}>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    {kat.titel}
                  </h3>
                  <Card className="border-none shadow-none overflow-hidden bg-transparent">
                    <CardContent className="p-0 bg-transparent">
                      {kat.eintraege.map(e => (
                        <ChecklisteRunnerEintrag
                          key={e.id}
                          entry={e}
                          checklistId={detailId}
                          onToggle={toggleErledigt}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
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
                  onOpen={() => openChecklist(c.id)}
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
                onClick={() => openChecklist(c.id)}
              >
                <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3">
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 py-0.5">
                    <CardTitle className="text-base font-semibold text-[rgb(45,79,30)] leading-tight">
                      {c.titel}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {c.kategorien.reduce((n, k) => n + k.eintraege.filter(e => e.erledigt).length, 0)}/
                      {c.kategorien.reduce((n, k) => n + k.eintraege.length, 0)} erledigt
                    </p>
                  </div>
                  <ListChecks className="h-5 w-5 text-muted-foreground shrink-0" />
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

      {canAccessConfig && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            type="button"
            size="icon"
            onClick={() => setNewListOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
            aria-label="Neue Checkliste"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </div>
      )}
    </div>
  )
}
