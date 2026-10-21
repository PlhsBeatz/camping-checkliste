'use client'

import { useAuth } from '@/components/auth-provider'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { BrandFab } from '@/components/brand-fab'
import { BrandSpinner } from '@/components/brand-spinner'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz, type CampingplatzFoto } from '@/lib/db'
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
  const [items, setItems] = useState<Campingplatz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<Campingplatz | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campingplatz | null>(null)
  const [archivePrompt, setArchivePrompt] = useState<Campingplatz | null>(null)

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
          const prevCp = prev.find((c) => c.id === id)
          const merged: Campingplatz = {
            ...cp,
            route_from_home: cp.route_from_home ?? prevCp?.route_from_home,
          }
          return [...o, merged].sort((a, b) => a.name.localeCompare(b.name))
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
    <PageShell containerClassName="space-y-6">
      <PageHeader title="Campingplätze" />

      {isLoading ? (
        <BrandSpinner label="Campingplätze werden geladen..." />
      ) : (
        <CampingplaetzeTable
          items={items}
          onEdit={handleEdit}
          onDelete={handleDeleteOrArchive}
          onRowClick={(item) => router.push(`/campingplaetze/${item.id}`)}
        />
      )}

      {canAccessConfig && (
        <BrandFab onClick={handleAdd} aria-label="Campingplatz hinzufügen" />
      )}

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
              route_from_home: saved.route_from_home ?? prevMatch?.route_from_home,
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
        description="Möchten Sie diesen Campingplatz wirklich löschen? Existiert der Platz nicht mehr (dauerhaft geschlossen), sollten Sie ihn nach Abgleich mit den Urlaubsreisen archivieren statt zu löschen. Ist er noch Urlaubsreisen zugeordnet, werden Sie zum Archivieren aufgefordert."
        onConfirm={executeDelete}
        isLoading={isLoading}
      />

      <ConfirmDialog
        open={!!archivePrompt}
        onOpenChange={(open) => {
          if (!open) setArchivePrompt(null)
        }}
        title="Ins Archiv verschieben"
        description="Dieser Campingplatz ist bereits Urlaubsreisen zugeordnet und kann nicht endgültig gelöscht werden. Im Archiv bleibt er in der Historie erhalten (z. B. wenn der Platz nicht mehr existiert). Bestehende Urlaubs-Zuordnungen bleiben sichtbar."
        onConfirm={executeArchive}
        isLoading={isLoading}
      />
    </PageShell>
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

