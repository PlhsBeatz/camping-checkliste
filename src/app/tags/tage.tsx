'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { TagManager } from '@/components/tag-manager'
import { Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Tag } from '@/lib/db'
import { cn } from '@/lib/utils'

export default function TagsPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])

  // Fetch Tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags')
        const data = await res.json()
        if (data.success) {
          setTags(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      }
    }
    fetchTags()
  }, [])

  const handleRefresh = () => {
    fetch('/api/tags')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTags(data.data)
        }
      })
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
                  Tags & Labels
                </h1>
                <p className="text-muted-foreground mt-1">
                  Verwalten Sie Tags für Ihre Ausrüstungsgegenstände
                </p>
              </div>
            </div>
          </div>

          {/* Tag Manager */}
          <Card>
            <CardHeader>
              <CardTitle>Tag-Verwaltung</CardTitle>
              <CardDescription>
                Erstellen und verwalten Sie Tags zur Kategorisierung Ihrer Ausrüstung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TagManager 
                tags={tags} 
                onRefresh={handleRefresh} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
