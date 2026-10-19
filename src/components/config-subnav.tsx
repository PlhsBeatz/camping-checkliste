'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import {
  SETTINGS_NAV_GROUPS,
  isSettingsNavItemActive,
} from '@/lib/settings-navigation'
import { cn } from '@/lib/utils'

interface ConfigSubnavProps {
  className?: string
  /** Kompaktere Darstellung in der Desktop-Spalte */
  variant?: 'sidebar' | 'mobile'
  /** Nach Navigation (z. B. Bottom-Sheet schließen) */
  onNavigate?: () => void
}

function ConfigGroupHeading({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
      {label}
    </h3>
  )
}

export function ConfigSubnav({
  className,
  variant = 'mobile',
  onNavigate,
}: ConfigSubnavProps) {
  const pathname = usePathname()
  const { canAccessConfig, canAccessSystemAdmin } = useAuth()
  const isSidebar = variant === 'sidebar'

  const visibleGroups = useMemo(
    () =>
      SETTINGS_NAV_GROUPS.map((group) => {
        if (group.configOnly && !canAccessConfig) return { ...group, items: [] }
        if (group.systemAdminOnly && !canAccessSystemAdmin) {
          return { ...group, items: [] }
        }
        return {
          ...group,
          items: group.items.filter((item) => {
            if (item.systemAdminOnly && !canAccessSystemAdmin) return false
            if (item.configOnly && !canAccessConfig) return false
            return true
          }),
        }
      }).filter((group) => group.items.length > 0),
    [canAccessConfig, canAccessSystemAdmin]
  )

  return (
    <nav
      aria-label="Einstellungen"
      className={cn(
        isSidebar ? 'w-full space-y-6' : 'space-y-4',
        className
      )}
    >
      {visibleGroups.map((group, groupIndex) => (
        <div key={group.label}>
          {groupIndex > 0 && (
            <div
              className={cn(
                'border-t border-border',
                isSidebar ? 'mb-6' : 'mb-4'
              )}
            />
          )}
          <ConfigGroupHeading label={group.label} />
          <ul className={cn(isSidebar ? 'space-y-1' : 'space-y-2')}>
            {group.items.map((item) => {
              const active = isSettingsNavItemActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'block rounded-lg text-sm font-medium tracking-wide transition-colors',
                      isSidebar
                        ? 'px-3 py-2'
                        : 'px-4 py-3.5 border border-subtle bg-card active:bg-muted',
                      active
                        ? 'bg-[rgb(45,79,30)] text-white'
                        : isSidebar
                          ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
