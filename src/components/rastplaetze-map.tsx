'use client'

import dynamic from 'next/dynamic'
import type { RastplaetzeMapProps } from '@/components/rastplaetze-map.impl'

function MapLoadingPlaceholder({ height = 280 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg border border-border bg-muted"
      style={{ height }}
      aria-hidden
    />
  )
}

const RastplaetzeMapImpl = dynamic(
  () => import('@/components/rastplaetze-map.impl').then((m) => m.RastplaetzeMap),
  {
    ssr: false,
    loading: () => <MapLoadingPlaceholder />,
  }
)

export function RastplaetzeMap(props: RastplaetzeMapProps) {
  return <RastplaetzeMapImpl {...props} />
}

export type { RastplaetzeMapProps }
