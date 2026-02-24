'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, KeyRound } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import { HomeAddressAutocomplete } from '@/components/home-address-autocomplete'

export default function ProfilPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [homeAddress, setHomeAddress] = useState('')
  const [homeLat, setHomeLat] = useState<number | null>(null)
  const [homeLng, setHomeLng] = useState<number | null>(null)
  const [homeLoading, setHomeLoading] = useState(false)
  const [homeSaving, setHomeSaving] = useState(false)
  const [homeError, setHomeError] = useState<string | null>(null)
  const [homeSuccess, setHomeSuccess] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
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
        }
      } catch (error) {
        console.error('Failed to load home location:', error)
        setHomeError('Heimatadresse konnte nicht geladen werden.')
      } finally {
        setHomeLoading(false)
      }
    }
    if (!loading) {
      void loadHomeLocation()
    }
  }, [loading, user])

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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(250,250,249)]">
        <p className="text-gray-600">Wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />
      <div className={cn('flex-1 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
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
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                  Mein Profil
                </h1>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kontodaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">E-Mail</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rolle</p>
                <p className="font-medium capitalize">{user.role}</p>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/profil/passwort-aendern" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Passwort ändern
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Heimatadresse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Die Heimatadresse wird zur Berechnung von Entfernungen und Fahrzeiten zu Campingplätzen verwendet.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="heimat_adresse">
                  Adresse
                </label>
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
                <p className="text-xs text-gray-500">
                  Wenn Google Places verfügbar ist, werden Koordinaten automatisch ermittelt. Andernfalls wird nur die Adresse gespeichert.
                </p>
              </div>
              {homeError && (
                <p className="text-sm text-red-600">
                  {homeError}
                </p>
              )}
              {homeSuccess && !homeError && (
                <p className="text-sm text-emerald-700">
                  Heimatadresse gespeichert. Routen-Caches werden beim nächsten Aufruf neu berechnet.
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
        </div>
      </div>
    </div>
  )
}
