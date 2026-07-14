'use client'

import { useMemo, useState } from 'react'
import type { Rastplatz } from '@/lib/db'
import {
  isPointInSegmentCorridor,
  type TravelLegPhase,
  type TravelSegment,
} from '@/lib/travel-segment'
import {
  ADAC_MAX_WAYPOINTS,
  GOOGLE_MAPS_MAX_WAYPOINTS_MOBILE,
  openSegmentInAdacMaps,
  openSegmentInGoogleMaps,
} from '@/lib/maps-export'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ThumbsUp, ThumbsDown, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { merkmalLabel } from '@/lib/rastplatz-merkmale'
import { cn } from '@/lib/utils'

interface SegmentRastSuggestionsProps {
  segment: TravelSegment
  rastplaetze: Rastplatz[]
  phase?: TravelLegPhase
}

export function SegmentRastSuggestions({
  segment,
  rastplaetze,
  phase = 'next',
}: SegmentRastSuggestionsProps) {
  const [open, setOpen] = useState(false)

  const alongRoute = useMemo(() => {
    return rastplaetze.filter((r) => {
      if (r.is_archived || r.lat == null || r.lng == null) return false
      return isPointInSegmentCorridor(
        { lat: r.lat, lng: r.lng },
        segment.from,
        segment.to
      )
    })
  }, [rastplaetze, segment])

  const empfehlungen = alongRoute.filter((r) => r.bewertung === 'empfehlung')
  const noGos = alongRoute.filter((r) => r.bewertung === 'no_go')

  if (alongRoute.length === 0) return null

  const openGoogleWithWaypoints = () => {
    openSegmentInGoogleMaps(segment, rastplaetze, GOOGLE_MAPS_MAX_WAYPOINTS_MOBILE)
  }

  const openAdacWithWaypoints = () => {
    openSegmentInAdacMaps(segment, rastplaetze, ADAC_MAX_WAYPOINTS)
  }

  const summaryParts = [
    `${alongRoute.length} Rastplatz${alongRoute.length === 1 ? '' : 'e'}`,
    empfehlungen.length > 0
      ? `${empfehlungen.length} Empfehlung${empfehlungen.length === 1 ? '' : 'en'}`
      : null,
  ].filter(Boolean)

  const content = (
    <div className="space-y-1">
      {empfehlungen.map((r) => (
        <div
          key={r.id}
          className="text-xs flex items-center gap-1 text-green-800"
        >
          <ThumbsUp className="h-3 w-3 shrink-0" />
          <span className="truncate">{r.name}</span>
          {r.merkmale.slice(0, 2).map((m) => (
            <span key={m} className="text-[10px] opacity-70">
              · {merkmalLabel(m)}
            </span>
          ))}
        </div>
      ))}
      {noGos.map((r) => (
        <div key={r.id} className="text-xs flex items-center gap-1 text-red-700 line-through opacity-80">
          <ThumbsDown className="h-3 w-3 shrink-0" />
          <span className="truncate">{r.name}</span>
        </div>
      ))}
      {empfehlungen.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openGoogleWithWaypoints}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Google Maps
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openAdacWithWaypoints}>
            <ExternalLink className="h-3 w-3 mr-1" />
            ADAC
          </Button>
        </div>
      )}
      {empfehlungen.length > 3 && (
        <p className={cn('text-[10px] text-muted-foreground')}>
          Google Maps (mobil): max. 3 Zwischenziele — es werden die ersten entlang der Strecke genutzt.
        </p>
      )}
    </div>
  )

  if (phase === 'next') {
    return (
      <div className="ml-8 mr-2 mb-2 pl-2 border-l-2 border-dashed border-muted-foreground/30 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Rastplätze entlang der Strecke</p>
        {content}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="ml-8 mr-2 mb-2">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md py-1 pl-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>Rastplätze entlang der Strecke</span>
        <span className="font-normal opacity-80">({summaryParts.join(' · ')})</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 pl-2 border-l-2 border-dashed border-muted-foreground/30">
          {content}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
