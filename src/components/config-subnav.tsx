'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { GroupedNavList } from '@/components/grouped-nav-list'
import {
  SETTINGS_NAV_GROUPS,
  isSettingsNavItemActive,
} from '@/lib/settings-navigation'

interface ConfigSubnavProps {
  className?: string
  /** @deprecated Nur noch grouped; Alias „mobile“/„sidebar“ bleiben kompatibel */
  variant?: 'grouped' | 'mobile' | 'sidebar'
  /** Nach Navigation (z. B. Bottom-Sheet schließen) */
  onNavigate?: () => void
}

function useVisibleSettingsGroups() {
  const { canAccessConfig, canAccessSystemAdmin } = useAuth()

  return useMemo(
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
}

/** Einheitliche gruppierte Settings-Nav (Hub, Desktop-Spalte, Drawer). */
export function ConfigSubnav({
  className,
  onNavigate,
}: ConfigSubnavProps) {
  const pathname = usePathname()
  const visibleGroups = useVisibleSettingsGroups()

  return (
    <GroupedNavList
      aria-label="Einstellungen"
      className={className}
      onNavigate={onNavigate}
      groups={visibleGroups.map((group) => ({
        label: group.label,
        items: group.items.map((item) => ({
          label: item.label,
          href: item.href,
          active: isSettingsNavItemActive(pathname, item.href),
        })),
      }))}
    />
  )
}
