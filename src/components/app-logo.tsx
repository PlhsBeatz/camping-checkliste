'use client'

import { Tent } from 'lucide-react'

interface AppLogoProps {
  /** Wenn true, wird die Version "v 0.3 PRO" angezeigt (z.B. in der Sidebar) */
  showVersion?: boolean
  /** Größe: compact (10x10 wie Sidebar), default (14x14 für Auth-Seiten) */
  size?: 'compact' | 'default'
  /** Layout: inline (Sidebar), centered (Auth-Seiten mit Icon über Text) */
  variant?: 'inline' | 'centered'
  /** Zusätzliche Beschriftung unter dem Logo (z.B. "Anmelden") */
  subtitle?: React.ReactNode
  className?: string
}

/**
 * Einheitliches CAMPPACK-Logo – wie in der Navigation-Sidebar.
 * Wird an allen Stellen der App verwendet (Sidebar, Login, Bootstrap, etc.).
 */
export function AppLogo({
  showVersion = false,
  size = 'compact',
  variant = 'inline',
  subtitle,
  className = '',
}: AppLogoProps) {
  const isCompact = size === 'compact'
  const iconSize = isCompact ? 'w-6 h-6' : 'w-8 h-8'
  const boxSize = isCompact ? 'w-10 h-10' : 'w-14 h-14'
  const borderRadius = isCompact ? 'rounded-lg' : 'rounded-xl'

  const iconBox = (
    <div
      className={`${boxSize} ${borderRadius} bg-[rgb(45,79,30)] flex items-center justify-center flex-shrink-0`}
    >
      <Tent className={`${iconSize} text-white`} />
    </div>
  )

  const textBlock = (
    <div className={variant === 'centered' ? 'text-center' : ''}>
      <h1 className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-[rgb(45,79,30)] leading-tight`}>
        CAMPPACK
      </h1>
      {showVersion && (
        <p className="text-xs text-[rgb(45,79,30)]/60">v 0.3 PRO</p>
      )}
      {subtitle && (
        <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
      )}
    </div>
  )

  if (variant === 'centered') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        {iconBox}
        {textBlock}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {iconBox}
      {textBlock}
    </div>
  )
}
