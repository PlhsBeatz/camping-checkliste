'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
  displayName?: { text?: string }
  formattedAddress?: string
  location?: PlaceLocation
  addressComponents?: PlaceAddressComponent[]
  photos?: Array<{ name?: string }>
  fetchFields?: (opts: { fields: string[] }) => Promise<void>
}

export type CampingplatzAddressResolve = {
  address: string
  lat: number | null
  lng: number | null
  ort: string | null
  bundesland: string | null
  land: string | null
  /** Anzeigename des Ortes (z. B. für Name-Feld) */
  placeName?: string
}

export type PlacePhotoForPicker = { name: string }

interface CampingplatzAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: CampingplatzAddressResolve) => void
  placeholder?: string
  onElementReady?: (el: HTMLElement | null) => void
  /** Optional: Fotos des gewählten Ortes (max. 10) für Bildauswahl */
  onPlacePhotos?: (photos: PlacePhotoForPicker[]) => void
}

const DEBOUNCE_MS = 400
const STRICT_TYPES: string[] = ['campground', 'rv_park']

function pickComponent(
  comps: PlaceAddressComponent[] | undefined,
  type: string,
  key: 'longText' | 'shortText' | 'long_name' | 'short_name' = 'longText'
): string | null {
  if (!comps?.length) return null
  for (const c of comps) {
    if (Array.isArray(c.types) && c.types.includes(type)) {
      const v = (c as Record<string, unknown>)[key] ?? (key === 'longText' ? c.long_name : c.short_name)
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

type PlacesLib = {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (req: {
      input: string
      sessionToken?: unknown
      includedPrimaryTypes?: string[]
      language?: string
      locationBias?: unknown
      locationRestriction?: unknown
    }) => Promise<{ suggestions: Array<{ placePrediction?: { text?: { text?: string }; mainText?: { text?: string }; secondaryText?: { text?: string }; toPlace: () => Promise<NewPlace> } }> }
  }
  AutocompleteSessionToken: new () => unknown
}

async function loadPlacesLibrary(): Promise<PlacesLib | null> {
  const w = window as typeof window & { google?: { maps?: { importLibrary?: (name: string) => Promise<PlacesLib> } } }
  if (!w.google?.maps?.importLibrary) return null
  try {
    const lib = await w.google.maps.importLibrary('places')
    return lib as PlacesLib
  } catch {
    return null
  }
}

export function CampingplatzAddressAutocomplete(props: CampingplatzAddressAutocompleteProps) {
  const { value, onChange, onResolve, placeholder, onElementReady, onPlacePhotos } = props
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [placesAvailable, setPlacesAvailable] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ placePrediction?: { text?: { text?: string }; mainText?: { text?: string }; secondaryText?: { text?: string }; toPlace: () => Promise<NewPlace> } }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isExpandedSearch, setIsExpandedSearch] = useState(false)
  const sessionTokenRef = useRef<unknown>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestIdRef = useRef(0)
  const placesLibRef = useRef<PlacesLib | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const anyWindow = window as typeof window & { google?: { maps?: unknown } }
    if (anyWindow.google?.maps) {
      setScriptLoaded(true)
      return
    }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setScriptLoaded(true)
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
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!scriptLoaded) return
    let cancelled = false
    loadPlacesLibrary().then((lib) => {
      if (cancelled) return
      placesLibRef.current = lib
      setPlacesAvailable(!!lib?.AutocompleteSuggestion)
    })
    return () => { cancelled = true }
  }, [scriptLoaded])

  const resetSessionToken = useCallback(() => {
    if (!placesLibRef.current?.AutocompleteSessionToken) return
    sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken()
  }, [])

  const fetchSuggestions = useCallback(
    async (input: string, expanded: boolean) => {
      const lib = placesLibRef.current
      if (!lib?.AutocompleteSuggestion || !input.trim()) {
        setSuggestions([])
        setError(null)
        return
      }
      const requestId = ++lastRequestIdRef.current
      setIsLoading(true)
      setError(null)
      try {
        if (!sessionTokenRef.current) resetSessionToken()
        const request: Parameters<PlacesLib['AutocompleteSuggestion']['fetchAutocompleteSuggestions']>[0] = {
          input: input.trim(),
          sessionToken: sessionTokenRef.current ?? undefined,
          language: 'de',
        }
        if (!expanded) {
          request.includedPrimaryTypes = STRICT_TYPES
        }
        const result = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        if (requestId !== lastRequestIdRef.current) return
        setSuggestions(result.suggestions ?? [])
        setError(null)
      } catch (e) {
        if (requestId !== lastRequestIdRef.current) return
        setSuggestions([])
        setError('Suche derzeit nicht verfügbar. Bitte später erneut versuchen.')
      } finally {
        if (requestId === lastRequestIdRef.current) setIsLoading(false)
      }
    },
    [resetSessionToken]
  )

  useEffect(() => {
    if (!placesAvailable || !value.trim()) {
      setSuggestions([])
      setError(null)
      setIsExpandedSearch(false)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      fetchSuggestions(value, isExpandedSearch)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [value, placesAvailable, fetchSuggestions, isExpandedSearch])

  const handleExpandSearch = useCallback(() => {
    setIsExpandedSearch(true)
    if (value.trim() && placesLibRef.current?.AutocompleteSuggestion) {
      setIsLoading(true)
      setError(null)
      const requestId = ++lastRequestIdRef.current
      const request: Parameters<PlacesLib['AutocompleteSuggestion']['fetchAutocompleteSuggestions']>[0] = {
        input: value.trim(),
        sessionToken: sessionTokenRef.current ?? undefined,
        language: 'de',
      }
      placesLibRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions(request).then(
        (result) => {
          if (requestId !== lastRequestIdRef.current) return
          setSuggestions(result.suggestions ?? [])
          setError(null)
        },
        () => {
          if (requestId !== lastRequestIdRef.current) return
          setError('Suche derzeit nicht verfügbar.')
        }
      ).finally(() => {
        if (requestId === lastRequestIdRef.current) setIsLoading(false)
      })
    }
  }, [value])

  const handleSelectSuggestion = useCallback(
    async (prediction: { toPlace: () => Promise<NewPlace> }) => {
      try {
        const place = await prediction.toPlace()
        await place.fetchFields?.({
          fields: ['displayName', 'formattedAddress', 'location', 'addressComponents', 'photos'],
        })
        const addr = (place.formattedAddress ?? value) as string
        const loc = place.location
        const lat =
          typeof loc?.lat === 'function' ? (loc.lat as () => number)() : typeof loc?.lat === 'number' ? loc.lat : null
        const lng =
          typeof loc?.lng === 'function' ? (loc.lng as () => number)() : typeof loc?.lng === 'number' ? loc.lng : null
        const comps = place.addressComponents
        const land = pickComponent(comps, 'country')
        const bundesland = pickComponent(comps, 'administrative_area_level_1')
        const ort = deriveOrt(comps)
        const placeName = place.displayName?.text ?? undefined
        const displayValue = placeName ?? addr
        onChange(displayValue)
        onResolve({
          address: addr,
          lat,
          lng,
          ort,
          bundesland,
          land,
          placeName,
        })
        const photos = place.photos ?? []
        const forPicker: PlacePhotoForPicker[] = photos
          .slice(0, 10)
          .map((p) => ({ name: p.name ?? '' }))
          .filter((p) => p.name)
        onPlacePhotos?.(forPicker)
        sessionTokenRef.current = null
        setDropdownOpen(false)
        setSuggestions([])
        setIsExpandedSearch(false)
        onElementReady?.(inputRef.current ?? null)
      } catch {
        setError('Details konnten nicht geladen werden.')
      }
    },
    [onChange, onResolve, onPlacePhotos, onElementReady, value]
  )

  useEffect(() => {
    onElementReady?.(inputRef.current ?? null)
    return () => onElementReady?.(null)
  }, [onElementReady, placesAvailable])

  const showDropdown =
    dropdownOpen &&
    (suggestions.length > 0 || isLoading || error || (value.trim() && !isLoading && suggestions.length === 0 && !isExpandedSearch))

  const showFallbackButton =
    !isLoading &&
    !error &&
    value.trim() &&
    suggestions.length === 0 &&
    !isExpandedSearch

  const handleBlur = useCallback(() => {
    setTimeout(() => setDropdownOpen(false), 150)
  }, [])

  if (!placesAvailable) {
    return (
      <Input
        ref={inputRef}
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

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setDropdownOpen(true)
          setError(null)
        }}
        onFocus={() => setDropdownOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder ?? 'Adresse oder Name eingeben'}
        autoComplete="off"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border bg-white py-1 shadow-lg',
            'max-h-64 overflow-y-auto'
          )}
          role="listbox"
        >
          {isLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sucht…
            </div>
          )}
          {error && !isLoading && (
            <div className="px-3 py-2 text-sm text-amber-700 bg-amber-50">{error}</div>
          )}
          {!isLoading && !error && suggestions.length > 0 && (
            <>
              {isExpandedSearch && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-b">
                  Suche auf alle Orte ausgeweitet
                </div>
              )}
              {suggestions.map((s, idx) => {
                const pred = s.placePrediction
                if (!pred) return null
                const main = pred.mainText?.text ?? pred.text?.text ?? ''
                const secondary = pred.secondaryText?.text ?? ''
                return (
                  <button
                    key={idx}
                    type="button"
                    role="option"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectSuggestion(pred)
                    }}
                  >
                    <span className="font-medium">{main}</span>
                    {secondary && <span className="text-muted-foreground block truncate">{secondary}</span>}
                  </button>
                )
              })}
            </>
          )}
          {showFallbackButton && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-muted focus:bg-muted focus:outline-none font-medium"
              onMouseDown={(e) => {
                e.preventDefault()
                handleExpandSearch()
              }}
            >
              Kein Campingplatz gefunden. Suche auf alle Orte ausweiten?
            </button>
          )}
        </div>
      )}
    </div>
  )
}
