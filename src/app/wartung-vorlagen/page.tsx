'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { FaelligkeitVorlagenManager } from '@/components/faelligkeit-vorlagen-manager'
import { useCallback, useEffect, useState } from 'react'
import type { FaelligkeitVorlage } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export default function WartungVorlagenPage() {
  const [vorlagen, setVorlagen] = useState<FaelligkeitVorlage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/faelligkeit-vorlagen')
      const data = (await res.json()) as ApiResponse<FaelligkeitVorlage[]>
      if (data.success && data.data) {
        setVorlagen(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch Wartungs-Vorlagen:', error)
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
        <FaelligkeitVorlagenManager vorlagen={vorlagen} onRefresh={load} />
      )}
    </ConfigPageLayout>
  )
}
