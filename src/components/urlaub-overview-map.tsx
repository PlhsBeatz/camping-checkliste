'use client'

import dynamic from 'next/dynamic'
import type { UrlaubOverviewMapProps } from '@/components/urlaub-overview-map.impl'

function MapLoadingPlaceholder() {
  return (
    <div className="urlaub-map-root w-full max-md:-mx-4 max-md:w-[calc(100%+2rem)] md:mx-0 md:w-full">
      <div
        className="aspect-[2/1] animate-pulse border border-border bg-muted max-md:rounded-none md:aspect-[3/1] md:rounded-xl"
        aria-hidden
      />
    </div>
  )
}

const UrlaubOverviewMapImpl = dynamic(
  () => import('@/components/urlaub-overview-map.impl').then((m) => m.UrlaubOverviewMap),
  { ssr: false, loading: () => <MapLoadingPlaceholder /> }
)

export function UrlaubOverviewMap(props: UrlaubOverviewMapProps) {
  return <UrlaubOverviewMapImpl {...props} />
}

export type { UrlaubOverviewMapProps }
