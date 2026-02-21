'use client'

import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { TagManager } from '@/components/tag-manager'
import { Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Tag } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { cn } from '@/lib/utils'

export default function TagsPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])

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

  // Fetch Tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags')
        const data = (await res.json()) as ApiResponse<Tag[]>
        if (data.success && data.data) {
          setTags(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      }
    }
    fetchTags()
  }, [])

  const handleRefresh = async () => {
    const res = await fetch('/api/tags')
    const data = (await res.json()) as ApiResponse<Tag[]>
    if (data.success && data.data) {
      setTags(data.data)
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
                  Tags & Labels
                </h1>
              </div>
            </div>
          </div>

          {/* Tag Manager - direkt im Container, keine doppelte Verschachtelung */}
          <div className="mt-4 md:mt-6 border rounded-lg p-4 md:p-6 bg-muted/30">
            <TagManager 
              tags={tags} 
              onRefresh={handleRefresh} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
