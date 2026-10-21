'use client'

import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type BrandFabProps = {
  onClick: () => void
  'aria-label'?: string
  children?: ReactNode
  className?: string
  /** Button-Klassen (zusätzlich zum Standard) */
  buttonClassName?: string
  /**
   * Packliste: FAB nach links versetzen, wenn die Packprofil-Sidebar offen ist
   * (`lg:right-[calc(20rem+1.5rem)]`)
   */
  offsetPackSidebar?: boolean
}

/**
 * Einzelner Floating Action Button (56×56, Brand/Primary).
 * Multi-Action: weiterhin `FabMenuM3`.
 */
export function BrandFab({
  onClick,
  'aria-label': ariaLabel = 'Hinzufügen',
  children,
  className,
  buttonClassName,
  offsetPackSidebar = false,
}: BrandFabProps) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-30',
        offsetPackSidebar && 'lg:right-[calc(20rem+1.5rem)]',
        className
      )}
    >
      <Button
        type="button"
        size="icon"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          'h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow',
          'bg-primary hover:bg-primary/90 text-white aspect-square p-0',
          buttonClassName
        )}
      >
        {children ?? <Plus className="h-6 w-6" strokeWidth={2.5} />}
      </Button>
    </div>
  )
}
