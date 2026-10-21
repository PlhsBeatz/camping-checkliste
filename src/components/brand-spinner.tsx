import { cn } from '@/lib/utils'

export type BrandSpinnerProps = {
  /** Optionaler Text unter dem Spinner */
  label?: string
  className?: string
  /** Nur der Ring, ohne äußeren Flex-Container */
  bare?: boolean
  size?: 'md' | 'lg'
}

/**
 * Full-page / Block-Ladeindikator mit Brand-Primary (kein Hardcoded-RGB).
 */
export function BrandSpinner({
  label,
  className,
  bare = false,
  size = 'lg',
}: BrandSpinnerProps) {
  const ring = (
    <div
      className={cn(
        'animate-spin rounded-full border-4 border-primary border-t-transparent',
        size === 'lg' ? 'h-12 w-12' : 'h-8 w-8'
      )}
      role="status"
      aria-label={label ?? 'Wird geladen'}
    />
  )

  if (bare) return ring

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 gap-4',
        className
      )}
    >
      {ring}
      {label ? (
        <p className="text-muted-foreground animate-pulse">{label}</p>
      ) : null}
    </div>
  )
}
