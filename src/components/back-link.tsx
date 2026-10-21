'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type BackLinkProps = {
  href: string
  /** Text neben dem Pfeil; bei variant="icon" nur aria-label */
  label?: string
  /**
   * always – alle Breakpoints (Soll für neue Detail-Seiten)
   * mdUp – nur ab md (Legacy-Detail-Muster)
   * lgHidden – nur unter lg (Settings-Unterseiten)
   */
  visible?: 'always' | 'mdUp' | 'lgHidden'
  /** labeled = Outline „Zur Liste“; icon = Ghost-Icon-Button */
  variant?: 'labeled' | 'icon'
  className?: string
  'aria-label'?: string
}

/**
 * Einheitlicher Zurück-Link für Detail-/Settings-Unterseiten.
 */
export function BackLink({
  href,
  label = 'Zur Liste',
  visible = 'always',
  variant = 'labeled',
  className,
  'aria-label': ariaLabel,
}: BackLinkProps) {
  const visibilityClass =
    visible === 'mdUp'
      ? 'hidden md:inline-flex'
      : visible === 'lgHidden'
        ? 'lg:hidden'
        : 'inline-flex'

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        asChild
        className={cn(visibilityClass, 'shrink-0', className)}
      >
        <Link href={href} aria-label={ariaLabel ?? label}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={cn(
        visibilityClass,
        'items-center gap-2 hover:bg-muted',
        className
      )}
    >
      <Link href={href} aria-label={ariaLabel ?? label}>
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}
