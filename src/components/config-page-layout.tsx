'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { ConfigSubnav } from '@/components/config-subnav'
import { ConfigMobileSectionPicker } from '@/components/config-mobile-section-picker'
import { useAuth } from '@/components/auth-provider'
import { getActiveSettingsItem } from '@/lib/settings-navigation'
import { cn } from '@/lib/utils'

/** Nav-Spalte – gleiche Breite auf Hub (mobil) und Desktop-Unterseiten */
export const SETTINGS_NAV_COLUMN_CLASS = 'w-full lg:w-56 xl:w-60'

interface ConfigPageLayoutProps {
  children: ReactNode
  headerActions?: ReactNode
  afterContent?: ReactNode
  /** Stammdaten/Admin-Seiten: erfordert canAccessConfig */
  requireConfig?: boolean
  /** Nur System-Admin (z. B. Integrationen) */
  requireSystemAdmin?: boolean
}

export function ConfigPageLayout({
  children,
  headerActions,
  afterContent,
  requireConfig = true,
  requireSystemAdmin = false,
}: ConfigPageLayoutProps) {
  const { user, canAccessConfig, canAccessSystemAdmin, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const isSettingsHub =
    pathname === '/einstellungen' || pathname === '/konfiguration'
  const activeItem = getActiveSettingsItem(pathname)
  const pageTitle = isSettingsHub
    ? 'Einstellungen'
    : (activeItem?.label ?? 'Einstellungen')

  const needsConfig = requireConfig || requireSystemAdmin

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (needsConfig && !canAccessConfig) {
      router.replace('/einstellungen')
      return
    }
    if (requireSystemAdmin && !canAccessSystemAdmin) {
      router.replace('/einstellungen')
    }
  }, [
    loading,
    user,
    needsConfig,
    canAccessConfig,
    canAccessSystemAdmin,
    requireSystemAdmin,
    router,
  ])

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

  const blocked =
    loading ||
    !user ||
    (needsConfig && !canAccessConfig) ||
    (requireSystemAdmin && !canAccessSystemAdmin)

  if (blocked) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground text-sm">Wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh max-w-full overflow-x-clip">
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      <div
        className={cn(
          'flex-1 min-h-dvh min-w-0 transition-all duration-300',
          'lg:ml-[280px]'
        )}
      >
        <div className="container mx-auto p-4 md:p-6 max-w-full flex flex-col gap-4 lg:gap-6">
          <div className="sticky top-0 z-20 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNavSidebar(true)}
                  className="lg:hidden shrink-0"
                  aria-label="Menü"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                {!isSettingsHub ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="lg:hidden shrink-0 -ml-1"
                  >
                    <Link href="/einstellungen" aria-label="Zurück zu Einstellungen">
                      <ArrowLeft className="h-5 w-5" />
                    </Link>
                  </Button>
                ) : null}
                <div className="min-w-0">
                  {!isSettingsHub ? (
                    <p className="hidden lg:block text-xs text-muted-foreground mb-0.5">
                      <Link
                        href="/einstellungen"
                        className="hover:text-foreground transition-colors"
                      >
                        Einstellungen
                      </Link>
                    </p>
                  ) : null}
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading truncate">
                    {pageTitle}
                  </h1>
                </div>
              </div>
              {headerActions}
            </div>

            {!isSettingsHub && <ConfigMobileSectionPicker />}
          </div>

          <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
            <aside
              className={cn('hidden lg:block shrink-0', SETTINGS_NAV_COLUMN_CLASS)}
            >
              <ConfigSubnav />
            </aside>

            <div className="flex-1 min-w-0 flex flex-col gap-4 lg:gap-0">
              <div>{children}</div>
            </div>
          </div>
        </div>
      </div>

      {afterContent}
    </div>
  )
}
