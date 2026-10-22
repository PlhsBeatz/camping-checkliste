'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { VerbrauchMedienManager } from '@/components/verbrauch/verbrauch-medien-manager'
import { useCallback, useEffect, useState } from 'react'
import type { VerbrauchMedium } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export default function VerbrauchMedienPage() {
  const [medien, setMedien] = useState<VerbrauchMedium[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <ConfigPageLayout>
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Wird geladen…</p>
      ) : (
        <VerbrauchMedienManager medien={medien} onRefresh={load} />
      )}
    </ConfigPageLayout>
  )
}
