'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { VerbrauchMedienManager } from '@/components/verbrauch/verbrauch-medien-manager'
import { FabMenuM3 } from '@/components/fab-menu-m3'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { VerbrauchMedium } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { VERBRAUCH_MEDIEN_KATALOG } from '@/lib/verbrauch-medien-katalog'
import { BookOpen, Plus } from 'lucide-react'

export default function VerbrauchMedienPage() {
  const [medien, setMedien] = useState<VerbrauchMedium[]>([])
  const [loading, setLoading] = useState(true)
  const [fabMenuOpen, setFabMenuOpen] = useState(false)
  const [openCatalogTrigger, setOpenCatalogTrigger] = useState(false)
  const [openCreateTrigger, setOpenCreateTrigger] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/verbrauch-medien')
      const data = (await res.json()) as ApiResponse<VerbrauchMedium[]>
      if (data.success && data.data) {
        setMedien(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch Verbrauch-Medien:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useReconnectRefetch(load)

  const canActivateFromCatalog = useMemo(() => {
    const configured = new Set(medien.map((m) => m.schluessel))
    return VERBRAUCH_MEDIEN_KATALOG.some((k) => !configured.has(k.schluessel))
  }, [medien])

  return (
    <ConfigPageLayout
      afterContent={
        <FabMenuM3
          open={fabMenuOpen}
          onOpenChange={setFabMenuOpen}
          ariaLabel="Medium hinzufügen"
          actions={[
            {
              id: 'catalog',
              label: 'Aus Katalog',
              icon: <BookOpen className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />,
              onSelect: () => setOpenCatalogTrigger(true),
              disabled: !canActivateFromCatalog,
              disabledHint: 'Alle Katalog-Medien sind bereits angelegt.',
            },
            {
              id: 'custom',
              label: 'Eigenes Medium',
              icon: <Plus className="h-[22px] w-[22px]" strokeWidth={2.5} aria-hidden />,
              onSelect: () => setOpenCreateTrigger(true),
            },
          ]}
        />
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Wird geladen…</p>
      ) : (
        <VerbrauchMedienManager
          medien={medien}
          onRefresh={load}
          openCatalogTrigger={openCatalogTrigger}
          onOpenCatalogConsumed={() => setOpenCatalogTrigger(false)}
          openCreateTrigger={openCreateTrigger}
          onOpenCreateConsumed={() => setOpenCreateTrigger(false)}
        />
      )}
    </ConfigPageLayout>
  )
}
