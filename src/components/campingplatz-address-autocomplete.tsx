'use client'

import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  /** Klassisches Website-Feld der JS Places API */
  website?: string
  /** Bei neueren Versionen ggf. zusätzlich verfügbar */
  websiteUri?: string
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
  /** Von Google hinterlegte Website-URL (falls vorhanden) */
  website?: string | null
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

type PlacePrediction = {
  text?: { text?: string }
  mainText?: { text?: string }
  secondaryText?: { text?: string }
  toPlace: () => Promise<NewPlace>
}

type AutocompleteSuggestionsResult = {
  suggestions: Array<{ placePrediction?: PlacePrediction }>
}

type AutocompleteRequest = {
  input: string
  sessionToken?: unknown
  includedPrimaryTypes?: string[]
  language?: string
  locationBias?: unknown
  locationRestriction?: unknown
}

type PlacesLib = {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (req: AutocompleteRequest) => Promise<AutocompleteSuggestionsResult>
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
  const [suggestions, setSuggestions] = useState<Array<{ placePrediction?: PlacePrediction }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isExpandedSearch, setIsExpandedSearch] = useState(false)
  const [showLinkImport, setShowLinkImport] = useState(false)
  const [googleMapsLink, setGoogleMapsLink] = useState('')
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
        const request: AutocompleteRequest = {
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
      } catch {
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
      const request: AutocompleteRequest = {
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

  const handleImportFromGoogleMapsLink = useCallback(
    async (selectSuggestion: (prediction: PlacePrediction) => Promise<void>) => {
      const url = googleMapsLink.trim()
      if (!url) return

      // 1) Versuche, aus dem Link einen brauchbaren Suchbegriff zu extrahieren
      let extractedName: string | null = null
      try {
        const withoutQuery = url.split('?')[0] ?? ''
        const parts = withoutQuery.split('/')
        const placeIndex = parts.findIndex((p) => p === 'place')
        const rawPart = placeIndex >= 0 ? parts[placeIndex + 1] ?? '' : ''
        if (rawPart) {
          const decoded = decodeURIComponent(rawPart.replace(/\+/g, ' '))
          if (decoded && decoded !== '@') {
            extractedName = decoded
          }
        }
      } catch {
        extractedName = null
      }

      // 2) Wenn wir einen Namen haben und die Places-Lib verfügbar ist:
      //    nutze denselben Weg wie Autocomplete → Vorschläge holen, ersten Treffer auswählen.
      const lib = placesLibRef.current
      const searchText = extractedName ?? value.trim()
      if (lib?.AutocompleteSuggestion && searchText) {
        try {
          setIsLoading(true)
          setError(null)
          const requestId = ++lastRequestIdRef.current
          const request: AutocompleteRequest = {
            input: searchText,
            sessionToken: sessionTokenRef.current ?? undefined,
            language: 'de',
          }
          const result = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
          if (requestId !== lastRequestIdRef.current) return
          const firstPrediction = (result.suggestions ?? []).find((s) => s.placePrediction)?.placePrediction
          if (firstPrediction) {
            await selectSuggestion(firstPrediction)
            setShowLinkImport(false)
            setGoogleMapsLink('')
            return
          }
        } catch {
          // Fallback unten nutzen
        } finally {
          setIsLoading(false)
        }
      }

      // 3) Fallback: Wenn wir nichts Sinnvolles finden, trage wenigstens den Link als Website ein.
      const displayName = searchText || url
      onChange(displayName)
      onResolve({
        address: displayName,
        lat: null,
        lng: null,
        ort: null,
        bundesland: null,
        land: null,
        placeName: displayName,
        website: url,
      })
      onPlacePhotos?.([])
      sessionTokenRef.current = null
      setDropdownOpen(false)
      setSuggestions([])
      setIsExpandedSearch(false)
      setShowLinkImport(false)
      setGoogleMapsLink('')
      onElementReady?.(inputRef.current ?? null)
    },
    [googleMapsLink, value, onChange, onResolve, onPlacePhotos, onElementReady]
  )

  const handleSelectSuggestion = useCallback(
    async (prediction: PlacePrediction) => {
      try {
        const place = await prediction.toPlace()
        await place.fetchFields?.({
          // Website-URL wird, sofern verfügbar, ebenfalls auf dem Place-Objekt bereitgestellt.
          // Wir belassen das Fields-Set auf den stabilen Kernfeldern, damit keine Fehler durch unbekannte Felder entstehen.
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
        const mainText = prediction.mainText?.text ?? prediction.text?.text ?? ''
        const placeName = place.displayName?.text ?? (mainText || undefined)
        // Im Feld immer den Namen anzeigen (nicht die Adresse): zuerst displayName, dann Text aus der Vorschlagsliste, sonst Adresse
        const displayValue = placeName ?? addr

        // Website-URL optional nachladen; zuerst klassisches `website`, ggf. zusätzlich `websiteUri`.
        let website: string | null = null
        try {
          await place.fetchFields?.({ fields: ['website'] })
          website = (place as NewPlace).website ?? null
          if (!website) {
            await place.fetchFields?.({ fields: ['websiteUri'] })
            website = (place as NewPlace).websiteUri ?? null
          }
        } catch {
          website = null
        }
        onChange(displayValue)
        onResolve({
          address: addr,
          lat,
          lng,
          ort,
          bundesland,
          land,
          placeName,
          website,
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
    (suggestions.length > 0 ||
      isLoading ||
      !!error ||
      (!!value.trim() && !isLoading && suggestions.length === 0 && !isExpandedSearch))

  const showFallbackButton =
    !isLoading &&
    !error &&
    value.trim() &&
    suggestions.length === 0 &&
    !isExpandedSearch

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const next = e.relatedTarget as HTMLElement | null
      if (next && wrapperRef.current && wrapperRef.current.contains(next)) {
        return
      }
      setTimeout(() => setDropdownOpen(false), 150)
    },
    []
  )

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
                    aria-selected={false}
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
            <div className="border-t border-muted">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-[rgb(45,79,30)] hover:bg-muted focus:bg-muted focus:outline-none font-medium"
                onClick={() => {
                  handleExpandSearch()
                }}
              >
                Kein Campingplatz gefunden. Suche auf alle Orte ausweiten?
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-[rgb(45,79,30)] hover:bg-muted focus:bg-muted focus:outline-none"
                onClick={() => {
                  setShowLinkImport((prev) => !prev)
                  if (!showLinkImport) {
                    setGoogleMapsLink('')
                  }
                }}
              >
                Campingplatz per Google-Maps-Link hinzufügen
              </button>
              {showLinkImport && (
                <div className="px-3 pb-2 pt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={googleMapsLink}
                      onChange={(e) => setGoogleMapsLink(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void handleImportFromGoogleMapsLink(handleSelectSuggestion)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          setShowLinkImport(false)
                          setGoogleMapsLink('')
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white"
                      onClick={() => {
                        void handleImportFromGoogleMapsLink(handleSelectSuggestion)
                      }}
                    >
                      OK
                    </Button>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Tipp: In Google Maps den Platz öffnen, auf „Teilen“ klicken und den Link hier einfügen.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
