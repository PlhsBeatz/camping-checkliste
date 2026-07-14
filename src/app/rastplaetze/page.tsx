'use client'

import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Plus, Menu, Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ApiResponse } from '@/lib/api-types'
import { Rastplatz } from '@/lib/db'
import { cn } from '@/lib/utils'
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
  const [showNavSidebar, setShowNavSidebar] = useState(false)
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
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 transition-all duration-300 min-w-0', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
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
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Rastplätze
                </h1>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleExportGpx}
              title="GPX exportieren (Empfehlungen)"
              className="flex-shrink-0"
            >
              <Download className="h-5 w-5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
              <p className="text-muted-foreground animate-pulse">
                Rastplätze werden geladen...
              </p>
            </div>
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
    </div>
  )
}
