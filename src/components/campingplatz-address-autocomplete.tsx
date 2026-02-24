'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

type GooglePlaceLocation = {
  lat: () => number
  lng: () => number
}

type GooglePlaceGeometry = {
  location?: GooglePlaceLocation
}

type GoogleAddressComponent = {
  long_name?: string
  short_name?: string
  types?: string[]
}

type GooglePlaceResult = {
  formatted_address?: string
  geometry?: GooglePlaceGeometry
  address_components?: GoogleAddressComponent[]
}

type GoogleAutocomplete = {
  addListener: (event: string, handler: () => void) => void
  getPlace: () => GooglePlaceResult
}

type GoogleMapsPlaces = {
  Autocomplete: new (input: HTMLInputElement, opts: unknown) => GoogleAutocomplete
}

declare const google: {
  maps: {
    places: GoogleMapsPlaces
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

function pickComponent(
  comps: GoogleAddressComponent[] | undefined,
  type: string,
  which: 'long_name' | 'short_name' = 'long_name'
): string | null {
  if (!comps?.length) return null
  for (const c of comps) {
    if (c?.types?.includes(type)) {
      const v = c[which]
      if (v && String(v).trim()) return String(v).trim()
    }
  }
  return null
}

function deriveOrt(comps: GoogleAddressComponent[] | undefined): string | null {
  // Priorität: locality → postal_town (UK) → admin_area_level_3 → admin_area_level_2 → sublocality
  return (
    pickComponent(comps, 'locality') ??
    pickComponent(comps, 'postal_town') ??
    pickComponent(comps, 'administrative_area_level_3') ??
    pickComponent(comps, 'administrative_area_level_2') ??
    pickComponent(comps, 'sublocality') ??
    pickComponent(comps, 'sublocality_level_1')
  )
}

interface CampingplatzAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: CampingplatzAddressResolve) => void
  placeholder?: string
}

export const CampingplatzAddressAutocomplete = forwardRef<
  HTMLInputElement,
  CampingplatzAddressAutocompleteProps
>(function CampingplatzAddressAutocomplete(props, forwardedRef) {
  const { value, onChange, onResolve, placeholder } = props
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [placesAvailable, setPlacesAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const anyWindow = window as typeof window & {
      google?: { maps?: { places?: unknown } }
    }
    const existing = anyWindow.google?.maps?.places
    if (existing) {
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=de`
    script.async = true
    script.onload = () => {
      setScriptLoaded(true)
      const w = window as typeof window & {
        google?: { maps?: { places?: unknown } }
      }
      setPlacesAvailable(!!w.google?.maps?.places)
    }
    script.onerror = () => {
      setScriptLoaded(true)
      setPlacesAvailable(false)
    }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!scriptLoaded || !placesAvailable || !inputRef.current) return

    try {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        // Campingplätze sind meistens "establishments" (Name → Treffer schneller als bei reinem geocode)
        types: ['establishment'],
        fields: ['formatted_address', 'geometry', 'address_components'],
      })

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place) return
        const formatted = place.formatted_address || value
        const location = place.geometry?.location
        const lat = location ? location.lat() : null
        const lng = location ? location.lng() : null
        const comps = place.address_components
        const land = pickComponent(comps, 'country', 'long_name')
        const bundesland = pickComponent(comps, 'administrative_area_level_1', 'long_name')
        const ort = deriveOrt(comps)

        onChange(formatted)
        onResolve({ address: formatted, lat, lng, ort, bundesland, land })
      })
    } catch {
      setPlacesAvailable(false)
    }
  }, [scriptLoaded, placesAvailable, onChange, onResolve, value])

  return (
    <Input
      ref={(el) => {
        inputRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) forwardedRef.current = el
      }}
      value={value}
      onChange={(e) => {
        const v = e.target.value
        onChange(v)
        if (!placesAvailable) {
          onResolve({ address: v, lat: null, lng: null, ort: null, bundesland: null, land: null })
        }
      }}
      placeholder={placeholder ?? 'Adresse eingeben'}
      autoComplete="off"
    />
  )
})

