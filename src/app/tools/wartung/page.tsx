'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Menu, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type {
  Faelligkeit,
  FaelligkeitDashboard,
  EquipmentItem,
  TransportVehicle,
  VerbrauchMessung,
  Vacation,
  Category,
  MainCategory,
} from '@/lib/db'
import { FaelligkeitDashboardView } from '@/components/wartung/faelligkeit-dashboard'
import { FaelligkeitFormDialog } from '@/components/wartung/faelligkeit-form-dialog'
import { FaelligkeitQuittierungDialog } from '@/components/wartung/faelligkeit-quittierung-dialog'
import { FaelligkeitHistorieList } from '@/components/wartung/faelligkeit-historie-list'
import { VerbrauchSection } from '@/components/wartung/verbrauch-section'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { flattenFaelligkeitDashboard } from '@/lib/faelligkeit-time-groups'
import {
  getCachedFaelligkeiten,
  getCachedVerbrauchMessungen,
  getCachedEquipment,
  getCachedCategories,
  getCachedMainCategories,
  getCachedTransportVehicles,
  getCachedVacations,
} from '@/lib/offline-sync'
import {
  cacheFaelligkeiten,
  cacheVerbrauchMessungen,
  cacheEquipment,
  cacheCategories,
  cacheMainCategories,
  cacheTransportVehicles,
  cacheVacations,
} from '@/lib/offline-db'

function WartungPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canReadWartung, canWriteWartung, loading: authLoading } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [dashboard, setDashboard] = useState<FaelligkeitDashboard | null>(null)
  const [messungen, setMessungen] = useState<VerbrauchMessung[]>([])
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transports, setTransports] = useState<TransportVehicle[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Faelligkeit | null>(null)
  const [quittItem, setQuittItem] = useState<Faelligkeit | null>(null)
  const [historieItem, setHistorieItem] = useState<Faelligkeit | null>(null)
  const [deleteItem, setDeleteItem] = useState<Faelligkeit | null>(null)
  const [initialEquipmentId, setInitialEquipmentId] = useState<string | null>(null)
  const [initialEquipmentName, setInitialEquipmentName] = useState<string | null>(null)
  const [initialTransportId, setInitialTransportId] = useState<string | null>(null)
  const loadSeqRef = useRef(0)

  const fetchNoStore = useCallback((url: string) => {
    const sep = url.includes('?') ? '&' : '?'
    return fetch(`${url}${sep}_=${Date.now()}`, { cache: 'no-store' })
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canReadWartung) {
      router.replace('/')
    }
  }, [authLoading, canReadWartung, router])

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

  const upsertMessung = useCallback((item: VerbrauchMessung) => {
    setMessungen((prev) => {
      const next = [item, ...prev.filter((m) => m.id !== item.id)]
      void cacheVerbrauchMessungen(next)
      return next
    })
  }, [])

  const removeMessung = useCallback((id: string) => {
    setMessungen((prev) => {
      const next = prev.filter((m) => m.id !== id)
      void cacheVerbrauchMessungen(next)
      return next
    })
  }, [])

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current
    try {
      const [dashRes, verbrRes, eqRes, catRes, mainCatRes, trRes, vacRes] = await Promise.all([
        fetchNoStore('/api/faelligkeiten/dashboard'),
        fetchNoStore('/api/verbrauch-messungen?typ=gas'),
        fetchNoStore('/api/equipment-items'),
        fetchNoStore('/api/categories'),
        fetchNoStore('/api/main-categories'),
        fetchNoStore('/api/transport-vehicles'),
        fetchNoStore('/api/vacations'),
      ])
      const dashData = (await dashRes.json()) as ApiResponse<FaelligkeitDashboard>
      const verbrData = (await verbrRes.json()) as ApiResponse<VerbrauchMessung[]>
      const eqData = (await eqRes.json()) as ApiResponse<EquipmentItem[]>
      const catData = (await catRes.json()) as ApiResponse<Category[]>
      const mainCatData = (await mainCatRes.json()) as ApiResponse<MainCategory[]>
      const trData = (await trRes.json()) as ApiResponse<TransportVehicle[]>
      const vacData = (await vacRes.json()) as ApiResponse<Vacation[]>

      if (seq !== loadSeqRef.current) return

      if (dashData.success && dashData.data) {
        setDashboard(dashData.data)
        const all = [
          ...dashData.data.ueberfaellig,
          ...dashData.data.bald_faellig,
          ...dashData.data.ok,
          ...dashData.data.nur_info,
        ]
        await cacheFaelligkeiten(all)
      }
      if (verbrData.success && verbrData.data) {
        setMessungen(verbrData.data)
        await cacheVerbrauchMessungen(verbrData.data)
      }
      if (eqData.success && eqData.data) {
        setEquipment(eqData.data)
        await cacheEquipment(eqData.data)
      }
      if (catData.success && catData.data) {
        setCategories(catData.data)
        await cacheCategories(catData.data)
      }
      if (mainCatData.success && mainCatData.data) {
        setMainCategories(mainCatData.data)
        await cacheMainCategories(mainCatData.data)
      }
      if (trData.success && trData.data) {
        setTransports(trData.data)
        await cacheTransportVehicles(trData.data)
      }
      if (vacData.success && vacData.data) {
        setVacations(vacData.data)
        await cacheVacations(vacData.data)
      }
    } catch (error) {
      console.error('Wartung load failed:', error)
      if (seq !== loadSeqRef.current) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedFaelligkeiten()
        if (cached.length > 0) {
          const d: FaelligkeitDashboard = {
            ueberfaellig: [],
            bald_faellig: [],
            ok: [],
            nur_info: [],
          }
          for (const item of cached) {
            const s = item.ampel_status ?? 'ok'
            d[s].push(item)
          }
          setDashboard(d)
        }
        const cachedV = await getCachedVerbrauchMessungen()
        if (cachedV.length > 0) setMessungen(cachedV)
        const cachedEq = await getCachedEquipment()
        if (cachedEq.length > 0) setEquipment(cachedEq)
        const cachedCat = await getCachedCategories()
        if (cachedCat.length > 0) setCategories(cachedCat)
        const cachedMain = await getCachedMainCategories()
        if (cachedMain.length > 0) setMainCategories(cachedMain)
        const cachedTr = await getCachedTransportVehicles()
        if (cachedTr.length > 0) setTransports(cachedTr)
        const cachedVac = await getCachedVacations()
        if (cachedVac.length > 0) setVacations(cachedVac)
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false)
      }
    }
  }, [fetchNoStore])

  const refreshDashboard = useCallback(async () => {
    const seq = ++loadSeqRef.current
    try {
      const res = await fetchNoStore('/api/faelligkeiten/dashboard')
      const data = (await res.json()) as ApiResponse<FaelligkeitDashboard>
      if (seq !== loadSeqRef.current) return
      if (data.success && data.data) {
        setDashboard(data.data)
        const all = [
          ...data.data.ueberfaellig,
          ...data.data.bald_faellig,
          ...data.data.ok,
          ...data.data.nur_info,
        ]
        await cacheFaelligkeiten(all)
      }
    } catch (error) {
      console.error('Wartung dashboard refresh failed:', error)
    }
  }, [fetchNoStore])

  useEffect(() => {
    void load()
  }, [load])

  useReconnectRefetch(load)

  const handleEdit = (item: Faelligkeit) => {
    setEditItem(item)
    setInitialEquipmentId(null)
    setInitialEquipmentName(null)
    setInitialTransportId(null)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditItem(null)
    setInitialEquipmentId(null)
    setInitialEquipmentName(null)
    setInitialTransportId(null)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    const id = deleteItem.id
    setDeleteItem(null)
    try {
      const res = await fetch(`/api/faelligkeiten/${id}`, { method: 'DELETE' })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || !data.success) {
        console.error('Fälligkeit löschen fehlgeschlagen:', data.error)
        return
      }
      await refreshDashboard()
    } catch (error) {
      console.error('Fälligkeit löschen fehlgeschlagen:', error)
    }
  }

  const neuParam = searchParams.get('neu')
  const equipmentParam = searchParams.get('equipment')
  const transportParam = searchParams.get('transport')
  const bearbeitenParam = searchParams.get('bearbeiten')
  const filterTransportId = transportParam && !neuParam ? transportParam : null

  const filterTransportName =
    filterTransportId != null
      ? transports.find((t) => t.id === filterTransportId)?.name
      : null

  useEffect(() => {
    if (loading || formOpen || neuParam !== '1' || !canWriteWartung) return

    setEditItem(null)
    if (equipmentParam) {
      setInitialEquipmentId(equipmentParam)
      setInitialTransportId(null)
      const eq = equipment.find((e) => e.id === equipmentParam)
      setInitialEquipmentName(eq?.was ?? null)
    } else if (transportParam) {
      setInitialEquipmentId(null)
      setInitialEquipmentName(null)
      setInitialTransportId(transportParam)
    } else {
      setInitialEquipmentId(null)
      setInitialEquipmentName(null)
      setInitialTransportId(null)
    }
    setFormOpen(true)
    const nextUrl = filterTransportId
      ? `/tools/wartung?transport=${encodeURIComponent(filterTransportId)}`
      : '/tools/wartung'
    router.replace(nextUrl, { scroll: false })
  }, [
    neuParam,
    equipmentParam,
    transportParam,
    filterTransportId,
    loading,
    formOpen,
    canWriteWartung,
    equipment,
    router,
  ])

  useEffect(() => {
    if (loading || formOpen || !bearbeitenParam || !canWriteWartung || !dashboard) return

    const all = flattenFaelligkeitDashboard(dashboard)
    const item = all.find((f) => f.id === bearbeitenParam)
    if (item) {
      setEditItem(item)
      setInitialEquipmentId(null)
      setInitialEquipmentName(null)
      setInitialTransportId(null)
      setFormOpen(true)
    }
    router.replace('/tools/wartung', { scroll: false })
  }, [bearbeitenParam, loading, formOpen, canWriteWartung, dashboard, router])

  if (authLoading || !canReadWartung) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 transition-all duration-300 min-w-0', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-30 flex items-center justify-between bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
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
                  Wartung & Verbrauch
                </h1>
              </div>
            </div>
          </div>

          <Tabs defaultValue="faelligkeiten" className="space-y-4">
            <TabsList>
              <TabsTrigger value="faelligkeiten">Fälligkeiten</TabsTrigger>
              <TabsTrigger value="verbrauch">Verbrauch</TabsTrigger>
            </TabsList>

            <TabsContent value="faelligkeiten" className="mt-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
                  <p className="text-muted-foreground animate-pulse">Wird geladen…</p>
                </div>
              ) : dashboard ? (
                <>
                  {filterTransportId && (
                    <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                      <span>
                        Gefiltert:{' '}
                        <span className="font-medium">
                          {filterTransportName ?? 'Transportmittel'}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => router.replace('/tools/wartung', { scroll: false })}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Filter entfernen
                      </Button>
                    </div>
                  )}
                  <FaelligkeitDashboardView
                    dashboard={dashboard}
                    filterTransportId={filterTransportId}
                    canAdmin={canWriteWartung}
                    onQuittieren={setQuittItem}
                    onHistorie={setHistorieItem}
                    onEdit={handleEdit}
                    onDelete={setDeleteItem}
                  />
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="verbrauch" className="mt-0">
              <VerbrauchSection
                messungen={messungen}
                vacations={vacations}
                canAdmin={canWriteWartung}
                onMessungCreated={upsertMessung}
                onMessungDeleted={removeMessung}
                onRefresh={() => void load()}
              />
            </TabsContent>
          </Tabs>

          {canWriteWartung && (
            <div className="fixed bottom-6 right-6 z-30">
              <Button
                size="icon"
                onClick={handleNew}
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
                aria-label="Neue Fälligkeit"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </Button>
            </div>
          )}
        </div>
      </div>

      <FaelligkeitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
        equipment={equipment}
        transports={transports}
        categories={categories}
        mainCategories={mainCategories}
        initialEquipmentId={initialEquipmentId}
        initialEquipmentName={initialEquipmentName}
        initialTransportId={initialTransportId}
        onSaved={() => void refreshDashboard()}
      />

      <FaelligkeitQuittierungDialog
        open={!!quittItem}
        onOpenChange={(o) => !o && setQuittItem(null)}
        item={quittItem}
        onDone={() => void refreshDashboard()}
      />

      <FaelligkeitHistorieList
        open={!!historieItem}
        onOpenChange={(o) => !o && setHistorieItem(null)}
        faelligkeitId={historieItem?.id ?? null}
        faelligkeitName={historieItem?.name ?? ''}
        faelligkeit={historieItem}
        canAdmin={canWriteWartung}
        onChanged={() => void refreshDashboard()}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Fälligkeit löschen?"
        description={
          deleteItem
            ? `„${deleteItem.name}" wird unwiderruflich gelöscht (inkl. Historie).`
            : ''
        }
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}

export default function WartungPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
        </div>
      }
    >
      <WartungPageContent />
    </Suspense>
  )
}
