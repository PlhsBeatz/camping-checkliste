'use client'

import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Plus, Menu } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz, type CampingplatzFoto } from '@/lib/db'
import { cn } from '@/lib/utils'
import { CampingplaetzeTable } from '@/components/campingplaetze-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CampingplatzEditModal } from '@/components/campingplatz-edit-modal'
import { getCachedCampingplaetze } from '@/lib/offline-sync'
import { cacheCampingplaetze, cacheCampingplatz } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

function CampingplaetzePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canAccessConfig } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [items, setItems] = useState<Campingplatz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<Campingplatz | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campingplatz | null>(null)
  const [archivePrompt, setArchivePrompt] = useState<Campingplatz | null>(null)

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

  const load = async () => {
    try {
      const res = await fetch('/api/campingplaetze')
      const data = (await res.json()) as ApiResponse<Campingplatz[]>
      if (data.success && data.data) {
        setItems(data.data)
        try {
          await cacheCampingplaetze(data.data)
        } catch (e) {
          console.warn('cacheCampingplaetze failed:', e)
        }
      }
    } catch (error) {
      console.error('Failed to fetch campingplaetze:', error)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedCampingplaetze()
        if (cached.length > 0) setItems(cached)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Bei Reconnect: Liste erneut laden
  useReconnectRefetch(load)

  const bearbeitenId = searchParams.get('bearbeiten')

  const refreshCampingplatzInList = async (id: string) => {
    try {
      const r = await fetch(`/api/campingplaetze/${id}`)
      const d = (await r.json()) as ApiResponse<{ campingplatz: Campingplatz; fotos: CampingplatzFoto[] }>
      if (d.success && d.data?.campingplatz) {
        const cp = d.data.campingplatz
        setItems((prev) => {
          const o = prev.filter((c) => c.id !== id)
          return [...o, cp].sort((a, b) => a.name.localeCompare(b.name))
        })
        try {
          await cacheCampingplatz(cp)
        } catch (e) {
          console.warn('cacheCampingplatz failed:', e)
        }
      }
    } catch {
      /* ignore */
    }
  }

  const handleEdit = (item: Campingplatz) => {
    setEditTarget(item)
    setShowDialog(true)
  }

  useEffect(() => {
    if (!bearbeitenId || isLoading || items.length === 0 || showDialog) return
    const item = items.find((x) => x.id === bearbeitenId)
    if (item) {
      handleEdit(item)
      router.replace('/campingplaetze', { scroll: false })
    } else {
      router.replace('/campingplaetze', { scroll: false })
    }
    // handleEdit bewusst ausgelassen: einmaliges Öffnen per ?bearbeiten=
  }, [bearbeitenId, isLoading, items, showDialog, router])

  const handleAdd = () => {
    setEditTarget(null)
    setShowDialog(true)
  }

  const handleDeleteOrArchive = (item: Campingplatz) => {
    setDeleteTarget(item)
  }

  const executeDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campingplaetze?id=${target.id}`, {
        method: 'DELETE',
      })
      if (res.status === 409) {
        const data = (await res.json()) as { requireArchive?: boolean; error?: string }
        if (data.requireArchive) {
          setArchivePrompt(target)
        } else {
          alert(data.error ?? 'Campingplatz kann nicht gelöscht werden.')
        }
      } else {
        const data = (await res.json()) as { success?: boolean; error?: string; archived?: boolean }
        if (!data.success) {
          alert('Fehler beim Löschen des Campingplatzes: ' + (data.error ?? 'Unbekannt'))
        } else {
          if (data.archived) {
            setItems((prev) =>
              prev.map((c) =>
                c.id === target.id ? { ...c, is_archived: true } : c
              )
            )
          } else {
            setItems((prev) => prev.filter((c) => c.id !== target.id))
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete campingplatz:', error)
      alert('Fehler beim Löschen des Campingplatzes.')
    } finally {
      setIsLoading(false)
      setDeleteTarget(null)
    }
  }

  const executeArchive = async () => {
    if (!archivePrompt) return
    const target = archivePrompt
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/campingplaetze?id=${target.id}&forceArchive=true`,
        {
          method: 'DELETE',
        }
      )
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!data.success) {
        alert('Fehler beim Archivieren des Campingplatzes: ' + (data.error ?? 'Unbekannt'))
      } else {
        setItems((prev) =>
          prev.map((c) => (c.id === target.id ? { ...c, is_archived: true } : c))
        )
      }
    } catch (error) {
      console.error('Failed to archive campingplatz:', error)
      alert('Fehler beim Archivieren des Campingplatzes.')
    } finally {
      setIsLoading(false)
      setArchivePrompt(null)
    }
  }

  return (
    <div className="min-h-screen flex">
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300',
          'lg:ml-[280px]',
          'max-md:h-dvh max-md:min-h-dvh'
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6">
          <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                  Campingplätze
                </h1>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 min-w-0 mt-4 md:mt-6 overflow-y-auto max-md:overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
                <p className="text-muted-foreground animate-pulse">
                  Campingplätze werden geladen...
                </p>
              </div>
            ) : (
              <CampingplaetzeTable
                items={items}
                onEdit={handleEdit}
                onDelete={handleDeleteOrArchive}
                onRowClick={(item) => router.push(`/campingplaetze/${item.id}`)}
              />
            )}
          </div>

          {canAccessConfig && (
            <div className="fixed bottom-6 right-6 z-30">
              <Button
                size="icon"
                onClick={handleAdd}
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <CampingplatzEditModal
        open={showDialog}
        onOpenChange={(next) => {
          if (!next) {
            setEditTarget(null)
            setShowDialog(false)
          } else {
            setShowDialog(true)
          }
        }}
        initialCampingplatz={editTarget}
        onSaved={(saved) => {
          setItems((prev) => {
            const others = prev.filter((c) => c.id !== saved.id)
            const prevMatch = prev.find((c) => c.id === saved.id)
            const merged: Campingplatz = {
              ...saved,
              urlaube_zuordnungen:
                saved.urlaube_zuordnungen ?? prevMatch?.urlaube_zuordnungen ?? 0,
            }
            return [...others, merged].sort((a, b) => a.name.localeCompare(b.name))
          })
        }}
        onRefreshCampingplatz={refreshCampingplatzInList}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Campingplatz löschen"
        description="Möchten Sie diesen Campingplatz wirklich löschen? Falls er Urlaubsreisen zugeordnet ist, werden Sie ggf. zum Archivieren aufgefordert."
        onConfirm={executeDelete}
        isLoading={isLoading}
      />

      <ConfirmDialog
        open={!!archivePrompt}
        onOpenChange={(open) => {
          if (!open) setArchivePrompt(null)
        }}
        title="Campingplatz archivieren"
        description="Dieser Campingplatz ist bereits Urlaubsreisen zugeordnet. Statt ihn zu löschen, kann er archiviert werden und bleibt in bestehenden Urlaubsreisen sichtbar. Möchten Sie ihn archivieren?"
        onConfirm={executeArchive}
        isLoading={isLoading}
      />
    </div>
  )
}

export default function CampingplaetzePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Laden…
        </div>
      }
    >
      <CampingplaetzePageContent />
    </Suspense>
  )
}

