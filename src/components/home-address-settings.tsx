'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HomeAddressAutocomplete } from '@/components/home-address-autocomplete'
import type { ApiResponse } from '@/lib/api-types'
import { getCachedHomeLocation } from '@/lib/offline-sync'
import { cacheHomeLocation } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { Home } from 'lucide-react'

export function HomeAddressSettings() {
  const { user, loading } = useAuth()
  const [homeAddress, setHomeAddress] = useState('')
  const [homeLat, setHomeLat] = useState<number | null>(null)
  const [homeLng, setHomeLng] = useState<number | null>(null)
  const [homeLoading, setHomeLoading] = useState(false)
  const [homeSaving, setHomeSaving] = useState(false)
  const [homeError, setHomeError] = useState<string | null>(null)
  const [homeSuccess, setHomeSuccess] = useState(false)

  const loadHomeLocation = async () => {
    if (!user) return
    setHomeLoading(true)
    setHomeError(null)
    try {
      const res = await fetch('/api/profile/home-location')
      const data = (await res.json()) as ApiResponse<{
        heimat_adresse: string | null
        heimat_lat: number | null
        heimat_lng: number | null
      }>
      if (data.success && data.data) {
        setHomeAddress(data.data.heimat_adresse ?? '')
        setHomeLat(data.data.heimat_lat)
        setHomeLng(data.data.heimat_lng)
        try {
          await cacheHomeLocation({
            heimat_adresse: data.data.heimat_adresse ?? null,
            heimat_lat: data.data.heimat_lat,
            heimat_lng: data.data.heimat_lng,
          })
        } catch (cacheErr) {
          console.warn('cacheHomeLocation failed:', cacheErr)
        }
      }
    } catch (error) {
      console.error('Failed to load home location:', error)
      const cached = await getCachedHomeLocation()
      if (cached) {
        setHomeAddress(cached.heimat_adresse ?? '')
        setHomeLat(cached.heimat_lat)
        setHomeLng(cached.heimat_lng)
      } else {
        setHomeError('Heimatadresse konnte nicht geladen werden.')
      }
    } finally {
      setHomeLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      void loadHomeLocation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user])

  useReconnectRefetch(loadHomeLocation)

  const handleSaveHomeLocation = async () => {
    setHomeSaving(true)
    setHomeError(null)
    setHomeSuccess(false)
    try {
      const res = await fetch('/api/profile/home-location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heimatAdresse: homeAddress,
          lat: homeLat,
          lng: homeLng,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setHomeError(data.error ?? 'Heimatadresse konnte nicht gespeichert werden.')
        return
      }
      setHomeSuccess(true)
    } catch (error) {
      console.error('Failed to save home location:', error)
      setHomeError('Heimatadresse konnte nicht gespeichert werden.')
    } finally {
      setHomeSaving(false)
    }
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Heimatadresse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 min-w-0">
        <p className="text-sm text-muted-foreground">
          Für Entfernung &amp; Fahrzeit.
        </p>
        <div className="space-y-2 min-w-0">
          <label className="text-sm font-medium" htmlFor="heimat_adresse">
            Adresse
          </label>
          <div className="min-w-0 w-full">
            <HomeAddressAutocomplete
              value={homeAddress}
              onChange={(v) => {
                setHomeAddress(v)
                setHomeSuccess(false)
              }}
              onResolve={(r) => {
                setHomeAddress(r.address)
                setHomeLat(r.lat)
                setHomeLng(r.lng)
                setHomeSuccess(false)
              }}
              placeholder="z.B. Musterstraße 1, 12345 Musterstadt"
            />
          </div>
        </div>
        {homeError && <p className="text-sm text-red-600">{homeError}</p>}
        {homeSuccess && !homeError && (
          <p className="text-sm text-emerald-700">
            Heimatadresse gespeichert. Routen-Caches werden beim nächsten Aufruf neu
            berechnet.
          </p>
        )}
        <Button
          type="button"
          onClick={handleSaveHomeLocation}
          disabled={homeSaving || homeLoading}
          className="w-full sm:w-auto"
        >
          {homeSaving ? 'Speichert…' : 'Heimatadresse speichern'}
        </Button>
      </CardContent>
    </Card>
  )
}
