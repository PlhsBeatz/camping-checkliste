'use client'

import { useState, useEffect } from 'react'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { ChecklistenTool } from '@/components/checklisten-tool'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

export default function ChecklistenPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)

  useEffect(() => {
    if (!showNavSidebar) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showNavSidebar])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex items-center gap-4 h-14 px-4 bg-white border-b border-gray-200">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Menü öffnen"
            onClick={() => setShowNavSidebar(true)}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-[rgb(45,79,30)]">Checklisten</h1>
        </header>

        <main className="p-4 md:p-6 pt-6 max-w-3xl mx-auto">
          <ChecklistenTool />
        </main>
      </div>
    </div>
  )
}
