'use client'

import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dedupePlacePhotos } from '@/lib/google-place-photos-merge'
import { importGoogleMapsLibrary, loadGoogleMapsScript } from '@/lib/google-maps-script'

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
  /** Ressourcenname places/ChIJ… (für serverseitige Foto-Liste) */
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: PlaceLocation
  addressComponents?: PlaceAddressComponent[]
  photos?: Array<{
    name?: string
    authorAttributions?: Array<{ displayName?: string } | string>
  }>
  /** Offizielles Feld der neuen Place-Klasse (Maps JS API) */
  websiteURI?: string
  /** Legacy / REST-bezogene Schreibweisen (Abwärtskompatibilität) */
  website?: string
  websiteUri?: string
  types?: string[]
  primaryType?: string
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
  /** Google Place ID (ChIJ…), falls aus Autocomplete */
  googlePlaceId?: string | null
  /** Google-Typen (z. B. aus Link-Import) */
  googleTypes?: string[]
  /** Primärtyp laut Google (z. B. restaurant) */
  primaryType?: string
}

export type PlacePhotoForPicker = { name: string; authorAttributions?: string[] }

interface CampingplatzAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: CampingplatzAddressResolve) => void
  placeholder?: string
  onElementReady?: (el: HTMLElement | null) => void
  /** Optional: Fotos des gewählten Ortes (alle von Google gelieferten, typisch bis zu 10 pro API) */
  onPlacePhotos?: (photos: PlacePhotoForPicker[]) => void
  /** Primärtypen für Autocomplete (max. 5). Standard: Campingplätze */
  includedPrimaryTypes?: string[]
  /** Zweite Suchstufe: weitere Primärtypen (max. 5), z. B. Restaurant/Café */
  expandedPrimaryTypes?: string[]
  /** Hinweis auf dem Button zur erweiterten Typ-Suche (zweite Stufe) */
  expandTypesSearchLabel?: string
  /** Hinweis auf dem Button zur Suche ohne Typ-Filter (alle Orte) */
  expandSearchLabel?: string
  /** Meldung wenn keine Treffer in der Typ-Suche */
  noResultsExpandLabel?: string
  /** Google-Maps-Link-Import */
  enableGoogleLinkImport?: boolean
  /** Beschriftung des Link-Import-Buttons */
  googleLinkImportLabel?: string
  /** Hinweis über der Trefferliste bei zweiter Suchstufe */
  expandedSearchHint?: string
}

type SearchTier = 'primary' | 'secondary' | 'all'

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

function rawGooglePlaceIdFromPlace(place: NewPlace): string | null {
  const id = place.id?.trim()
  if (id?.startsWith('places/')) return id.slice('places/'.length)
  if (id && !id.includes('/')) return id
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

function pickPlaceWebsite(place: NewPlace): string | null {
  const candidates = [place.websiteURI, place.websiteUri, place.website]
  for (const c of candidates) {
    const s = c != null ? String(c).trim() : ''
    if (s) return s
  }
  return null
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
  return importGoogleMapsLibrary<PlacesLib>('places')
}

export function CampingplatzAddressAutocomplete(props: CampingplatzAddressAutocompleteProps) {
  const {
    value,
    onChange,
    onResolve,
    placeholder,
    onElementReady,
    onPlacePhotos,
    includedPrimaryTypes,
    expandedPrimaryTypes,
    expandTypesSearchLabel = 'Kein Treffer. Suche mit weiteren Ortstypen?',
    expandSearchLabel = 'Suche auf alle Orte ausweiten',
    noResultsExpandLabel = 'Kein Campingplatz gefunden. Suche auf alle Orte ausweiten?',
    enableGoogleLinkImport = true,
    googleLinkImportLabel = 'Campingplatz per Google-Maps-Link hinzufügen',
    expandedSearchHint,
  } = props
  const primaryTypes = includedPrimaryTypes ?? STRICT_TYPES
  const secondaryTypes = expandedPrimaryTypes?.length ? expandedPrimaryTypes : undefined
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [placesAvailable, setPlacesAvailable] = useState(false)
  const [mapsLoadFailed, setMapsLoadFailed] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ placePrediction?: PlacePrediction }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchTier, setSearchTier] = useState<SearchTier>('primary')
  const [showLinkImport, setShowLinkImport] = useState(false)
  const [googleMapsLink, setGoogleMapsLink] = useState('')
  const sessionTokenRef = useRef<unknown>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRequestIdRef = useRef(0)
  const placesLibRef = useRef<PlacesLib | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false

    void (async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
      if (!apiKey) {
        if (!cancelled) setMapsLoadFailed(true)
        return
      }

      const loaded = await loadGoogleMapsScript()
      if (cancelled) return
      if (!loaded) {
        setMapsLoadFailed(true)
        return
      }

      const lib = await loadPlacesLibrary()
      if (cancelled) return
      placesLibRef.current = lib
      const available = !!lib?.AutocompleteSuggestion
      setPlacesAvailable(available)
      setMapsLoadFailed(!available)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const resetSessionToken = useCallback(() => {
    if (!placesLibRef.current?.AutocompleteSessionToken) return
    sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken()
  }, [])

  const fetchSuggestions = useCallback(
    async (input: string, tier: SearchTier) => {
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
        if (tier === 'primary') {
          request.includedPrimaryTypes = primaryTypes
        } else if (tier === 'secondary' && secondaryTypes?.length) {
          request.includedPrimaryTypes = secondaryTypes
        }
        const result = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        if (requestId !== lastRequestIdRef.current) return
        setSuggestions(result.suggestions ?? [])
        setError(null)
      } catch (err) {
        if (requestId !== lastRequestIdRef.current) return
        setSuggestions([])
        console.error('[Places Autocomplete]', err)
        setError('Suche derzeit nicht verfügbar. Bitte später erneut versuchen.')
      } finally {
        if (requestId === lastRequestIdRef.current) setIsLoading(false)
      }
    },
    [resetSessionToken, primaryTypes, secondaryTypes]
  )

  useEffect(() => {
    if (!placesAvailable || !value.trim()) {
      setSuggestions([])
      setError(null)
      setSearchTier('primary')
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      fetchSuggestions(value, searchTier)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [value, placesAvailable, fetchSuggestions, searchTier])

  const runTierSearch = useCallback(
    (tier: SearchTier) => {
      setSearchTier(tier)
      if (!value.trim() || !placesLibRef.current?.AutocompleteSuggestion) return
      setIsLoading(true)
      setError(null)
      const requestId = ++lastRequestIdRef.current
      const request: AutocompleteRequest = {
        input: value.trim(),
        sessionToken: sessionTokenRef.current ?? undefined,
        language: 'de',
      }
      if (tier === 'primary') {
        request.includedPrimaryTypes = primaryTypes
      } else if (tier === 'secondary' && secondaryTypes?.length) {
        request.includedPrimaryTypes = secondaryTypes
      }
      placesLibRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        .then((result) => {
          if (requestId !== lastRequestIdRef.current) return
          setSuggestions(result.suggestions ?? [])
          setError(null)
        })
        .catch(() => {
          if (requestId !== lastRequestIdRef.current) return
          setError('Suche derzeit nicht verfügbar.')
        })
        .finally(() => {
          if (requestId === lastRequestIdRef.current) setIsLoading(false)
        })
    },
    [value, primaryTypes, secondaryTypes]
  )

  const handleExpandToSecondary = useCallback(() => {
    runTierSearch('secondary')
  }, [runTierSearch])

  const handleExpandToAll = useCallback(() => {
    runTierSearch('all')
  }, [runTierSearch])

  const handleImportFromGoogleMapsLink = useCallback(async () => {
    const url = googleMapsLink.trim()
    if (!url) return

    try {
      const res = await fetch('/api/google-place-from-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      type ApiResult = {
        success: boolean
        error?: string
        data?: {
          resolve: CampingplatzAddressResolve
          photos: PlacePhotoForPicker[]
        }
      }
      const json = (await res.json()) as ApiResult
      if (!json.success || !json.data) {
        setError(json.error || 'Der Ort konnte über den Link nicht geladen werden.')
        return
      }

      const { resolve, photos } = json.data
      const displayName = (resolve.placeName ?? resolve.address ?? value.trim()) || url

      onChange(displayName)
      onResolve({
        ...resolve,
        placeName: displayName,
      })
      onPlacePhotos?.(photos)
      sessionTokenRef.current = null
      setDropdownOpen(false)
      setSuggestions([])
      setSearchTier('primary')
      setShowLinkImport(false)
      setGoogleMapsLink('')
      onElementReady?.(inputRef.current ?? null)
    } catch {
      setError('Der Ort konnte über den Link nicht geladen werden.')
    }
  }, [googleMapsLink, value, onChange, onResolve, onPlacePhotos, onElementReady])

  const handleSelectSuggestion = useCallback(
    async (prediction: PlacePrediction) => {
      try {
        const place = await prediction.toPlace()
        await place.fetchFields?.({
          // `websiteURI` ist der gültige Feldname der neuen Place-Klasse (nicht `website` / `websiteUri`).
          fields: [
            'displayName',
            'formattedAddress',
            'location',
            'addressComponents',
            'photos',
            'websiteURI',
            'types',
            'primaryType',
          ],
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

        const website = pickPlaceWebsite(place)
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
          googlePlaceId: rawGooglePlaceIdFromPlace(place),
          googleTypes: place.types,
          primaryType: place.primaryType,
        })
        const photos = place.photos ?? []
        const forPicker: PlacePhotoForPicker[] = dedupePlacePhotos(
          photos
            .map((p) => {
              const attrs = (p.authorAttributions ?? [])
                .map((a) => (typeof a === 'string' ? a : a.displayName))
                .filter((x): x is string => !!x)
              return { name: (p.name ?? '').trim(), authorAttributions: attrs.length ? attrs : undefined }
            })
            .filter((p) => p.name.startsWith('places/') && p.name.includes('/photos/'))
        )

        const rid = rawGooglePlaceIdFromPlace(place)
        if (rid && onPlacePhotos) {
          try {
            const res = await fetch(`/api/google-place-photos?placeId=${encodeURIComponent(rid)}`)
            const json = (await res.json()) as {
              success?: boolean
              data?: { photos?: PlacePhotoForPicker[] }
            }
            if (json.success && json.data?.photos && json.data.photos.length > 0) {
              onPlacePhotos(dedupePlacePhotos(json.data.photos))
            } else {
              onPlacePhotos(forPicker)
            }
          } catch {
            onPlacePhotos(forPicker)
          }
        } else {
          onPlacePhotos?.(forPicker)
        }
        sessionTokenRef.current = null
        setDropdownOpen(false)
        setSuggestions([])
        setSearchTier('primary')
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

  const showNoResultsActions =
    !isLoading && !error && !!value.trim() && suggestions.length === 0

  const showDropdown =
    dropdownOpen &&
    (suggestions.length > 0 || isLoading || !!error || showNoResultsActions)

  const showSecondaryExpand =
    showNoResultsActions && searchTier === 'primary' && !!secondaryTypes?.length

  const showAllExpand =
    showNoResultsActions &&
    searchTier !== 'all' &&
    (searchTier === 'secondary' || !secondaryTypes?.length)

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
      <div className="space-y-1">
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
        {mapsLoadFailed && (
          <p className="text-xs text-amber-700">
            Google-Ortssuche nicht verfügbar
            {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              ? ' (Maps-Skript konnte nicht geladen werden – Seite neu laden oder API-Key prüfen).'
              : ' (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY fehlt in .dev.vars).'}
          </p>
        )}
        {mapsLoadFailed && enableGoogleLinkImport && (
          <div className="pt-2 space-y-1">
            <button
              type="button"
              className="text-xs text-brand-heading font-medium hover:underline"
              onClick={() => setShowLinkImport((prev) => !prev)}
            >
              {googleLinkImportLabel}
            </button>
            {showLinkImport && (
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
                      void handleImportFromGoogleMapsLink()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => void handleImportFromGoogleMapsLink()}
                >
                  OK
                </Button>
              </div>
            )}
            {error && <p className="text-xs text-amber-700">{error}</p>}
          </div>
        )}
      </div>
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
            'absolute z-50 mt-1 w-full rounded-md border bg-card py-1 shadow-lg',
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
              {searchTier === 'secondary' && expandedSearchHint && (
                <div className="px-3 pt-3 pb-0 text-xs text-muted-foreground">
                  {expandedSearchHint}
                </div>
              )}
              {searchTier === 'all' && (
                <div className="px-3 pt-3 pb-0 text-xs text-muted-foreground">
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
          {showNoResultsActions && (showSecondaryExpand || showAllExpand || enableGoogleLinkImport) && (
            <div className="pt-4">
              {showSecondaryExpand && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-brand-heading hover:bg-muted focus:bg-muted focus:outline-none font-medium"
                  onClick={() => {
                    handleExpandToSecondary()
                  }}
                >
                  {expandTypesSearchLabel}
                </button>
              )}
              {showAllExpand && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-brand-heading hover:bg-muted focus:bg-muted focus:outline-none font-medium"
                  onClick={() => {
                    handleExpandToAll()
                  }}
                >
                  {secondaryTypes?.length ? noResultsExpandLabel : expandSearchLabel}
                </button>
              )}
              {enableGoogleLinkImport && (
                <>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm text-brand-heading hover:bg-muted focus:bg-muted focus:outline-none"
                    onClick={() => {
                      setShowLinkImport((prev) => !prev)
                      if (!showLinkImport) {
                        setGoogleMapsLink('')
                      }
                    }}
                  >
                    {googleLinkImportLabel}
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
                              handleImportFromGoogleMapsLink()
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
                            handleImportFromGoogleMapsLink()
                          }}
                        >
                          OK
                        </Button>
                      </div>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Tipp: In Google Maps den Ort öffnen, auf „Teilen“ klicken und den Link hier einfügen.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
