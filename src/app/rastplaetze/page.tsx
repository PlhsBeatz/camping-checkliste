'use client'

import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { BrandFab } from '@/components/brand-fab'
import { BrandSpinner } from '@/components/brand-spinner'
import { MoreVertical, Download } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEffect, useMemo, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import { Rastplatz } from '@/lib/db'
import { RastplaetzeTable } from '@/components/rastplaetze-table'
import { RastplaetzeMap } from '@/components/rastplaetze-map'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RastplatzEditModal } from '@/components/rastplatz-edit-modal'
import { getCachedRastplaetze, getCachedHomeLocation } from '@/lib/offline-sync'
import { cacheRastplaetze, cacheHomeLocation } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { buildGpxWaypoints, downloadGpx } from '@/lib/maps-export'
import type { RastplaetzeMapHome } from '@/components/rastplaetze-map.impl'
import {
  DEFAULT_RASTPLATZ_FILTER,
  filterRastplaetze,
  type RastplatzFilterState,
} from '@/lib/rastplatz-filter'

export default function RastplaetzePage() {
  const { canAccessConfig } = useAuth()
  const [items, setItems] = useState<Rastplatz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<Rastplatz | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Rastplatz | null>(null)
  const [home, setHome] = useState<RastplaetzeMapHome | null>(null)
  const [listFilter, setListFilter] = useState<RastplatzFilterState>(DEFAULT_RASTPLATZ_FILTER)

  const filteredItems = useMemo(
    () => filterRastplaetze(items, listFilter),
    [items, listFilter]
  )

  const load = async () => {
    try {
      const res = await fetch('/api/rastplaetze')
      const data = (await res.json()) as ApiResponse<Rastplatz[]>
      if (data.success && data.data) {
        setItems(data.data)
        try {
          await cacheRastplaetze(data.data)
        } catch (e) {
          console.warn('cacheRastplaetze failed:', e)
        }
      }
    } catch (error) {
      console.error('Failed to fetch rastplaetze:', error)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedRastplaetze()
        if (cached.length > 0) setItems(cached)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const loadHome = async () => {
      try {
        const res = await fetch('/api/profile/home-location')
        const data = (await res.json()) as ApiResponse<{
          heimat_adresse: string | null
          heimat_lat: number | null
          heimat_lng: number | null
        }>
        if (data.success && data.data) {
          try {
            await cacheHomeLocation({
              heimat_adresse: data.data.heimat_adresse ?? null,
              heimat_lat: data.data.heimat_lat ?? null,
              heimat_lng: data.data.heimat_lng ?? null,
            })
          } catch (e) {
            console.warn('cacheHomeLocation failed:', e)
          }
          if (data.data.heimat_lat != null && data.data.heimat_lng != null) {
            setHome({
              lat: data.data.heimat_lat,
              lng: data.data.heimat_lng,
              label: data.data.heimat_adresse ?? 'Heimatadresse',
            })
          }
        }
      } catch {
        const cached = await getCachedHomeLocation()
        if (cached?.heimat_lat != null && cached.heimat_lng != null) {
          setHome({
            lat: cached.heimat_lat,
            lng: cached.heimat_lng,
            label: cached.heimat_adresse ?? 'Heimatadresse',
          })
        }
      }
    }
    void loadHome()
  }, [])

  useReconnectRefetch(load)

  const handleAdd = () => {
    setEditTarget(null)
    setShowDialog(true)
  }

  const handleEdit = (item: Rastplatz) => {
    setEditTarget(item)
    setShowDialog(true)
  }

  const handleDelete = (item: Rastplatz) => {
    setDeleteTarget(item)
  }

  const executeDelete = async () => {
    if (!deleteTarget) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/rastplaetze?id=${deleteTarget.id}`, { method: 'DELETE' })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!data.success) {
        alert('Fehler beim Löschen: ' + (data.error ?? 'Unbekannt'))
      } else {
        setItems((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      }
    } catch (error) {
      console.error('Failed to delete rastplatz:', error)
      alert('Fehler beim Löschen des Rastplatzes.')
    } finally {
      setDeleteTarget(null)
      setIsLoading(false)
    }
  }

  const handleSaved = (saved: Rastplatz) => {
    setItems((prev) => {
      const rest = prev.filter((r) => r.id !== saved.id)
      return [...rest, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  const handleExportGpx = () => {
    const gpx = buildGpxWaypoints(items.filter((r) => r.bewertung === 'empfehlung'))
    downloadGpx(gpx, 'rastplaetze-empfehlungen.gpx')
  }

  return (
    <PageShell containerClassName="space-y-6">
      <PageHeader
        title="Rastplätze"
        actions={
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                  className="h-9 w-9 shrink-0 rounded-full border-0 bg-transparent text-foreground shadow-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Weitere Aktionen"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-40 min-w-[10rem]">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={handleExportGpx}
              >
                <Download className="h-4 w-4 shrink-0" />
                GPX exportieren (Empfehlungen)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {isLoading ? (
        <BrandSpinner label="Rastplätze werden geladen..." />
      ) : (
        <div className="space-y-4 min-w-0">
          <RastplaetzeMap items={filteredItems} home={home} />
          <RastplaetzeTable
            items={filteredItems}
            filter={listFilter}
            onFilterChange={(patch) =>
              setListFilter((prev) => ({ ...prev, ...patch }))
            }
            onEdit={canAccessConfig ? handleEdit : () => {}}
            onDelete={canAccessConfig ? handleDelete : () => {}}
          />
        </div>
      )}

      {canAccessConfig && (
        <BrandFab onClick={handleAdd} aria-label="Rastplatz hinzufügen" />
      )}

      {canAccessConfig && (
        <RastplatzEditModal
          open={showDialog}
          onOpenChange={(next) => {
            if (!next) {
              setEditTarget(null)
              setShowDialog(false)
            } else {
              setShowDialog(true)
            }
          }}
          initialRastplatz={editTarget}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Rastplatz löschen"
        description={
          deleteTarget
            ? `Möchten Sie „${deleteTarget.name}" wirklich löschen?`
            : ''
        }
        onConfirm={() => void executeDelete()}
        isLoading={isLoading}
      />
    </PageShell>
  )
}
