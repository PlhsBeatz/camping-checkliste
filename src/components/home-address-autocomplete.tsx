'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

interface HomeAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: { address: string; lat: number | null; lng: number | null }) => void
  placeholder?: string
}

export function HomeAddressAutocomplete(props: HomeAddressAutocompleteProps) {
  const { value, onChange, onResolve, placeholder } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [placesAvailable, setPlacesAvailable] = useState(false)

  // Gemeinsames Laden des JS-SDK
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

  // PlaceAutocompleteElement nutzen
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
      placeholder: placeholder ?? 'Heimatadresse eingeben',
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

    type PlaceLocation = {
      lat?: number | (() => number)
      lng?: number | (() => number)
    }

    type NewPlace = {
      formattedAddress?: string
      location?: PlaceLocation
      fetchFields?: (opts: { fields: string[] }) => Promise<void>
    }

    type GmpSelectEvent = {
      placePrediction?: {
        toPlace: () => Promise<NewPlace>
      }
    }

    const onSelect = async (event: Event) => {
      try {
        const anyEvent = event as unknown as GmpSelectEvent
        if (!anyEvent.placePrediction) return
        const place = await anyEvent.placePrediction.toPlace()
        await place.fetchFields?.({
          fields: ['formattedAddress', 'location'],
        })

        const addr = (place.formattedAddress ?? value) as string
        const loc = place.location
        const lat =
          typeof loc?.lat === 'function' ? loc.lat() : typeof loc?.lat === 'number' ? loc.lat : null
        const lng =
          typeof loc?.lng === 'function' ? loc.lng() : typeof loc?.lng === 'number' ? loc.lng : null

        onChange(addr)
        onResolve({ address: addr, lat, lng })
      } catch {
        setPlacesAvailable(false)
      }
    }

    el.addEventListener('gmp-select', onSelect as EventListener)

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(el)
    elementRef.current = el

    return () => {
      el.removeEventListener('gmp-select', onSelect as EventListener)
      if (el.parentNode) el.parentNode.removeChild(el)
      elementRef.current = null
    }
  }, [scriptLoaded, placesAvailable, onChange, onResolve, value, placeholder])

  // Fallback: normales Input, wenn Places nicht verfügbar ist
  if (!placesAvailable) {
    return (
      <Input
        value={value}
        onChange={(e) => {
          const v = e.target.value
          onChange(v)
          onResolve({ address: v, lat: null, lng: null })
        }}
        placeholder={placeholder ?? 'Heimatadresse eingeben'}
        autoComplete="off"
      />
    )
  }

  return <div ref={containerRef} className="w-full" />
}

