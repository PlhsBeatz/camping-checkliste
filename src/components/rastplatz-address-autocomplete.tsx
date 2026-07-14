'use client'

import {
  CampingplatzAddressAutocomplete,
  type CampingplatzAddressResolve,
} from '@/components/campingplatz-address-autocomplete'
import {
  RASTPLATZ_AUTOCOMPLETE_EXPANDED_TYPES,
  RASTPLATZ_AUTOCOMPLETE_PRIMARY_TYPES,
} from '@/lib/rastplatz-place-types'

export type RastplatzAddressResolve = CampingplatzAddressResolve

interface RastplatzAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: RastplatzAddressResolve) => void
  placeholder?: string
}

/**
 * Autocomplete für Rastplätze: Tankstelle, Rastplatz, Autohof, Parkplatz;
 * Ausweitung auf Restaurants/Cafés; Google-Maps-Link als Fallback.
 */
export function RastplatzAddressAutocomplete({
  value,
  onChange,
  onResolve,
  placeholder = 'Tankstelle, Rastplatz, Autohof, Parkplatz oder Restaurant suchen…',
}: RastplatzAddressAutocompleteProps) {
  return (
    <CampingplatzAddressAutocomplete
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onResolve={onResolve}
      includedPrimaryTypes={[...RASTPLATZ_AUTOCOMPLETE_PRIMARY_TYPES]}
      expandedPrimaryTypes={[...RASTPLATZ_AUTOCOMPLETE_EXPANDED_TYPES]}
      expandTypesSearchLabel="Kein Treffer. Auch Restaurants, Cafés und Gastronomie suchen?"
      noResultsExpandLabel="Immer noch kein Treffer. Suche auf alle Orte ausweiten?"
      enableGoogleLinkImport
      googleLinkImportLabel="Rastplatz per Google-Maps-Link hinzufügen"
      expandedSearchHint="Suche inkl. Restaurants, Cafés und Gastronomie"
    />
  )
}
