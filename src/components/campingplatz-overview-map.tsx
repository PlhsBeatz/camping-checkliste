'use client'

import dynamic from 'next/dynamic'
import type { CampingplatzOverviewMapProps } from '@/components/campingplatz-overview-map.impl'

function MapLoadingPlaceholder() {
  return (
    <div className="campingplatz-map-root w-full max-md:-mx-4 max-md:w-[calc(100%+2rem)] md:mx-0 md:w-full">
      <div
        className="aspect-[2/1] animate-pulse border border-border bg-muted max-md:rounded-none md:aspect-[3/1] md:rounded-xl"
        aria-hidden
      />
    </div>
  )
}

const CampingplatzOverviewMapImpl = dynamic(
  () =>
    import('@/components/campingplatz-overview-map.impl').then((m) => m.CampingplatzOverviewMap),
  { ssr: false, loading: () => <MapLoadingPlaceholder /> }
)

export function CampingplatzOverviewMap(props: CampingplatzOverviewMapProps) {
  return <CampingplatzOverviewMapImpl {...props} />
}

export type { CampingplatzOverviewMapProps }
