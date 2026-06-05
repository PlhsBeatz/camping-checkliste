'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfigPageLayout } from '@/components/config-page-layout'
import { TravelersManager } from '@/components/travelers-manager'
import { useState, useEffect } from 'react'
import { Mitreisender } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { getCachedMitreisende } from '@/lib/offline-sync'
import { cacheMitreisende } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export default function MitreisendePage() {
  const [allMitreisende, setAllMitreisende] = useState<Mitreisender[]>([])

  // Fetch All Mitreisende
  useEffect(() => {
    const fetchAllMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende')
        const data = (await res.json()) as ApiResponse<Mitreisender[]>
        if (data.success && data.data) {
          setAllMitreisende(data.data)
          await cacheMitreisende(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedMitreisende()
          if (cached.length > 0) setAllMitreisende(cached)
        }
      }
    }
    fetchAllMitreisende()
  }, [])

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/mitreisende')
      const data = (await res.json()) as ApiResponse<Mitreisender[]>
      if (data.success && data.data) {
        setAllMitreisende(data.data)
        await cacheMitreisende(data.data)
      }
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedMitreisende()
        if (cached.length > 0) setAllMitreisende(cached)
      }
    }
  }

  useReconnectRefetch(handleRefresh)

  return (
    <ConfigPageLayout>
      <Card>
        <CardHeader>
          <CardTitle>Personen-Verwaltung</CardTitle>
          <CardDescription>
            Erstellen und verwalten Sie Personen für Ihre Urlaube
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TravelersManager travelers={allMitreisende} onRefresh={handleRefresh} />
        </CardContent>
      </Card>
    </ConfigPageLayout>
  )
}
