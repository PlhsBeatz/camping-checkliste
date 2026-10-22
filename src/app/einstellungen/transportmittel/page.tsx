'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfigPageLayout } from '@/components/config-page-layout'
import { TransportmittelManager } from '@/components/transportmittel-manager'
import { useState, useEffect } from 'react'
import { TransportVehicle } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { getCachedTransportVehicles } from '@/lib/offline-sync'
import { cacheTransportVehicles } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export default function TransportmittelPage() {
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([])

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = (await res.json()) as ApiResponse<TransportVehicle[]>
        if (data.success && data.data) {
          setVehicles(data.data)
          await cacheTransportVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedTransportVehicles()
          if (cached.length > 0) setVehicles(cached)
        }
      }
    }
    fetchVehicles()
  }, [])

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/transport-vehicles')
      const data = (await res.json()) as ApiResponse<TransportVehicle[]>
      if (data.success && data.data) {
        setVehicles(data.data)
        await cacheTransportVehicles(data.data)
      }
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedTransportVehicles()
        if (cached.length > 0) setVehicles(cached)
      }
    }
  }

  useReconnectRefetch(handleRefresh)

  return (
    <ConfigPageLayout>
      <Card>
        <CardHeader>
          <CardTitle>Transportmittel-Verwaltung</CardTitle>
          <CardDescription>
            Erstellen und verwalten Sie Ihre Transportmittel (Wohnwagen, Auto etc.) für die
            Gewichtsberechnung
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransportmittelManager vehicles={vehicles} onRefresh={handleRefresh} />
        </CardContent>
      </Card>
    </ConfigPageLayout>
  )
}
