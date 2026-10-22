'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageShell, usePageShell } from '@/components/page-shell'
import { BackLink } from '@/components/back-link'
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

/** Sticky-Chrome mit Breadcrumb/Picker – braucht PageShell-Context fürs Menü. */
function ConfigPageChrome({
  isSettingsHub,
  pageTitle,
  headerActions,
}: {
  isSettingsHub: boolean
  pageTitle: string
  headerActions?: ReactNode
}) {
  const { openNav } = usePageShell()

  return (
    <div className="sticky top-0 z-20 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={openNav}
            className="lg:hidden shrink-0"
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {!isSettingsHub ? (
            <BackLink
              href="/einstellungen"
              label="Zurück zu Einstellungen"
              variant="icon"
              visible="lgHidden"
              className="-ml-1"
            />
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
  )
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
    <PageShell
      afterContent={afterContent}
      containerClassName="flex flex-col gap-4 lg:gap-6"
    >
      <ConfigPageChrome
        isSettingsHub={isSettingsHub}
        pageTitle={pageTitle}
        headerActions={headerActions}
      />

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
    </PageShell>
  )
}
