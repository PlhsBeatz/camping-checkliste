import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export type ListTileProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Rendert Kind-Element mit denselben Klassen (Radix Slot) */
  asChild?: boolean
}

/**
 * Kanonische Entity-Zeile: `rounded-xl border-subtle shadow-sm`.
 * Zusätzliche Layout-Klassen (flex, gap, padding) über `className`.
 */
export const ListTile = React.forwardRef<HTMLDivElement, ListTileProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div'
    return (
      <Comp
        ref={ref}
        className={cn(
          'bg-card rounded-xl border border-subtle shadow-sm px-4 py-3',
          className
        )}
        {...props}
      />
    )
  }
)
ListTile.displayName = 'ListTile'
