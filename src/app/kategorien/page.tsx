'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { CategoryManager } from '@/components/category-manager'
import { Menu, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Category, MainCategory, TransportVehicle } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import {
  getCachedCategories,
  getCachedMainCategories,
  getCachedTransportVehicles,
} from '@/lib/offline-sync'
import {
  cacheCategories,
  cacheMainCategories,
  cacheTransportVehicles,
} from '@/lib/offline-db'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

export default function KategorienPage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)

  useEffect(() => {
    if (!loading && !canAccessConfig) router.replace('/')
  }, [loading, canAccessConfig, router])
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [openNewMainCategoryTrigger, setOpenNewMainCategoryTrigger] = useState(false)

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

  // Fetch Transport Vehicles
  useEffect(() => {
    const fetchTransport = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = (await res.json()) as ApiResponse<TransportVehicle[]>
        if (data.success && data.data) {
          setTransportVehicles(data.data)
          await cacheTransportVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedTransportVehicles()
          if (cached.length > 0) setTransportVehicles(cached)
        }
      }
    }
    fetchTransport()
  }, [])

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = (await res.json()) as ApiResponse<CategoryWithMain[]>
        if (data.success && data.data) {
          setCategories(data.data)
          await cacheCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedCategories()
          if (cached.length > 0) setCategories(cached as CategoryWithMain[])
        }
      }
    }
    fetchCategories()
  }, [])

  // Fetch Main Categories
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const res = await fetch('/api/main-categories')
        const data = (await res.json()) as ApiResponse<MainCategory[]>
        if (data.success && data.data) {
          setMainCategories(data.data)
          await cacheMainCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch main categories:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedMainCategories()
          if (cached.length > 0) setMainCategories(cached)
        }
      }
    }
    fetchMainCategories()
  }, [])

  const handleRefresh = async () => {
    try {
      const catRes = await fetch('/api/categories')
      const catData = (await catRes.json()) as ApiResponse<CategoryWithMain[]>
      if (catData.success && catData.data) {
        setCategories(catData.data)
        await cacheCategories(catData.data)
      }
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedCategories()
        if (cached.length > 0) setCategories(cached as CategoryWithMain[])
      }
    }
    try {
      const mainCatRes = await fetch('/api/main-categories')
      const mainCatData = (await mainCatRes.json()) as ApiResponse<MainCategory[]>
      if (mainCatData.success && mainCatData.data) {
        setMainCategories(mainCatData.data)
        await cacheMainCategories(mainCatData.data)
      }
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedMainCategories()
        if (cached.length > 0) setMainCategories(cached)
      }
    }
    try {
      const transportRes = await fetch('/api/transport-vehicles')
      const transportData = (await transportRes.json()) as ApiResponse<TransportVehicle[]>
      if (transportData.success && transportData.data) {
        setTransportVehicles(transportData.data)
        await cacheTransportVehicles(transportData.data)
      }
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedTransportVehicles()
        if (cached.length > 0) setTransportVehicles(cached)
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
                  Kategorien
                </h1>
              </div>
            </div>
          </div>

          {/* Category Manager */}
          <CategoryManager
            categories={categories}
            mainCategories={mainCategories}
            transportVehicles={transportVehicles}
            onRefresh={handleRefresh}
            openNewMainCategoryTrigger={openNewMainCategoryTrigger}
            onOpenNewMainCategoryConsumed={() => setOpenNewMainCategoryTrigger(false)}
          />
        </div>
      </div>

      {/* FAB: Neue Hauptkategorie */}
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="icon"
          onClick={() => setOpenNewMainCategoryTrigger(true)}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  )
}
