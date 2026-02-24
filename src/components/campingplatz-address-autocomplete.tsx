'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

type PlaceLocation = {
  lat?: number | (() => number)
  lng?: number | (() => number)
}

type PlaceAddressComponent = {
  longText?: string
  shortText?: string
  long_name?: string
  short_name?: string
  types?: string[]
}

type NewPlace = {
  formattedAddress?: string
  location?: PlaceLocation
  addressComponents?: PlaceAddressComponent[]
  fetchFields?: (opts: { fields: string[] }) => Promise<void>
}

type GmpSelectEvent = {
  placePrediction?: {
    toPlace: () => Promise<NewPlace>
  }
}

export type CampingplatzAddressResolve = {
  address: string
  lat: number | null
  lng: number | null
  ort: string | null
  bundesland: string | null
  land: string | null
}

interface CampingplatzAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: CampingplatzAddressResolve) => void
  placeholder?: string
  onElementReady?: (el: HTMLElement | null) => void
}

// Hilfsfunktionen für neue Place-Klasse
function pickComponent(
  comps: PlaceAddressComponent[] | undefined,
  type: string,
  key: 'longText' | 'shortText' | 'long_name' | 'short_name' = 'longText'
): string | null {
  if (!comps?.length) return null
  for (const c of comps) {
    if (Array.isArray(c.types) && c.types.includes(type)) {
      const v = (c as any)[key] ?? (key === 'longText' ? c.long_name : c.short_name)
      if (v && String(v).trim()) return String(v).trim()
    }
  }
  return null
}

function deriveOrt(comps: PlaceAddressComponent[] | undefined): string | null {
  return (
    pickComponent(comps, 'locality') ??
    pickComponent(comps, 'postal_town') ??
    pickComponent(comps, 'administrative_area_level_3') ??
    pickComponent(comps, 'administrative_area_level_2') ??
    pickComponent(comps, 'sublocality') ??
    pickComponent(comps, 'sublocality_level_1')
  )
}

export function CampingplatzAddressAutocomplete(props: CampingplatzAddressAutocompleteProps) {
  const { value, onChange, onResolve, placeholder, onElementReady } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [placesAvailable, setPlacesAvailable] = useState(false)

  // Gemeinsames Laden des JS-SDK (klassischer Script-Tag, neue Klassen kommen trotzdem mit)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const anyWindow = window as typeof window & {
      google?: { maps?: { places?: unknown } }
    }
    if (anyWindow.google?.maps?.places) {
      setScriptLoaded(true)
      setPlacesAvailable(true)
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setScriptLoaded(true)
      setPlacesAvailable(false)
      return
    }

    const scriptId = 'google-maps-places-script'
    if (document.getElementById(scriptId)) {
      setScriptLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=de&v=weekly`
    script.async = true
    script.onload = () => {
      setScriptLoaded(true)
      const w = window as typeof window & {
        google?: { maps?: { places?: { PlaceAutocompleteElement?: unknown } } }
      }
      setPlacesAvailable(!!w.google?.maps?.places?.PlaceAutocompleteElement)
    }
    script.onerror = () => {
      setScriptLoaded(true)
      setPlacesAvailable(false)
    }
    document.head.appendChild(script)
  }, [])

  // PlaceAutocompleteElement einhängen
  useEffect(() => {
    if (!scriptLoaded || !placesAvailable || !containerRef.current) return
    if (elementRef.current) return

    const w = window as typeof window & {
      google?: { maps?: { places?: { PlaceAutocompleteElement?: new (opts?: unknown) => HTMLElement } } }
    }
    const ctor = w.google?.maps?.places?.PlaceAutocompleteElement
    if (!ctor) return

    const el = new ctor({
      requestedLanguage: 'de',
      includedPrimaryTypes: ['campground', 'rv_park', 'lodging'],
      placeholder: placeholder ?? 'Adresse eingeben',
    } as unknown)

    el.className = 'w-full'
    Object.assign(el.style, {
      width: '100%',
      height: '40px',
      borderRadius: '6px',
      boxSizing: 'border-box',
    })

    if (value) {
      ;(el as any).value = value
    }

    const onSelect = async (event: Event) => {
      try {
        const anyEvent = event as unknown as GmpSelectEvent
        if (!anyEvent.placePrediction) return
        const place = await anyEvent.placePrediction.toPlace()
        await place.fetchFields?.({
          fields: ['formattedAddress', 'location', 'addressComponents'],
        })

        const addr = (place.formattedAddress ?? value) as string
        const loc = place.location
        const lat =
          typeof loc?.lat === 'function' ? loc.lat() : typeof loc?.lat === 'number' ? loc.lat : null
        const lng =
          typeof loc?.lng === 'function' ? loc.lng() : typeof loc?.lng === 'number' ? loc.lng : null
        const comps = place.addressComponents
        const land = pickComponent(comps, 'country')
        const bundesland = pickComponent(comps, 'administrative_area_level_1')
        const ort = deriveOrt(comps)

        onChange(addr)
        onResolve({ address: addr, lat, lng, ort, bundesland, land })
      } catch {
        setPlacesAvailable(false)
      }
    }

    el.addEventListener('gmp-select', onSelect as EventListener)

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(el)
    elementRef.current = el
    onElementReady?.(el)

    return () => {
      el.removeEventListener('gmp-select', onSelect as EventListener)
      if (el.parentNode) el.parentNode.removeChild(el)
      elementRef.current = null
      onElementReady?.(null)
    }
  }, [scriptLoaded, placesAvailable, onChange, onResolve, value, placeholder])

  // Falls der Wert von außen geändert wird (z.B. durch Vorbefüllen mit dem Namen),
  // spiegeln wir ihn in das PlaceAutocompleteElement zurück.
  useEffect(() => {
    if (!elementRef.current) return
    ;(elementRef.current as unknown as { value?: string }).value = value
  }, [value])

  // Fallback: normales Input, wenn Places nicht verfügbar ist
  if (!placesAvailable) {
    return (
      <Input
        value={value}
        onChange={(e) => {
          const v = e.target.value
          onChange(v)
          onResolve({ address: v, lat: null, lng: null, ort: null, bundesland: null, land: null })
        }}
        placeholder={placeholder ?? 'Adresse eingeben'}
        autoComplete="off"
      />
    )
  }

  return <div ref={containerRef} className="w-full" />
}


