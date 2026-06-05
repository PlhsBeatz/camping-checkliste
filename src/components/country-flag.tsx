'use client'

import { useState } from 'react'
import { countryIso2ForLandName } from '@/lib/country-flag-emoji'
import { cn } from '@/lib/utils'

type CountryFlagProps = {
  land: string
  className?: string
  /** Anzeigebreite in px (Höhe 3:4) */
  width?: number
}

/** flagcdn unterstützt nur feste Größen – keine beliebigen w{N}. */
function flagCdnSrc(iso2: string): string {
  return `https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`
}

function Iso2Badge({
  iso2,
  width,
  className,
}: {
  iso2: string
  width: number
  className?: string
}) {
  const height = Math.round((width * 3) / 4)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[2px] border border-subtle bg-card px-0.5 text-[9px] font-bold leading-none text-muted-foreground',
        className
      )}
      style={{ width, height, minWidth: width }}
      aria-hidden
    >
      {iso2}
    </span>
  )
}

/**
 * Länderflagge als Bild (flagcdn). Windows rendert Flaggen-Emoji oft nur als „DE“-Kürzel.
 * Bei Ladefehler oder offline: ISO-Kürzel als Badge.
 */
export function CountryFlag({ land, className, width = 20 }: CountryFlagProps) {
  const iso2 = countryIso2ForLandName(land)
  const [failed, setFailed] = useState(false)

  if (!iso2) return null

  const height = Math.round((width * 3) / 4)

  if (failed) {
    return <Iso2Badge iso2={iso2} width={width} className={className} />
  }

  return (
    <img
      src={flagCdnSrc(iso2)}
      srcSet={`https://flagcdn.com/32x24/${iso2.toLowerCase()}.png 2x`}
      width={width}
      height={height}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('inline-block shrink-0 rounded-[2px] object-cover', className)}
      style={{ width, height }}
    />
  )
}
