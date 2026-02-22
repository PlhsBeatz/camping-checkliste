'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { TravelersManager } from '@/components/travelers-manager'
import { Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Mitreisender } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { getCachedMitreisende } from '@/lib/offline-sync'
import { cacheMitreisende } from '@/lib/offline-db'

export default function MitreisendePage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [allMitreisende, setAllMitreisende] = useState<Mitreisender[]>([])

  useEffect(() => {
    if (!loading && !canAccessConfig) router.replace('/')
  }, [loading, canAccessConfig, router])

  // Sidebar offen: Body-Scroll sperren
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

  return (
    <div className="min-h-screen flex">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        "lg:ml-[280px]"
      )}>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Toggle */}
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
                  Mitreisende
                </h1>
              </div>
            </div>
          </div>

          {/* Travelers Manager */}
          <Card>
            <CardHeader>
              <CardTitle>Mitreisenden-Verwaltung</CardTitle>
              <CardDescription>
                Erstellen und verwalten Sie Mitreisende für Ihre Urlaube
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TravelersManager
                travelers={allMitreisende}
                onRefresh={handleRefresh}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
