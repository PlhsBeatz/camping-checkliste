'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { TravelersManager } from '@/components/travelers-manager'
import { Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Mitreisender } from '@/lib/db'
import { cn } from '@/lib/utils'

export default function MitreisendePage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [allMitreisende, setAllMitreisende] = useState<Mitreisender[]>([])

  // Fetch All Mitreisende
  useEffect(() => {
    const fetchAllMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende')
        const data = await res.json()
        if (data.success) {
          setAllMitreisende(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
      }
    }
    fetchAllMitreisende()
  }, [])

  const handleRefresh = async () => {
    const res = await fetch('/api/mitreisende')
    const data = await res.json()
    if (data.success) setAllMitreisende(data.data)
  }

  return (
    <div className="min-h-screen bg-background flex">
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
          {/* Header */}
          <div className="flex items-center justify-between">
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
                <h1 className="text-3xl font-bold tracking-tight">
                  Mitreisende
                </h1>
                <p className="text-muted-foreground mt-1">
                  Verwalten Sie Ihre Mitreisenden zentral
                </p>
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
