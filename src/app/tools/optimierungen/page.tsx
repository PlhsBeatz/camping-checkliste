'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { OptimierungenTool } from '@/components/optimierungen-tool'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'

export default function OptimierungenPage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const headerTrailingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loading) return
    if (!canAccessConfig) {
      router.replace('/')
    }
  }, [loading, canAccessConfig, router])

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

  if (loading || !canAccessConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 max-w-full flex flex-col gap-0">
          <div className="sticky top-0 z-30 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNavSidebar(true)}
                  className="lg:hidden shrink-0"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading truncate">
                    Optimierungen
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                    Ideen und geplante Anpassungen
                  </p>
                </div>
              </div>
              <div
                ref={headerTrailingRef}
                className="flex shrink-0 items-center justify-end min-h-9"
              />
            </div>
          </div>

          <OptimierungenTool headerTrailingRef={headerTrailingRef} />
        </div>
      </div>
    </div>
  )
}
