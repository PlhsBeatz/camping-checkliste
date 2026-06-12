'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfigPageLayout } from '@/components/config-page-layout'
import { TravelersManager } from '@/components/travelers-manager'
import { FabMenuM3 } from '@/components/fab-menu-m3'
import { UserPlus, UsersRound } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Mitreisender, MitreisendenGruppe } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { getCachedMitreisende, getCachedMitreisendenGruppen } from '@/lib/offline-sync'
import { cacheMitreisende, cacheMitreisendenGruppen } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export default function MitreisendePage() {
  const [allMitreisende, setAllMitreisende] = useState<Mitreisender[]>([])
  const [gruppen, setGruppen] = useState<MitreisendenGruppe[]>([])
  const [fabMenuOpen, setFabMenuOpen] = useState(false)
  const [openNewTravelerTrigger, setOpenNewTravelerTrigger] = useState(false)
  const [openNewGroupTrigger, setOpenNewGroupTrigger] = useState(false)

  const applyMitreisendeResponse = async (
    data: ApiResponse<Mitreisender[]> & { gruppen?: MitreisendenGruppe[] }
  ) => {
    if (data.success && data.data) {
      setAllMitreisende(data.data)
      await cacheMitreisende(data.data)
    }
    if (data.success && data.gruppen) {
      setGruppen(data.gruppen)
      await cacheMitreisendenGruppen(data.gruppen)
    }
  }

  useEffect(() => {
    const fetchAllMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende?includeGroups=1')
        const data = (await res.json()) as ApiResponse<Mitreisender[]> & { gruppen?: MitreisendenGruppe[] }
        await applyMitreisendeResponse(data)
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const [cached, cachedGruppen] = await Promise.all([
            getCachedMitreisende(),
            getCachedMitreisendenGruppen(),
          ])
          if (cached.length > 0) setAllMitreisende(cached)
          if (cachedGruppen.length > 0) setGruppen(cachedGruppen)
        }
      }
    }
    fetchAllMitreisende()
  }, [])

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/mitreisende?includeGroups=1')
      const data = (await res.json()) as ApiResponse<Mitreisender[]> & { gruppen?: MitreisendenGruppe[] }
      await applyMitreisendeResponse(data)
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const [cached, cachedGruppen] = await Promise.all([
          getCachedMitreisende(),
          getCachedMitreisendenGruppen(),
        ])
        if (cached.length > 0) setAllMitreisende(cached)
        if (cachedGruppen.length > 0) setGruppen(cachedGruppen)
      }
    }
  }

  useReconnectRefetch(handleRefresh)

  return (
    <ConfigPageLayout
      afterContent={
        <FabMenuM3
          open={fabMenuOpen}
          onOpenChange={setFabMenuOpen}
          ariaLabel="Neue Person oder neue Reisegruppe"
          actions={[
            {
              id: 'person',
              label: 'Neue Person',
              icon: <UserPlus className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />,
              onSelect: () => setOpenNewTravelerTrigger(true),
            },
            {
              id: 'group',
              label: 'Neue Reisegruppe',
              icon: <UsersRound className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />,
              onSelect: () => setOpenNewGroupTrigger(true),
            },
          ]}
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Personen-Verwaltung</CardTitle>
          <CardDescription>
            Erstellen und verwalten Sie Personen und Reisegruppen für Ihre Urlaube
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TravelersManager
            travelers={allMitreisende}
            gruppen={gruppen}
            onRefresh={handleRefresh}
            openNewTravelerTrigger={openNewTravelerTrigger}
            onOpenNewTravelerConsumed={() => setOpenNewTravelerTrigger(false)}
            openNewGroupTrigger={openNewGroupTrigger}
            onOpenNewGroupConsumed={() => setOpenNewGroupTrigger(false)}
          />
        </CardContent>
      </Card>
    </ConfigPageLayout>
  )
}
