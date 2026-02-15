'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { CategoryManager } from '@/components/category-manager'
import { Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Category, MainCategory } from '@/lib/db'
import { cn } from '@/lib/utils'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

export default function KategorienPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (data.success) {
          setCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    fetchCategories()
  }, [])

  // Fetch Main Categories
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const res = await fetch('/api/main-categories')
        const data = await res.json()
        if (data.success) {
          setMainCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch main categories:', error)
      }
    }
    fetchMainCategories()
  }, [])

  const handleRefresh = async () => {
    const catRes = await fetch('/api/categories')
    const catData = await catRes.json()
    if (catData.success) setCategories(catData.data)
    
    const mainCatRes = await fetch('/api/main-categories')
    const mainCatData = await mainCatRes.json()
    if (mainCatData.success) setMainCategories(mainCatData.data)
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
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                  Kategorien
                </h1>
              </div>
            </div>
          </div>

          {/* Category Manager */}
          <Card>
            <CardContent>
              <CategoryManager
                categories={categories}
                mainCategories={mainCategories}
                onRefresh={handleRefresh}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
