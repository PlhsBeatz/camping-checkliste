'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type GroupedNavItem = {
  label: string
  href: string
  active?: boolean
}

export type GroupedNavGroup = {
  label: string
  items: GroupedNavItem[]
}

interface GroupedNavListProps {
  groups: GroupedNavGroup[]
  /** Nach Navigation (z. B. Drawer schließen) */
  onNavigate?: () => void
  className?: string
  /** aria-label für das nav-Element */
  'aria-label'?: string
}

/**
 * iOS-/Settings-artige gruppierte Listen: eine Karte pro Gruppe, Zeilen mit Trennern.
 * Kanonisches Muster für Einstellungen-Hub und Mobile-Drawer.
 */
export function GroupedNavList({
  groups,
  onNavigate,
  className,
  'aria-label': ariaLabel = 'Navigation',
}: GroupedNavListProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('space-y-5', className)}>
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {group.label}
          </h3>
          <ul className="rounded-xl border border-subtle bg-card overflow-hidden shadow-sm">
            {group.items.map((item, index) => (
              <li key={item.href}>
                {index > 0 ? (
                  <div className="border-t border-subtle mx-4" aria-hidden />
                ) : null}
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors',
                    item.active
                      ? 'bg-muted text-brand-heading'
                      : 'text-foreground hover:bg-muted/60 active:bg-muted'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
