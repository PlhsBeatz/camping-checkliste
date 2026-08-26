'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  /** Optionaler Seitentitel in der mobilen Kopfzeile */
  title?: string
}

export function AppShell({ children, title }: AppShellProps) {
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
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      <div className={cn('flex-1 transition-all duration-300 min-w-0', 'lg:ml-[280px]')}>
        <div className="sticky top-0 z-20 flex items-center gap-3 bg-card shadow px-4 py-3 lg:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowNavSidebar(true)}
            className="flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {title ? (
            <h1 className="text-lg font-semibold text-brand-heading truncate">{title}</h1>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}
