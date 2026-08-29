import { toGermanPlaceLabels } from '@/lib/place-value-normalize'

export type GooglePlaceSnapshot = {
  name: string | null
  adresse: string | null
  ort: string | null
  bundesland: string | null
  land: string | null
  webseite: string | null
  telefon: string | null
  oeffnungszeiten: string | null
}

type PlaceAddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

type PlaceDetailsJson = {
  displayName?: { text?: string }
  formattedAddress?: string
  addressComponents?: PlaceAddressComponent[]
  websiteUri?: string
  nationalPhoneNumber?: string
  regularOpeningHours?: { weekdayDescriptions?: string[] }
}

function pickComponent(comps: PlaceAddressComponent[] | undefined, type: string): string | null {
  if (!comps?.length) return null
  for (const c of comps) {
    if (Array.isArray(c.types) && c.types.includes(type)) {
      const v = c.longText ?? c.shortText
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

const FIELD_MASK = [
  'displayName',
  'formattedAddress',
  'addressComponents',
  'websiteUri',
  'nationalPhoneNumber',
  'regularOpeningHours',
].join(',')

export async function fetchGooglePlaceSnapshot(
  apiKey: string,
  googlePlaceId: string
): Promise<GooglePlaceSnapshot | null> {
  const id = googlePlaceId.startsWith('places/')
    ? googlePlaceId.slice('places/'.length)
    : googlePlaceId
  if (!id.trim()) return null

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=de`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
        'Accept-Language': 'de',
      },
    })
    if (!res.ok) return null
    const place = (await res.json()) as PlaceDetailsJson
    const labels = toGermanPlaceLabels({
      adresse: place.formattedAddress?.trim() || null,
      land: pickComponent(place.addressComponents, 'country'),
      bundesland: pickComponent(place.addressComponents, 'administrative_area_level_1'),
    })
    const hours = place.regularOpeningHours?.weekdayDescriptions?.join('\n')?.trim() || null
    return {
      name: place.displayName?.text?.trim() || null,
      adresse: labels.adresse,
      ort: deriveOrt(place.addressComponents),
      bundesland: labels.bundesland,
      land: labels.land,
      webseite: place.websiteUri?.trim() || null,
      telefon: place.nationalPhoneNumber?.trim() || null,
      oeffnungszeiten: hours,
    }
  } catch (error) {
    console.error('fetchGooglePlaceSnapshot:', error)
    return null
  }
}
