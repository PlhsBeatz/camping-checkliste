'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, ExternalLink, Menu, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import type { ApiResponse } from '@/lib/api-types'
import type { Optimierung, OptimierungFoto, OptimierungStatus, Vacation } from '@/lib/db'
import {
  fetchAndCache,
  getCachedOptimierungen,
  getCachedVacations,
} from '@/lib/offline-sync'
import {
  cacheOptimierung,
  cacheOptimierungen,
  cacheVacations,
  removeCachedOptimierung,
} from '@/lib/offline-db'
import { showOfflineToast, showQueuedToast } from '@/lib/offline-toast'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { useToast } from '@/hooks/use-toast'
import { OptimierungEditDialog } from '@/components/optimierung-edit-dialog'
import { PhotoLightbox } from '@/components/photo-lightbox'
import {
  formatFaelligkeitListLine,
  formatLinkMenuLabel,
  openExternalUrl,
  optimierungFotoSrc,
  PrioritaetIcon,
  PRIO_LABEL,
  STATUS_LABEL,
} from '@/components/optimierung-shared'

function StatusHeader({ item }: { item: Optimierung }) {
  const isClosed = item.status === 'erledigt' || item.status === 'verworfen'
  return (
    <div
      className={cn(
        'rounded-t-lg px-4 py-2.5 text-center md:py-4',
        isClosed
          ? 'bg-[hsl(103,32%,88%)] text-brand-heading dark:bg-green-950/50 dark:text-brand-heading'
          : 'bg-[rgb(45,79,30)] text-white'
      )}
    >
      <p className="text-lg font-bold tracking-tight md:text-2xl">{STATUS_LABEL[item.status]}</p>
      {item.prioritaet ? (
        <p
          className={cn(
            'mt-0.5 text-xs md:text-sm',
            isClosed ? 'opacity-80' : 'text-white/85'
          )}
        >
          Priorität {PRIO_LABEL[item.prioritaet]}
        </p>
      ) : null}
    </div>
  )
}

function statusSubtitle(status: OptimierungStatus | undefined): string {
  if (!status) return 'Details'
  return STATUS_LABEL[status]
}

export default function OptimierungDetailPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const router = useRouter()
  const { toast } = useToast()
  const { mutate } = useOptimisticMutation()
  const { canReadOptimierung, canWriteOptimierung, loading: authLoading } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [item, setItem] = useState<Optimierung | null>(null)
  const [fotos, setFotos] = useState<OptimierungFoto[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!canReadOptimierung) {
      router.replace('/')
    }
  }, [authLoading, canReadOptimierung, router])

  useEffect(() => {
    if (showNavSidebar) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNavSidebar])

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [optRes, vacResult, fotoRes] = await Promise.all([
        fetch(`/api/optimierungen/${encodeURIComponent(id)}`, { cache: 'no-store' }),
        fetchAndCache<Vacation[]>(
          '/api/vacations',
          cacheVacations,
          getCachedVacations,
          { cache: 'no-store' }
        ),
        fetch(`/api/optimierungen/${encodeURIComponent(id)}/fotos`, { cache: 'no-store' }),
      ])

      const optJson = (await optRes.json()) as ApiResponse<Optimierung>
      if (optRes.ok && optJson.success && optJson.data) {
        setItem(optJson.data)
        setNotFound(false)
        try {
          await cacheOptimierung(optJson.data)
        } catch {
          /* ignore */
        }
      } else {
        const cached = await getCachedOptimierungen()
        const hit = cached.find((o) => o.id === id) ?? null
        if (hit) {
          setItem(hit)
          setNotFound(false)
          showOfflineToast({
            description: 'Optimierung wird aus dem lokalen Cache angezeigt.',
          })
        } else {
          setItem(null)
          setNotFound(true)
        }
      }

      if (vacResult.data) setVacations(vacResult.data)

      const fotoJson = (await fotoRes.json().catch(() => ({}))) as ApiResponse<OptimierungFoto[]>
      if (fotoRes.ok && fotoJson.success && fotoJson.data) {
        setFotos(fotoJson.data)
      } else {
        setFotos([])
      }
    } catch (e) {
      console.error(e)
      try {
        const cached = await getCachedOptimierungen()
        const hit = cached.find((o) => o.id === id) ?? null
        if (hit) {
          setItem(hit)
          setNotFound(false)
          showOfflineToast({
            description: 'Optimierung wird aus dem lokalen Cache angezeigt.',
          })
        } else {
          setNotFound(true)
        }
        setVacations(await getCachedVacations())
      } catch {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useReconnectRefetch(() => {
    void load()
  })

  const handleDelete = async () => {
    if (!item) return
    setDeleteBusy(true)
    try {
      const result = await mutate({
        table: 'optimierungen',
        action: 'delete',
        key: item.id,
      })
      if (!result.ok && !result.queued) {
        toast({
          title: 'Löschen fehlgeschlagen',
          description: result.error || 'Unbekannter Fehler',
          variant: 'destructive',
        })
        return
      }
      try {
        const cached = await getCachedOptimierungen()
        await cacheOptimierungen(cached.filter((o) => o.id !== item.id))
        await removeCachedOptimierung(item.id)
      } catch {
        /* ignore */
      }
      if (result.queued) {
        showQueuedToast({ description: 'Löschen wird bei Verbindung synchronisiert.' })
      }
      router.push('/tools/optimierungen')
    } catch (e) {
      console.error(e)
      toast({
        title: 'Löschen fehlgeschlagen',
        description: 'Netzwerkfehler',
        variant: 'destructive',
      })
    } finally {
      setDeleteBusy(false)
      setShowDeleteConfirm(false)
    }
  }

  if (!id) return null

  const faelligLine = item ? formatFaelligkeitListLine(item, vacations) : null
  const links = item?.links ?? []
  const subtitle = item ? statusSubtitle(item.status) : '—'
  const showContentLoading = loading || authLoading || !canReadOptimierung

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 transition-all duration-300 min-w-0', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-20 shrink-0 flex items-center justify-between gap-3 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden flex-shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-brand-heading truncate">
                  {item?.titel ?? 'Optimierung'}
                </h1>
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              </div>
            </div>
            {canWriteOptimierung && item ? (
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
                <DropdownMenuContent align="end" className="z-30 min-w-[10rem]">
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          {showContentLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">Laden…</div>
          ) : notFound || !item ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
              Eintrag nicht gefunden.{' '}
              <Link href="/tools/optimierungen" className="underline">
                Zurück zur Liste
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden flex-wrap gap-2 md:flex">
                <Button variant="outline" size="sm" className="bg-card hover:bg-muted" asChild>
                  <Link
                    href="/tools/optimierungen"
                    className="inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    Zur Liste
                  </Link>
                </Button>
              </div>

              <Card className="overflow-hidden rounded-lg border shadow-sm bg-card">
                <StatusHeader item={item} />
                <CardContent className="space-y-6 p-4 pt-4 md:p-6 md:pt-6">
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-brand-heading">Details</h2>
                    <dl className="space-y-2 text-sm">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <dt className="text-muted-foreground shrink-0">Status:</dt>
                        <dd>{STATUS_LABEL[item.status]}</dd>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2">
                        <dt className="text-muted-foreground shrink-0">Priorität:</dt>
                        <dd className="inline-flex items-center gap-1.5">
                          <PrioritaetIcon prio={item.prioritaet ?? 'mittel'} />
                          {item.prioritaet ? PRIO_LABEL[item.prioritaet] : 'Mittel'}
                        </dd>
                      </div>
                      {faelligLine ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-muted-foreground shrink-0">Fälligkeit:</dt>
                          <dd>{faelligLine}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  {item.notiz ? (
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold text-brand-heading">Notiz</h2>
                      <p className="text-sm whitespace-pre-wrap">{item.notiz}</p>
                    </section>
                  ) : null}

                  {links.length > 0 ? (
                    <section className="space-y-3">
                      <h2 className="text-sm font-semibold text-brand-heading">Links</h2>
                      <ul className="flex flex-col gap-2">
                        {links.map((link) => (
                          <li key={link.id}>
                            <button
                              type="button"
                              onClick={() => openExternalUrl(link.url)}
                              className="inline-flex max-w-full items-center gap-2 text-sm text-brand-heading hover:underline"
                            >
                              <ExternalLink className="h-4 w-4 shrink-0" />
                              <span className="truncate">{formatLinkMenuLabel(link.url, 72)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-brand-heading">Fotos</h2>
                    {fotos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Keine Fotos gespeichert.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {fotos.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted text-left outline-none ring-offset-2 transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]"
                            onClick={() => setLightboxId(f.id)}
                            aria-label="Foto groß anzeigen"
                          >
                            <Image
                              src={optimierungFotoSrc(f.id)}
                              alt=""
                              width={800}
                              height={600}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <PhotoLightbox
        fotos={fotos}
        openId={lightboxId}
        onOpenIdChange={setLightboxId}
        imageSrc={optimierungFotoSrc}
      />

      <OptimierungEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        isCreate={false}
        item={item}
        vacations={vacations}
        onSaved={async () => {
          await load()
        }}
        onDeleted={async (deletedId) => {
          try {
            const cached = await getCachedOptimierungen()
            await cacheOptimierungen(cached.filter((o) => o.id !== deletedId))
          } catch {
            /* ignore */
          }
          router.push('/tools/optimierungen')
        }}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Optimierung löschen?"
        description={
          item
            ? `„${item.titel}“ wird unwiderruflich gelöscht.`
            : 'Eintrag wird unwiderruflich gelöscht.'
        }
        confirmLabel="Löschen"
        onConfirm={handleDelete}
        isLoading={deleteBusy}
      />
    </div>
  )
}
