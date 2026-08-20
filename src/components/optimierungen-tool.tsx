'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  type Optimierung,
  type OptimierungFoto,
  type OptimierungPrioritaet,
  type OptimierungStatus,
  type Vacation,
} from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { prepareCampingplatzUploadFile } from '@/lib/compress-upload-image'
import {
  FAELLIGKEIT_MODUS_LABEL,
  computeFaelligAm,
  describeFaelligkeit,
  type OptimierungFaelligkeitModus,
} from '@/lib/optimierung-faelligkeit'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { UndoToast } from '@/components/undo-toast'
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
import {
  Camera,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
  Globe2,
  Link2,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const OPT_CHECKBOX_CLASS =
  'h-6 w-6 min-h-6 min-w-6 rounded-md border-2 border-gray-300 data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]'

function truncateForUndoToast(s: string, maxLen: number): string {
  const t = s.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

function openExternalUrl(raw: string): void {
  const trimmed = raw.trim()
  if (!trimmed) return
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  window.open(href, '_blank', 'noopener,noreferrer')
}

function formatLinkMenuLabel(url: string, maxLen = 40): string {
  const t = url.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

function optimierungFotoSrc(fotoId: string): string {
  return `/api/optimierungen/fotos/${encodeURIComponent(fotoId)}/image`
}

const STATUS_LIST_ORDER: OptimierungStatus[] = [
  'in_arbeit',
  'geplant',
  'idee',
  'erledigt',
  'verworfen',
]

/** Dialog: nur aktive Workflow-Status (Erledigt/Verworfen separat) */
const STATUS_WORKFLOW_OPTIONS: { value: OptimierungStatus; label: string }[] = [
  { value: 'idee', label: 'Idee' },
  { value: 'geplant', label: 'Konkret geplant' },
  { value: 'in_arbeit', label: 'In Arbeit' },
]

const PRIO_OPTIONS: { value: OptimierungPrioritaet; label: string }[] = [
  { value: 'niedrig', label: 'Niedrig' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'hoch', label: 'Hoch' },
]

const STATUS_LABEL: Record<OptimierungStatus, string> = {
  idee: 'Idee',
  geplant: 'Konkret geplant',
  in_arbeit: 'In Arbeit',
  erledigt: 'Erledigt',
  verworfen: 'Verworfen',
}

const PRIO_LABEL: Record<OptimierungPrioritaet, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
}

const FAELLIGKEIT_OPTIONS: { value: OptimierungFaelligkeitModus; label: string }[] = [
  { value: 'naechster_urlaub', label: FAELLIGKEIT_MODUS_LABEL.naechster_urlaub },
  { value: 'saisonstart', label: FAELLIGKEIT_MODUS_LABEL.saisonstart },
  { value: 'irgendwann', label: FAELLIGKEIT_MODUS_LABEL.irgendwann },
]

type EditForm = {
  titel: string
  notiz: string
  status: OptimierungStatus
  prioritaet: OptimierungPrioritaet
  faelligkeit_modus: OptimierungFaelligkeitModus | ''
  links: string[]
}

function emptyForm(): EditForm {
  return {
    titel: '',
    notiz: '',
    status: 'idee',
    prioritaet: 'mittel',
    faelligkeit_modus: '',
    links: [''],
  }
}

function formFromItem(item: Optimierung): EditForm {
  const urls = (item.links ?? []).map((l) => l.url)
  return {
    titel: item.titel,
    notiz: item.notiz ?? '',
    status: item.status,
    prioritaet: item.prioritaet ?? 'mittel',
    faelligkeit_modus: item.faelligkeit_modus ?? '',
    links: urls.length > 0 ? urls : [''],
  }
}

function isWorkflowStatus(status: OptimierungStatus): boolean {
  return status === 'idee' || status === 'geplant' || status === 'in_arbeit'
}

function showsFaelligkeitFields(status: OptimierungStatus): boolean {
  return status !== 'idee' && status !== 'verworfen'
}

function formatFaelligkeitListLine(
  item: Optimierung,
  vacations: Vacation[]
): string | null {
  if (!item.faelligkeit_modus) return null
  const label = FAELLIGKEIT_MODUS_LABEL[item.faelligkeit_modus]
  const detail = describeFaelligkeit(
    item.faelligkeit_modus,
    item.faellig_am,
    vacations
  )
  return detail ? `${label} · ${detail}` : label
}

function SegmentedButtons<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="mt-1 flex w-full rounded-lg border border-input bg-muted/40 p-0.5"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-2 text-xs sm:text-sm font-medium transition-colors',
              selected
                ? 'bg-[rgb(45,79,30)] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function PrioritaetIcon({ prio }: { prio: OptimierungPrioritaet }) {
  if (prio === 'hoch') {
    return (
      <span
        className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-red-100 px-1.5 text-red-700 ring-1 ring-red-300/80"
        title="Priorität hoch"
        aria-label="Priorität hoch"
      >
        <ChevronsUp className="h-3.5 w-3.5" strokeWidth={2.75} />
      </span>
    )
  }
  if (prio === 'mittel') {
    return (
      <span
        className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-amber-100 px-1.5 text-amber-800"
        title="Priorität mittel"
        aria-label="Priorität mittel"
      >
        <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-slate-600"
      title="Priorität niedrig"
      aria-label="Priorität niedrig"
    >
      <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
    </span>
  )
}

export type OptimierungenToolProps = {
  headerTrailingRef?: RefObject<HTMLDivElement | null>
}

export function OptimierungenTool({ headerTrailingRef }: OptimierungenToolProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<Optimierung[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading, setLoading] = useState(true)

  const [filterPrio, setFilterPrio] = useState<OptimierungPrioritaet | 'alle' | 'ohne'>('alle')
  const [nurOffene, setNurOffene] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Optimierung | null>(null)
  const [isCreate, setIsCreate] = useState(false)
  const [form, setForm] = useState<EditForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Optimierung | null>(null)
  const [discardTarget, setDiscardTarget] = useState<Optimierung | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [openLinksMenuId, setOpenLinksMenuId] = useState<string | null>(null)

  const [editFotos, setEditFotos] = useState<OptimierungFoto[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fotoBusy, setFotoBusy] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const pendingPreviewUrls = useMemo(
    () => pendingFiles.map((file) => URL.createObjectURL(file)),
    [pendingFiles]
  )
  useEffect(() => {
    return () => {
      for (const url of pendingPreviewUrls) URL.revokeObjectURL(url)
    }
  }, [pendingPreviewUrls])

  const [undoToast, setUndoToast] = useState<{
    visible: boolean
    message: string
    action: () => void
  } | null>(null)

  const [headerMenuMounted, setHeaderMenuMounted] = useState(false)
  useEffect(() => {
    setHeaderMenuMounted(true)
  }, [])

  const load = useCallback(async () => {
    try {
      const [optRes, vacRes] = await Promise.all([
        fetch('/api/optimierungen'),
        fetch('/api/vacations'),
      ])
      const optJson = (await optRes.json()) as ApiResponse<Optimierung[]>
      const vacJson = (await vacRes.json()) as ApiResponse<Vacation[]>
      if (optJson.success && optJson.data) {
        setItems(optJson.data)
      } else {
        toast({
          title: 'Laden fehlgeschlagen',
          description: optJson.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
      }
      if (vacJson.success && vacJson.data) {
        setVacations(vacJson.data)
      }
    } catch (e) {
      console.error(e)
      toast({
        title: 'Laden fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const loadFotos = useCallback(async (optimierungId: string) => {
    try {
      const res = await fetch(`/api/optimierungen/${optimierungId}/fotos`)
      const json = (await res.json()) as ApiResponse<OptimierungFoto[]>
      if (json.success && json.data) setEditFotos(json.data)
      else setEditFotos([])
    } catch {
      setEditFotos([])
    }
  }, [])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (nurOffene && (item.status === 'erledigt' || item.status === 'verworfen')) {
        return false
      }
      if (filterPrio === 'ohne' && item.prioritaet != null) return false
      if (
        filterPrio !== 'alle' &&
        filterPrio !== 'ohne' &&
        item.prioritaet !== filterPrio
      ) {
        return false
      }
      return true
    })
  }, [items, nurOffene, filterPrio])

  const grouped = useMemo(() => {
    const map = new Map<OptimierungStatus, Optimierung[]>()
    for (const s of STATUS_LIST_ORDER) map.set(s, [])
    for (const item of filtered) {
      map.get(item.status)?.push(item)
    }
    return STATUS_LIST_ORDER.map((status) => ({
      status,
      items: map.get(status) || [],
    })).filter((g) => g.items.length > 0)
  }, [filtered])

  const openCreate = () => {
    setIsCreate(true)
    setEditing(null)
    setForm(emptyForm())
    setEditFotos([])
    setPendingFiles([])
    setEditOpen(true)
  }

  const openEdit = (item: Optimierung) => {
    setIsCreate(false)
    setEditing(item)
    setForm(formFromItem(item))
    setPendingFiles([])
    setEditOpen(true)
    void loadFotos(item.id)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setEditing(null)
    setIsCreate(false)
    setEditFotos([])
    setPendingFiles([])
  }

  const uploadPendingFiles = async (optimierungId: string, files: File[]) => {
    for (const file of files) {
      const compressed = await prepareCampingplatzUploadFile(file)
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await fetch(`/api/optimierungen/${optimierungId}/fotos`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Foto-Upload fehlgeschlagen')
      }
    }
  }

  const handleSave = async () => {
    if (saving) return
    if (!isCreate && !editing) return
    const titel = form.titel.trim()
    if (!titel) {
      toast({ title: 'Titel erforderlich', variant: 'destructive' })
      return
    }

    const links = form.links.map((u) => u.trim()).filter(Boolean)
    const showFaelligkeit = showsFaelligkeitFields(form.status)
    const payload = {
      titel,
      notiz: form.notiz.trim() || null,
      status: form.status,
      prioritaet: form.prioritaet,
      faelligkeit_modus: showFaelligkeit
        ? form.faelligkeit_modus || null
        : null,
      links,
    }

    setSaving(true)
    try {
      let newId: string | null = null
      if (isCreate) {
        const res = await fetch('/api/optimierungen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as ApiResponse<unknown> & { id?: string }
        if (!res.ok || !json.success || !json.id) {
          toast({
            title: 'Anlegen fehlgeschlagen',
            description: json.error || 'Unbekannter Fehler',
            variant: 'destructive',
          })
          return
        }
        newId = json.id
      } else {
        const res = await fetch(`/api/optimierungen/${editing!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json()) as ApiResponse<unknown>
        if (!res.ok || !json.success) {
          toast({
            title: 'Speichern fehlgeschlagen',
            description: json.error || 'Unbekannter Fehler',
            variant: 'destructive',
          })
          return
        }
        newId = editing!.id
      }

      if (pendingFiles.length > 0 && newId) {
        try {
          await uploadPendingFiles(newId, pendingFiles)
        } catch (e) {
          console.error(e)
          toast({
            title: 'Eintrag gespeichert, Foto-Upload fehlgeschlagen',
            description: e instanceof Error ? e.message : 'Unbekannter Fehler',
            variant: 'destructive',
          })
          closeEdit()
          await load()
          return
        }
      }

      closeEdit()
      await load()
      toast({ title: isCreate ? 'Optimierung angelegt' : 'Gespeichert' })
    } catch (e) {
      console.error(e)
      toast({
        title: isCreate ? 'Anlegen fehlgeschlagen' : 'Speichern fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/optimierungen/${deleteTarget.id}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !json.success) {
        toast({
          title: 'Löschen fehlgeschlagen',
          description: json.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      const deletedId = deleteTarget.id
      setDeleteTarget(null)
      if (editing?.id === deletedId) closeEdit()
      await load()
      toast({ title: 'Gelöscht' })
    } catch (e) {
      console.error(e)
      toast({
        title: 'Löschen fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const patchStatus = useCallback(
    async (id: string, status: OptimierungStatus, previousStatus: OptimierungStatus) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      )
      try {
        const res = await fetch(`/api/optimierungen/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const json = (await res.json()) as ApiResponse<unknown>
        if (!res.ok || !json.success) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status: previousStatus } : item
            )
          )
          toast({
            title: 'Status konnte nicht gespeichert werden',
            description: json.error || 'Unbekannter Fehler',
            variant: 'destructive',
          })
          return false
        }
        return true
      } catch (e) {
        console.error(e)
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: previousStatus } : item
          )
        )
        toast({
          title: 'Status konnte nicht gespeichert werden',
          description: 'Netzwerkfehler',
          variant: 'destructive',
        })
        return false
      }
    },
    [toast]
  )

  const handleToggleErledigt = useCallback(
    async (item: Optimierung, checked: boolean) => {
      if (checked) {
        if (item.status === 'erledigt') return
        const previousStatus = item.status
        const ok = await patchStatus(item.id, 'erledigt', previousStatus)
        if (!ok) return
        const textPart = truncateForUndoToast(item.titel, 72)
        setUndoToast({
          visible: true,
          message: `„${textPart}“ erledigt`,
          action: () => {
            void patchStatus(item.id, previousStatus, 'erledigt')
          },
        })
        return
      }

      if (item.status !== 'erledigt') return
      await patchStatus(item.id, 'idee', 'erledigt')
    },
    [patchStatus]
  )

  const handleDiscard = async () => {
    if (!discardTarget) return
    setDiscarding(true)
    try {
      const res = await fetch(`/api/optimierungen/${discardTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'verworfen' }),
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !json.success) {
        toast({
          title: 'Verwerfen fehlgeschlagen',
          description: json.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      setDiscardTarget(null)
      closeEdit()
      await load()
      toast({ title: 'Als verworfen markiert' })
    } catch (e) {
      console.error(e)
      toast({
        title: 'Verwerfen fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setDiscarding(false)
    }
  }

  const requestDelete = (item: Optimierung) => {
    setDeleteTarget(item)
  }

  const requestDiscard = (item: Optimierung) => {
    setDiscardTarget(item)
  }

  const onPickFiles = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'gallery' | 'camera'
  ) => {
    const raw = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (raw.length === 0) return

    setFotoBusy(true)
    try {
      const compressed = await Promise.all(raw.map((f) => prepareCampingplatzUploadFile(f)))
      if (isCreate || !editing) {
        setPendingFiles((prev) => [...prev, ...compressed])
        return
      }
      await uploadPendingFiles(editing.id, compressed)
      await loadFotos(editing.id)
      await load()
      toast({
        title: compressed.length === 1 ? 'Foto hinzugefügt' : `${compressed.length} Fotos hinzugefügt`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Foto-Upload fehlgeschlagen',
        description: err instanceof Error ? err.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setFotoBusy(false)
      void mode
    }
  }

  const deleteFoto = async (fotoId: string) => {
    if (!editing) return
    setFotoBusy(true)
    try {
      const res = await fetch(`/api/optimierungen/${editing.id}/fotos/${fotoId}`, {
        method: 'DELETE',
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !json.success) {
        toast({
          title: 'Foto konnte nicht gelöscht werden',
          description: json.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      setEditFotos((prev) => prev.filter((f) => f.id !== fotoId))
      await load()
    } catch (e) {
      console.error(e)
      toast({
        title: 'Foto konnte nicht gelöscht werden',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setFotoBusy(false)
    }
  }

  const headerTrailingEl = headerMenuMounted ? headerTrailingRef?.current ?? null : null
  const headerActionsMenu =
    headerTrailingEl ? (
      <DropdownMenu modal={false}>
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
        <DropdownMenuContent align="end" className="z-40 min-w-[12rem]">
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onSelect={() => setNurOffene((v) => !v)}
          >
            {nurOffene ? (
              <>
                <Eye className="h-4 w-4 shrink-0" />
                Erledigte / Verworfene zeigen
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 shrink-0" />
                Nur offene anzeigen
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer gap-2" onSelect={openCreate}>
            <Plus className="h-4 w-4 shrink-0" />
            Neue Optimierung
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  return (
    <div className="flex flex-col gap-4 pt-4">
      {headerTrailingEl && headerActionsMenu
        ? createPortal(headerActionsMenu, headerTrailingEl)
        : null}

      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={filterPrio}
          onValueChange={(v) => setFilterPrio(v as OptimierungPrioritaet | 'alle' | 'ohne')}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Prioritäten</SelectItem>
            <SelectItem value="hoch">Hoch</SelectItem>
            <SelectItem value="mittel">Mittel</SelectItem>
            <SelectItem value="niedrig">Niedrig</SelectItem>
            <SelectItem value="ohne">Ohne Priorität</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Wird geladen…</p>
      ) : grouped.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Noch keine Einträge. Mit dem Plus-Button unten rechts eine Idee erfassen.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(({ status, items: groupItems }) => (
            <div key={status}>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                {STATUS_LABEL[status]}
              </h3>
              <ul className="flex flex-col gap-2">
                {groupItems.map((item) => {
                  const faelligLine = formatFaelligkeitListLine(item, vacations)
                  const isErledigt = item.status === 'erledigt'
                  const linkCount = item.links?.length ?? 0
                  const fotoCount = item.foto_count ?? 0
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'py-2 px-3 bg-card rounded-xl border border-subtle shadow-sm overflow-hidden transition-all duration-200',
                        isErledigt ? 'opacity-60' : 'hover:shadow-md'
                      )}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                          <Checkbox
                            id={`opt-check-${item.id}`}
                            checked={isErledigt}
                            onCheckedChange={(v) => {
                              void handleToggleErledigt(item, v === true)
                            }}
                            className={OPT_CHECKBOX_CLASS}
                            aria-label={`${item.titel} als erledigt markieren`}
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'text-sm font-medium leading-none break-words',
                                  isErledigt
                                    ? 'line-through text-muted-foreground'
                                    : 'text-foreground'
                                )}
                              >
                                {item.titel}
                              </span>
                              {item.prioritaet ? (
                                <PrioritaetIcon prio={item.prioritaet} />
                              ) : (
                                <PrioritaetIcon prio="mittel" />
                              )}
                              {linkCount > 0 ? (
                                <DropdownMenu
                                  open={openLinksMenuId === item.id}
                                  onOpenChange={(o) =>
                                    setOpenLinksMenuId(o ? item.id : null)
                                  }
                                >
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-slate-700 hover:bg-slate-200 transition-colors"
                                      title={`${linkCount} Link${linkCount === 1 ? '' : 's'}`}
                                      aria-label={`${linkCount} Links öffnen`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Globe2 className="h-3 w-3" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="max-w-[min(90vw,20rem)]">
                                    {(item.links ?? []).map((link) => (
                                      <DropdownMenuItem
                                        key={link.id}
                                        onSelect={() => {
                                          setOpenLinksMenuId(null)
                                          openExternalUrl(link.url)
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{formatLinkMenuLabel(link.url)}</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                              {fotoCount > 0 ? (
                                <span
                                  className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold leading-none text-white tabular-nums"
                                  aria-label={`${fotoCount} Fotos`}
                                >
                                  {fotoCount}
                                </span>
                              ) : null}
                            </div>
                            <DropdownMenu
                              open={openMenuId === item.id}
                              onOpenChange={(o) => setOpenMenuId(o ? item.id : null)}
                            >
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0 -mt-1"
                                  aria-label="Aktionen"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setOpenMenuId(null)
                                    openEdit(item)
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setOpenMenuId(null)
                                    requestDelete(item)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {faelligLine ? (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {faelligLine}
                            </p>
                          ) : null}
                          {item.notiz ? (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {item.notiz}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="icon"
          onClick={openCreate}
          aria-label="Neue Optimierung"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>

      <ResponsiveModal
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEdit()
          else setEditOpen(true)
        }}
        title={isCreate ? 'Neue Optimierung' : 'Optimierung bearbeiten'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="opt-titel">Titel</Label>
            <Input
              id="opt-titel"
              className="mt-1"
              value={form.titel}
              onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
              autoFocus={isCreate}
            />
          </div>
          <div>
            <Label htmlFor="opt-notiz">Notiz</Label>
            <Textarea
              id="opt-notiz"
              className="mt-1 min-h-[80px]"
              value={form.notiz}
              onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Status</Label>
            {!isCreate && !isWorkflowStatus(form.status) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Aktuell: {STATUS_LABEL[form.status]}. Zum Wiederöffnen einen Status wählen.
              </p>
            ) : null}
            <SegmentedButtons
              ariaLabel="Status"
              value={isWorkflowStatus(form.status) ? form.status : ''}
              options={STATUS_WORKFLOW_OPTIONS}
              onChange={(v) => {
                setForm((f) => ({
                  ...f,
                  status: v,
                  ...(v === 'idee' ? { faelligkeit_modus: '' } : {}),
                }))
              }}
            />
          </div>
          <div>
            <Label>Priorität</Label>
            <SegmentedButtons
              ariaLabel="Priorität"
              value={form.prioritaet}
              options={PRIO_OPTIONS}
              onChange={(v) => setForm((f) => ({ ...f, prioritaet: v }))}
            />
          </div>

          {showsFaelligkeitFields(form.status) ? (
            <div>
              <Label>Fälligkeit</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FAELLIGKEIT_OPTIONS.map((opt) => {
                  const selected = form.faelligkeit_modus === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          faelligkeit_modus: selected ? '' : opt.value,
                        }))
                      }
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        selected
                          ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)] text-white'
                          : 'border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {form.faelligkeit_modus ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {(() => {
                    const modus = form.faelligkeit_modus
                    // Saisonstart: Bezug = Setzzeitpunkt. Unverändert = gespeicherter Bezug,
                    // neu gewählt = heute (wie beim Speichern).
                    const bezugYmd =
                      modus === 'saisonstart'
                        ? !isCreate &&
                          editing?.faelligkeit_modus === 'saisonstart' &&
                          editing.faelligkeit_bezug_am &&
                          form.faelligkeit_modus === editing.faelligkeit_modus
                          ? editing.faelligkeit_bezug_am
                          : undefined
                        : undefined
                    const faelligAm = computeFaelligAm(modus, vacations, {
                      bezugYmd,
                    })
                    return describeFaelligkeit(modus, faelligAm, vacations)
                  })()}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Optional — für spätere Erinnerungen ein Chip wählen.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="mb-0">Anhänge & Links</Label>
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              multiple
              className="hidden"
              onChange={(e) => void onPickFiles(e, 'gallery')}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onPickFiles(e, 'camera')}
            />

            <div className="grid grid-cols-3 gap-2">
              {editFotos.map((f) => (
                <div
                  key={f.id}
                  className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={optimierungFotoSrc(f.id)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    disabled={fotoBusy || isCreate}
                    onClick={() => void deleteFoto(f.id)}
                    aria-label="Foto löschen"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-red-600 text-white shadow-sm disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {pendingFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingPreviewUrls[i]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    aria-label="Ausstehendes Foto entfernen"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-red-600 text-white shadow-sm"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={fotoBusy || saving}
                    aria-label="Foto hinzufügen"
                    className={cn(
                      'aspect-square rounded-lg border border-dashed border-input',
                      'bg-muted/30 text-muted-foreground',
                      'flex flex-col items-center justify-center gap-1 px-2',
                      'hover:bg-muted/50 hover:text-foreground transition-colors',
                      'disabled:opacity-50 disabled:pointer-events-none'
                    )}
                  >
                    <Plus className="h-6 w-6" strokeWidth={2} />
                    <span className="text-[10px] font-medium leading-tight text-center">
                      Foto hinzufügen
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    disabled={fotoBusy || saving}
                    onSelect={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Foto aufnehmen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={fotoBusy || saving}
                    onSelect={() => galleryInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Aus Galerie wählen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isCreate ? (
              <p className="text-xs text-muted-foreground">
                Fotos werden nach dem Anlegen hochgeladen.
              </p>
            ) : null}

            <div className="space-y-1.5 pt-1">
              {form.links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    value={link}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.links]
                        next[idx] = e.target.value
                        return { ...f, links: next }
                      })
                    }
                    placeholder="https://…"
                    className="h-9"
                  />
                  <button
                    type="button"
                    aria-label="Link entfernen"
                    onClick={() =>
                      setForm((f) => {
                        const next = f.links.filter((_, i) => i !== idx)
                        return { ...f, links: next.length > 0 ? next : [''] }
                      })
                    }
                    className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, links: [...f.links, ''] }))}
                className="inline-flex items-center gap-1 pt-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Link hinzufügen
              </button>
            </div>
          </div>

          <div
            className={cn(
              'flex flex-col-reverse sm:flex-row gap-2 pt-2',
              isCreate ? 'sm:justify-end' : 'sm:justify-between'
            )}
          >
            {!isCreate && editing ? (
              <div className="flex flex-wrap gap-2">
                {editing.status !== 'verworfen' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => requestDiscard(editing)}
                    disabled={saving || discarding}
                  >
                    Verwerfen
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => requestDelete(editing)}
                  disabled={saving}
                >
                  Löschen
                </Button>
              </div>
            ) : null}
            <div className="flex gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={closeEdit} disabled={saving}>
                Abbrechen
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving || fotoBusy}>
                {saving ? 'Speichern…' : isCreate ? 'Anlegen' : 'Speichern'}
              </Button>
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {undoToast ? (
        <UndoToast
          isVisible={undoToast.visible}
          message={undoToast.message}
          onUndo={undoToast.action}
          onDismiss={() => setUndoToast(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Optimierung löschen?"
        description={
          deleteTarget
            ? `„${deleteTarget.titel}“ wird unwiderruflich gelöscht.`
            : 'Eintrag wird unwiderruflich gelöscht.'
        }
        confirmLabel="Löschen"
        onConfirm={handleDelete}
        isLoading={deleting}
      />

      <ConfirmDialog
        open={discardTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDiscardTarget(null)
        }}
        title="Optimierung verwerfen?"
        description={
          discardTarget
            ? `„${discardTarget.titel}“ wird als verworfen markiert und aus den offenen Listen ausgeblendet.`
            : 'Eintrag wird als verworfen markiert.'
        }
        confirmLabel="Verwerfen"
        variant="default"
        onConfirm={handleDiscard}
        isLoading={discarding}
      />
    </div>
  )
}
