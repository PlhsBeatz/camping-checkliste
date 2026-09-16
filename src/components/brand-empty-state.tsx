import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BrandEmptyStateProps = {
  illustration: ReactNode
  title: string
  description: ReactNode
  children?: ReactNode
  className?: string
}

/** Zentrierter Empty State im Markenstil (Illustration + Überschrift + Text). */
export function BrandEmptyState({
  illustration,
  title,
  description,
  children,
  className,
}: BrandEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center px-4 py-12 text-center',
        className
      )}
    >
      <div className="mb-6">{illustration}</div>
      <h2 className="text-xl font-semibold tracking-tight text-brand-heading sm:text-2xl">
        {title}
      </h2>
      <div className="mt-2 max-w-sm text-sm text-muted-foreground sm:text-base">
        {description}
      </div>
      {children ? <div className="mt-6 flex w-full max-w-sm flex-col items-center">{children}</div> : null}
    </div>
  )
}
