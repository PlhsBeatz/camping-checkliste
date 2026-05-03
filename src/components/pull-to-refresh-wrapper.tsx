'use client'

import { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { cn } from '@/lib/utils'

/**
 * Hüllt eine Listen-Seite in einen Pull-to-refresh-Container ein und ruft beim
 * "Loslassen über Schwelle" `onRefresh` auf.
 *
 * Visuell schiebt sich der Inhalt um den Pull-Wert nach unten und ein Spinner-Indicator
 * wird oberhalb sichtbar. Auf Desktop ist das ein No-Op (keine Touch-Events).
 */
export function PullToRefreshWrapper({
  onRefresh,
  disabled = false,
  children,
  className,
}: {
  onRefresh: () => Promise<void> | void
  disabled?: boolean
  children: ReactNode
  className?: string
}) {
  const { pull, isRefreshing, bind } = usePullToRefresh({
    onRefresh,
    disabled,
  })

  const indicatorOpacity = Math.min(1, pull / 60)
  const indicatorRotate = pull * 4

  return (
    <div className={cn('relative', className)} {...bind}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center transition-opacity"
        style={{
          height: 0,
          opacity: indicatorOpacity,
        }}
      >
        <div
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-gray-200"
          style={{
            transform: `translateY(${Math.max(0, pull - 18)}px)`,
            transition: isRefreshing ? 'transform 200ms ease-out' : undefined,
          }}
        >
          <RefreshCw
            className={cn('h-4 w-4 text-[rgb(45,79,30)]', isRefreshing && 'animate-spin')}
            aria-hidden
            style={{
              transform: !isRefreshing ? `rotate(${indicatorRotate}deg)` : undefined,
            }}
          />
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: !pull || isRefreshing ? 'transform 200ms ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
