'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { TransportmittelManager } from '@/components/transportmittel-manager'
import { Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { TransportVehicle } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { cn } from '@/lib/utils'

export default function TransportmittelPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([])

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

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = (await res.json()) as ApiResponse<TransportVehicle[]>
        if (data.success && data.data) {
          setVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
      }
    }
    fetchVehicles()
  }, [])

  const handleRefresh = async () => {
    const res = await fetch('/api/transport-vehicles')
    const data = (await res.json()) as ApiResponse<TransportVehicle[]>
    if (data.success && data.data) setVehicles(data.data)
  }

  return (
    <div className="min-h-screen flex">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 transition-all duration-300',
          'lg:ml-[280px]'
        )}
      >
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
                  Transportmittel
                </h1>
              </div>
            </div>
          </div>

          {/* Transportmittel Manager */}
          <Card>
            <CardHeader>
              <CardTitle>Transportmittel-Verwaltung</CardTitle>
              <CardDescription>
                Erstellen und verwalten Sie Ihre Transportmittel (Wohnwagen, Auto etc.) für die Gewichtsberechnung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransportmittelManager vehicles={vehicles} onRefresh={handleRefresh} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
