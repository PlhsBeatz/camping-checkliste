'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import type { VerbrauchMedium, VerbrauchMessung, Vacation } from '@/lib/db'
import { VerbrauchMessungSection } from '@/components/verbrauch/verbrauch-messung-section'
import { VerbrauchUebersichtKarten } from '@/components/verbrauch/verbrauch-uebersicht-karten'
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

function VerbrauchPageContent() {
  const router = useRouter()
  const { canReadWartung, canWriteWartung, canAccessConfig, loading: authLoading } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [medien, setMedien] = useState<VerbrauchMedium[]>([])
  const [messungen, setMessungen] = useState<VerbrauchMessung[]>([])
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMediumKey, setActiveMediumKey] = useState<string>('')
  const loadSeqRef = useRef(0)

  const activeMedien = useMemo(() => medien.filter((m) => m.ist_aktiv), [medien])

  const activeMedium = useMemo(
    () => activeMedien.find((m) => m.schluessel === activeMediumKey) ?? null,
    [activeMedien, activeMediumKey]
  )

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
      setActiveMediumKey('')
      return
    }
    const first = activeMedien[0]
    if (!first) return
    if (!activeMediumKey || !activeMedien.some((m) => m.schluessel === activeMediumKey)) {
      setActiveMediumKey(first.schluessel)
    }
  }, [activeMedien, activeMediumKey])

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

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent" />
              <p className="text-muted-foreground animate-pulse">Wird geladen…</p>
            </div>
          ) : activeMedien.length === 0 ? (
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
          ) : (
            <>
              <VerbrauchUebersichtKarten
                medien={activeMedien}
                messungen={messungen}
                activeSchluessel={activeMediumKey}
                onSelect={setActiveMediumKey}
              />

              {activeMedium && (
                <VerbrauchMessungSection
                  medium={activeMedium}
                  messungen={messungen}
                  vacations={vacations}
                  canAdmin={canWriteWartung}
                  onMessungCreated={upsertMessung}
                  onMessungUpdated={upsertMessung}
                  onMessungDeleted={removeMessung}
                  onRefresh={() => void load()}
                />
              )}
            </>
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
