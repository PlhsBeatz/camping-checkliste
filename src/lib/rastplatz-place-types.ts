import type { RastplatzKategorie } from '@/lib/db'

export const RASTPLATZ_KATEGORIEN: Array<{ value: RastplatzKategorie; label: string }> = [
  { value: 'rastplatz', label: 'Rastplatz' },
  { value: 'tankstelle', label: 'Tankstelle' },
  { value: 'parkplatz', label: 'Parkplatz' },
  { value: 'autohof', label: 'Autohof' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

const RASTPLATZ_KATEGORIE_LABELS: Record<RastplatzKategorie, string> = Object.fromEntries(
  RASTPLATZ_KATEGORIEN.map((k) => [k.value, k.label])
) as Record<RastplatzKategorie, string>

export function rastplatzKategorieLabel(kategorie: string): string {
  return RASTPLATZ_KATEGORIE_LABELS[kategorie as RastplatzKategorie] ?? kategorie
}

/**
 * Google Places (New) Autocomplete: max. 5 includedPrimaryTypes pro Anfrage.
 * @see https://developers.google.com/maps/documentation/places/web-service/place-types
 */
export const RASTPLATZ_AUTOCOMPLETE_PRIMARY_TYPES = [
  'gas_station', // Tankstelle
  'rest_stop', // Rastplatz / Autobahn-Rast
  'truck_stop', // Autohof, LKW-Rast
  'parking', // Parkplatz
  'parking_lot', // Parkfläche (Table B, für Autocomplete erlaubt)
] as const

/**
 * Zweite Autocomplete-Stufe (max. 5 Typen): Gastronomie & Verpflegung unterwegs.
 */
export const RASTPLATZ_AUTOCOMPLETE_EXPANDED_TYPES = [
  'restaurant',
  'cafe',
  'bakery',
  'meal_takeaway',
  'food_court',
] as const

/** Nearby Search: Umkreis in Metern (API-Obergrenze 500). */
export const RASTPLATZ_NEARBY_RADIUS_M = 500

/** Nearby Search (Server): etwas breiter als Autocomplete-Limit */
export const RASTPLATZ_NEARBY_INCLUDED_TYPES = [
  'gas_station',
  'rest_stop',
  'parking',
  'truck_stop',
  'restaurant',
  'cafe',
]

export function inferRastplatzKategorieFromGoogleTypes(
  types: string[] | undefined,
  primaryType?: string
): RastplatzKategorie {
  const all = [...(types ?? []), primaryType ?? ''].filter(Boolean)
  if (all.some((t) => t.includes('gas_station'))) return 'tankstelle'
  if (all.some((t) => t.includes('truck_stop'))) return 'autohof'
  if (all.some((t) => t.includes('rest_stop'))) return 'rastplatz'
  if (all.some((t) => t.includes('parking'))) return 'parkplatz'
  if (all.some((t) => t.includes('restaurant') || t.includes('cafe'))) return 'restaurant'
  return 'sonstiges'
}
