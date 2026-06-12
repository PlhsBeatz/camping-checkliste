'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { ConfigSubnav } from '@/components/config-subnav'
import { ConfigMobileSectionPicker } from '@/components/config-mobile-section-picker'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/utils'

interface ConfigPageLayoutProps {
  children: ReactNode
  headerActions?: ReactNode
  afterContent?: ReactNode
  /** Nur System-Admin (z. B. Integrationen) */
  requireSystemAdmin?: boolean
}

export function ConfigPageLayout({
  children,
  headerActions,
  afterContent,
  requireSystemAdmin = false,
}: ConfigPageLayoutProps) {
  const { canAccessConfig, canAccessSystemAdmin, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const isConfigHub = pathname === '/konfiguration'

  useEffect(() => {
    if (loading) return
    if (!canAccessConfig) {
      router.replace('/')
      return
    }
    if (requireSystemAdmin && !canAccessSystemAdmin) {
      router.replace('/konfiguration')
    }
  }, [loading, canAccessConfig, canAccessSystemAdmin, requireSystemAdmin, router])

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

  if (loading || !canAccessConfig || (requireSystemAdmin && !canAccessSystemAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      <div
        className={cn(
          'flex-1 min-w-0 min-h-screen transition-all duration-300',
          'lg:ml-[280px]'
        )}
      >
        <div className="container mx-auto p-4 md:p-6 max-w-full flex flex-col gap-4 lg:gap-6">
          {/* Header über gesamte Breite (inkl. Bereich des Unter-Menüs) */}
          <div className="sticky top-0 z-10 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNavSidebar(true)}
                  className="lg:hidden shrink-0"
                  aria-label="Menü"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading truncate">
                  Konfiguration
                </h1>
              </div>
              {headerActions}
            </div>

            {!isConfigHub && <ConfigMobileSectionPicker />}
          </div>

          <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-stretch">
            {/* Desktop: Unter-Menü links unterhalb des Headers */}
            <aside className="hidden lg:flex lg:w-56 xl:w-60 shrink-0 flex-col border-r border-border pr-4 min-h-[calc(100dvh-7rem)]">
              <ConfigSubnav variant="sidebar" className="py-2" />
            </aside>

            <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-0">
              {isConfigHub && (
                <div className="lg:hidden">
                  <ConfigSubnav variant="mobile" />
                </div>
              )}

              <div>{children}</div>
            </div>
          </div>
        </div>
      </div>

      {afterContent}
    </div>
  )
}
