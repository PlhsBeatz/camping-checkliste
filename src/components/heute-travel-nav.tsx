'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { HubTravelNav } from '@/lib/hub-travel-nav'
import { openHeuteTravelNav } from '@/lib/open-heute-travel-nav'

export function HeuteTravelNav({ nav }: { nav: HubTravelNav }) {
  const [opening, setOpening] = useState<'google' | 'adac' | null>(null)

  const open = async (provider: 'google' | 'adac') => {
    setOpening(provider)
    try {
      await openHeuteTravelNav(nav, provider)
    } finally {
      setOpening(null)
    }
  }

  return (
    <Card>
      <CardContent className="p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="material-icons text-xl leading-none text-[rgb(45,79,30)] mt-0.5 shrink-0"
            aria-hidden
          >
            directions
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Fahrt
            </p>
            <p className="font-medium text-sm text-brand-heading leading-snug truncate">
              {nav.label}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-8 sm:pl-0 sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={opening !== null}
            aria-label={`Route nach ${nav.segment.to.label} in Google Maps öffnen`}
            onClick={() => void open('google')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Google Maps
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={opening !== null}
            aria-label={`Route nach ${nav.segment.to.label} in der ADAC-Routenplanung öffnen`}
            onClick={() => void open('adac')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            ADAC
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
