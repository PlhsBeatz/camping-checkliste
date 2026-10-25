import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BrandIconWellProps = {
  /** Material Icons Ligatur-Name; alternativ `children` (z. B. Lucide). */
  icon?: string
  children?: ReactNode
  /** Destruktiver Hinweis (Wartung kritisch, Gewicht). */
  danger?: boolean
  className?: string
  iconClassName?: string
}

/**
 * Dezenter Brand-Akzent für Overview-/Einstiegs-Icons – ohne Fotos oder Illustrationen.
 */
export function BrandIconWell({
  icon,
  children,
  danger = false,
  className,
  iconClassName,
}: BrandIconWellProps) {
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        danger ? 'bg-destructive/10 text-destructive' : 'bg-brand-muted text-brand-heading',
        className
      )}
      aria-hidden
    >
      {icon ? (
        <span className={cn('material-icons text-xl leading-none', iconClassName)}>{icon}</span>
      ) : (
        children
      )}
    </span>
  )
}
