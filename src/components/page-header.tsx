'use client'

import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageShell } from '@/components/page-shell'
import { cn } from '@/lib/utils'

export type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  /** Rechts neben dem Titel (Aktionen, Portale) */
  actions?: ReactNode
  /** Links vom Titel, z. B. BackLink (zusätzlich zum Menu) */
  leading?: ReactNode
  /** Sticky mit Negativ-Margins (Default). false = nur Flex-Zeile ohne Sticky. */
  sticky?: boolean
  className?: string
  /** Extra Klassen auf der inneren Flex-Zeile */
  rowClassName?: string
}

const stickyClasses =
  'sticky top-0 z-20 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6'

/**
 * Kanonischer Seiten-Header: Menu (mobil) + h1 + optional Subtitle/Actions.
 * Muss innerhalb von PageShell gerendert werden.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  leading,
  sticky = true,
  className,
  rowClassName,
}: PageHeaderProps) {
  const { openNav } = usePageShell()

  return (
    <div className={cn(sticky && stickyClasses, className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-3 min-w-0',
          rowClassName
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button
            variant="outline"
            size="icon"
            onClick={openNav}
            className="lg:hidden shrink-0"
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {leading}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading truncate">
              {title}
            </h1>
            {subtitle ? (
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center justify-end gap-2 min-h-9">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
