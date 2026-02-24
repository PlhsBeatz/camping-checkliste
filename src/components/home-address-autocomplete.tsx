'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

type GooglePlaceLocation = {
  lat: () => number
  lng: () => number
}

type GooglePlaceGeometry = {
  location?: GooglePlaceLocation
}

type GooglePlaceResult = {
  formatted_address?: string
  geometry?: GooglePlaceGeometry
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

interface HomeAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: { address: string; lat: number | null; lng: number | null }) => void
  placeholder?: string
}

export function HomeAddressAutocomplete(props: HomeAddressAutocompleteProps) {
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
        types: ['geocode'],
        fields: ['formatted_address', 'geometry'],
      })

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place) return
        const formatted = place.formatted_address || value
        const location = place.geometry?.location
        const lat = location ? location.lat() : null
        const lng = location ? location.lng() : null
        onChange(formatted)
        onResolve({ address: formatted, lat, lng })
      })
    } catch {
      // Falls Google Places nicht korrekt initialisiert werden kann, fällt die Komponente auf reinen Textinput zurück
      setPlacesAvailable(false)
    }
  }, [scriptLoaded, placesAvailable, onChange, onResolve, value])

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => {
        const v = e.target.value
        onChange(v)
        if (!placesAvailable) {
          onResolve({ address: v, lat: null, lng: null })
        }
      }}
      placeholder={placeholder ?? 'Heimatadresse eingeben'}
      autoComplete="off"
    />
  )
}

