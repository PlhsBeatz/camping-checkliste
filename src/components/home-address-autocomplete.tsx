'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { importGoogleMapsLibrary, loadGoogleMapsScript } from '@/lib/google-maps-script'

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
  const [placesAvailable, setPlacesAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    void (async () => {
      const loaded = await loadGoogleMapsScript()
      if (cancelled || !loaded) return

      const places = await importGoogleMapsLibrary<{ PlaceAutocompleteElement?: new (opts?: unknown) => HTMLElement }>('places')
      if (cancelled) return
      setPlacesAvailable(!!places?.PlaceAutocompleteElement)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // PlaceAutocompleteElement nutzen
  useEffect(() => {
    if (!placesAvailable || !containerRef.current) return
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

    el.className = 'w-full max-w-full'
    Object.assign(el.style, {
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
      height: '40px',
      borderRadius: '6px',
      boxSizing: 'border-box',
    })

    if (value) {
      ;(el as unknown as { value?: string }).value = value
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
  // value bewusst nicht in deps: wird im separaten Effect synchron gehalten; sonst würde das Element bei jeder Änderung neu erstellt
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesAvailable, onChange, onResolve, placeholder])

  // Wert vom Prop ins Google-Element übernehmen (ohne Effect neu zu starten)
  useEffect(() => {
    if (!placesAvailable || !elementRef.current) return
    const el = elementRef.current as unknown as { value?: string }
    if (el.value !== value) el.value = value
  }, [value, placesAvailable])

  // Fallback: normales Input, wenn Places nicht verfügbar ist
  if (!placesAvailable) {
    return (
      <div className="min-w-0 w-full">
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value
            onChange(v)
            onResolve({ address: v, lat: null, lng: null })
          }}
          placeholder={placeholder ?? 'Heimatadresse eingeben'}
          autoComplete="off"
          className="min-w-0 w-full max-w-full box-border"
        />
      </div>
    )
  }

  return <div ref={containerRef} className="w-full min-w-0 max-w-full box-border" />
}

