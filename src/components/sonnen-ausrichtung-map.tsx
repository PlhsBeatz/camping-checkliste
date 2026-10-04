'use client'

import dynamic from 'next/dynamic'
import type { SonnenAusrichtungMapProps } from '@/components/sonnen-ausrichtung-map.impl'

function MapLoadingPlaceholder({
  heightClassName = 'h-[420px] md:h-[580px]',
}: {
  heightClassName?: string
}) {
  return (
    <div
      className={`w-full animate-pulse rounded-xl border border-border bg-muted ${heightClassName}`}
      aria-hidden
    />
  )
}

const SonnenAusrichtungMapImpl = dynamic(
  () => import('@/components/sonnen-ausrichtung-map.impl').then((m) => m.SonnenAusrichtungMap),
  {
    ssr: false,
    loading: () => <MapLoadingPlaceholder />,
  }
)

export function SonnenAusrichtungMap(props: SonnenAusrichtungMapProps) {
  return <SonnenAusrichtungMapImpl {...props} />
}

export type { SonnenAusrichtungMapProps }
