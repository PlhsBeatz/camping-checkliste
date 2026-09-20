'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { VerbrauchMedium, VerbrauchMessung, Vacation } from '@/lib/db'
import { VerbrauchMessungSection } from '@/components/verbrauch/verbrauch-messung-section'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import {
  getCachedVerbrauchMessungen,
  getCachedVerbrauchMedien,
  getCachedVacations,
} from '@/lib/offline-sync'
import {
  cacheVerbrauchMessungen,
  cacheVerbrauchMedien,
  cacheVacations,
} from '@/lib/offline-db'

const TAB_TRIGGER_CLASS =
  "flex-shrink-0 uppercase text-xs font-semibold tracking-wide px-6 py-3 rounded-none border-b-4 border-transparent data-[state=active]:border-[#e67e22] data-[state=active]:text-brand-heading data-[state=inactive]:text-[rgb(168,162,158)] dark:data-[state=inactive]:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors relative data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-[50px] data-[state=active]:after:h-1 data-[state=active]:after:bg-[#e67e22] data-[state=active]:after:rounded-full data-[state=active]:border-b-transparent data-[state=active]:shadow-none"

function VerbrauchPageContent() {
  const router = useRouter()
  const { canReadWartung, canWriteWartung, canAccessConfig, loading: authLoading } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [medien, setMedien] = useState<VerbrauchMedium[]>([])
  const [messungen, setMessungen] = useState<VerbrauchMessung[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('')
  const [tabsScrollbarVisible, setTabsScrollbarVisible] = useState(false)
  const tabsScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadSeqRef = useRef(0)

  const activeMedien = useMemo(() => medien.filter((m) => m.ist_aktiv), [medien])

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
      const [medienRes, verbrRes, vacRes] = await Promise.all([
        fetchNoStore('/api/verbrauch-medien?active=1'),
        fetchNoStore('/api/verbrauch-messungen'),
        fetchNoStore('/api/vacations'),
      ])
      const medienData = (await medienRes.json()) as ApiResponse<VerbrauchMedium[]>
      const verbrData = (await verbrRes.json()) as ApiResponse<VerbrauchMessung[]>
      const vacData = (await vacRes.json()) as ApiResponse<Vacation[]>

      if (seq !== loadSeqRef.current) return

      if (medienData.success && medienData.data) {
        setMedien(medienData.data)
        await cacheVerbrauchMedien(medienData.data)
      }
      if (verbrData.success && verbrData.data) {
        setMessungen(verbrData.data)
        await cacheVerbrauchMessungen(verbrData.data)
      }
      if (vacData.success && vacData.data) {
        setVacations(vacData.data)
        await cacheVacations(vacData.data)
      }
    } catch (error) {
      console.error('Verbrauch load failed:', error)
      if (seq !== loadSeqRef.current) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cachedM = await getCachedVerbrauchMedien()
        if (cachedM.length > 0) setMedien(cachedM)
        const cachedV = await getCachedVerbrauchMessungen()
        if (cachedV.length > 0) setMessungen(cachedV)
        const cachedVac = await getCachedVacations()
        if (cachedVac.length > 0) setVacations(cachedVac)
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false)
      }
    }
  }, [fetchNoStore])

  useEffect(() => {
    void load()
  }, [load])

  useReconnectRefetch(load)

  useEffect(() => {
    if (activeMedien.length === 0) {
      setActiveTab('')
      return
    }
    const first = activeMedien[0]
    if (!first) return
    if (!activeTab || !activeMedien.some((m) => m.schluessel === activeTab)) {
      setActiveTab(first.schluessel)
    }
  }, [activeMedien, activeTab])

  useEffect(() => {
    return () => {
      if (tabsScrollTimeoutRef.current) clearTimeout(tabsScrollTimeoutRef.current)
    }
  }, [])

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
        <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-full">
          {loading ? (
            <>
              <div className="sticky top-0 z-30 flex items-center gap-4 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNavSidebar(true)}
                  className="lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Verbrauch
                </h1>
              </div>
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
                <p className="text-muted-foreground animate-pulse">Wird geladen…</p>
              </div>
            </>
          ) : activeMedien.length === 0 ? (
            <>
              <div className="sticky top-0 z-30 flex items-center gap-4 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNavSidebar(true)}
                  className="lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Verbrauch
                </h1>
              </div>
              <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                <p className="text-muted-foreground">
                  Noch keine Verbrauch-Medien aktiv. Aktiviere sie unter Konfiguration →
                  Verbrauch-Medien.
                </p>
                {canAccessConfig && (
                  <Button asChild variant="outline">
                    <Link href="/verbrauch-medien">Zu Verbrauch-Medien</Link>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <div className="sticky top-0 z-30 bg-card shadow -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
                <div className="flex items-center gap-4 pb-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNavSidebar(true)}
                    className="lg:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                    Verbrauch
                  </h1>
                </div>
                <div
                  className={cn(
                    'tabs-scrollbar-auto bg-card overflow-x-auto overflow-y-hidden -mx-4 sm:-mx-6 pl-4 pr-4 sm:pl-6 sm:pr-6 pb-2',
                    tabsScrollbarVisible && 'tabs-scrollbar-visible'
                  )}
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  onScroll={() => {
                    setTabsScrollbarVisible(true)
                    if (tabsScrollTimeoutRef.current) clearTimeout(tabsScrollTimeoutRef.current)
                    tabsScrollTimeoutRef.current = setTimeout(() => {
                      setTabsScrollbarVisible(false)
                      tabsScrollTimeoutRef.current = null
                    }, 800)
                  }}
                >
                  <TabsList className="inline-flex w-max justify-start bg-transparent p-0 h-auto rounded-none">
                    {activeMedien.map((m) => (
                      <TabsTrigger key={m.id} value={m.schluessel} className={TAB_TRIGGER_CLASS}>
                        {m.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              {activeMedien.map((m) => (
                <TabsContent key={m.id} value={m.schluessel} className="mt-0">
                  <VerbrauchMessungSection
                    medium={m}
                    messungen={messungen}
                    vacations={vacations}
                    canAdmin={canWriteWartung}
                    onMessungCreated={upsertMessung}
                    onMessungUpdated={upsertMessung}
                    onMessungDeleted={removeMessung}
                    onRefresh={() => void load()}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerbrauchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
        </div>
      }
    >
      <VerbrauchPageContent />
    </Suspense>
  )
}
