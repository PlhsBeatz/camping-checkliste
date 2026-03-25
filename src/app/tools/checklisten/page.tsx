'use client'

import { useState, useEffect } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { ChecklistenTool } from '@/components/checklisten-tool'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ChecklistenPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)

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

  return (
    <div className="min-h-screen flex">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div
        className={cn(
          'flex-1 transition-all duration-300 min-w-0 overflow-x-hidden',
          'lg:ml-[280px]'
        )}
      >
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          {/* Header - Sticky (analog Urlaube & Packliste-Ansicht) */}
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
                  Checklisten
                </h1>
              </div>
            </div>
          </div>

          <ChecklistenTool />
        </div>
      </div>
    </div>
  )
}
