'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { type Optimierung, type OptimierungPrioritaet, type OptimierungStatus, type Vacation } from '@/lib/db'
import { useToast } from '@/hooks/use-toast'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import {
  fetchAndCache,
  getCachedOptimierungen,
  getCachedVacations,
} from '@/lib/offline-sync'
import {
  cacheOptimierungen,
  cacheVacations,
  removeCachedOptimierung,
} from '@/lib/offline-db'
import { isOffline, showOfflineToast, showQueuedToast } from '@/lib/offline-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  Eye,
  EyeOff,
  ExternalLink,
  Globe2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { OptimierungEditDialog } from '@/components/optimierung-edit-dialog'
import {
  formatFaelligkeitListLine,
  formatLinkMenuLabel,
  openExternalUrl,
  OPT_CHECKBOX_CLASS,
  PrioritaetIcon,
  STATUS_LABEL,
  STATUS_LIST_ORDER,
  truncateForUndoToast,
} from '@/components/optimierung-shared'

export type OptimierungenToolProps = {
  headerTrailingRef?: RefObject<HTMLDivElement | null>
  canWrite?: boolean
}

export function OptimierungenTool({ headerTrailingRef, canWrite = true }: OptimierungenToolProps) {
  const { toast } = useToast()
  const { mutate } = useOptimisticMutation()
  const [items, setItems] = useState<Optimierung[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading, setLoading] = useState(true)

  const [filterPrio, setFilterPrio] = useState<OptimierungPrioritaet | 'alle' | 'ohne'>('alle')
  const [nurOffene, setNurOffene] = useState(true)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Optimierung | null>(null)
  const [isCreate, setIsCreate] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Optimierung | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [openLinksMenuId, setOpenLinksMenuId] = useState<string | null>(null)

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
      const [optResult, vacResult] = await Promise.all([
        fetchAndCache<Optimierung[]>(
          '/api/optimierungen',
          cacheOptimierungen,
          getCachedOptimierungen,
          { cache: 'no-store' }
        ),
        fetchAndCache<Vacation[]>(
          '/api/vacations',
          cacheVacations,
          getCachedVacations,
          { cache: 'no-store' }
        ),
      ])

      if (optResult.data) {
        setItems(optResult.data)
        if (optResult.fromCache) {
          showOfflineToast({
            description: 'Optimierungen werden aus dem lokalen Cache angezeigt.',
          })
        }
      } else {
        setItems([])
        toast({
          title: 'Laden fehlgeschlagen',
          description: 'Optimierungen konnten nicht geladen werden.',
          variant: 'destructive',
        })
      }

      if (vacResult.data) {
        setVacations(vacResult.data)
      }
    } catch (e) {
      console.error(e)
      try {
        const [cachedOpt, cachedVac] = await Promise.all([
          getCachedOptimierungen(),
          getCachedVacations(),
        ])
        if (cachedOpt.length > 0) {
          setItems(cachedOpt)
          setVacations(cachedVac)
          showOfflineToast({
            description: 'Optimierungen werden aus dem lokalen Cache angezeigt.',
          })
        } else {
          toast({
            title: 'Laden fehlgeschlagen',
            description: 'Netzwerkfehler',
            variant: 'destructive',
          })
        }
      } catch {
        toast({
          title: 'Laden fehlgeschlagen',
          description: 'Netzwerkfehler',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  useReconnectRefetch(() => {
    void load()
  })

  const persistItems = useCallback(async (next: Optimierung[]) => {
    setItems(next)
    try {
      await cacheOptimierungen(next)
    } catch (err) {
      console.warn('Optimierungen-Cache schreiben fehlgeschlagen:', err)
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
    setEditOpen(true)
  }

  const openEdit = (item: Optimierung) => {
    setIsCreate(false)
    setEditing(item)
    setEditOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const deletedId = deleteTarget.id
      const result = await mutate({
        table: 'optimierungen',
        action: 'delete',
        key: deletedId,
      })
      if (!result.ok && !result.queued) {
        toast({
          title: 'Löschen fehlgeschlagen',
          description: result.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      setDeleteTarget(null)
      if (editing?.id === deletedId) {
        setEditOpen(false)
        setEditing(null)
      }
      await persistItems(items.filter((i) => i.id !== deletedId))
      try {
        await removeCachedOptimierung(deletedId)
      } catch {
        /* ignore */
      }
      if (result.queued) showQueuedToast({ description: 'Löschen wird bei Verbindung synchronisiert.' })
      else toast({ title: 'Gelöscht' })
      if (!isOffline()) await load()
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
      const result = await mutate({
        table: 'optimierungen',
        action: 'put',
        key: id,
        payload: { status },
      })
      if (!result.ok && !result.queued) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: previousStatus } : item
          )
        )
        toast({
          title: 'Status konnte nicht gespeichert werden',
          description: result.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return false
      }
      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, status } : item
        )
        void cacheOptimierungen(next).catch(() => {})
        return next
      })
      if (result.queued) showQueuedToast()
      return true
    },
    [mutate, toast]
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
          {canWrite ? (
            <DropdownMenuItem className="cursor-pointer gap-2" onSelect={openCreate}>
              <Plus className="h-4 w-4 shrink-0" />
              Neue Optimierung
            </DropdownMenuItem>
          ) : null}
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
                            disabled={!canWrite}
                            onCheckedChange={(v) => {
                              if (!canWrite) return
                              void handleToggleErledigt(item, v === true)
                            }}
                            className={OPT_CHECKBOX_CLASS}
                            aria-label={`${item.titel} als erledigt markieren`}
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-start gap-2">
                            <Link
                              href={`/tools/optimierungen/${item.id}`}
                              className="flex min-w-0 flex-1 flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]/40"
                            >
                              <div className="flex flex-wrap items-center gap-2">
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
                                {fotoCount > 0 ? (
                                  <span
                                    className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold leading-none text-white tabular-nums"
                                    aria-label={`${fotoCount} Fotos`}
                                  >
                                    {fotoCount}
                                  </span>
                                ) : null}
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
                            </Link>
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
                            {canWrite ? (
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
                                    setDeleteTarget(item)
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            ) : null}
                          </div>
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

      {canWrite ? (
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
      ) : null}

      <OptimierungEditDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditing(null)
            setIsCreate(false)
          }
        }}
        isCreate={isCreate}
        item={editing}
        vacations={vacations}
        onSaved={async () => {
          await load()
        }}
        onDeleted={async (id) => {
          await persistItems(items.filter((i) => i.id !== id))
          try {
            await removeCachedOptimierung(id)
          } catch {
            /* ignore */
          }
          if (!isOffline()) await load()
        }}
      />

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
    </div>
  )
}
