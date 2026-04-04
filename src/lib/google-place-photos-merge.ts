/**
 * Google Places liefert in einer Place-Details-Antwort höchstens 10 Fotos (API-Vorgabe).
 * Wir kombinieren die Fotos aus der Places API (New) mit denen der Legacy Place Details API,
 * um alle von beiden zurückgegebenen Referenzen ohne Dubletten zu nutzen (gleiche Foto-Referenz
 * = ein Eintrag).
 */

export type PlacePhotoPickerEntry = { name: string; authorAttributions?: string[] }

type NewApiPhoto = {
  name?: string
  authorAttributions?: Array<{ displayName?: string } | string>
}

function mapNewApiPhotos(photos: NewApiPhoto[] | undefined): PlacePhotoPickerEntry[] {
  if (!photos?.length) return []
  return photos
    .map((p) => {
      const attrs = (p.authorAttributions ?? [])
        .map((a) => (typeof a === 'string' ? a : (a.displayName ?? '')))
        .filter((x: string) => !!x)
      return {
        name: p.name ?? '',
        authorAttributions: attrs.length ? attrs : undefined,
      }
    })
    .filter((p) => p.name.startsWith('places/') && p.name.includes('/photos/'))
}

/** Letztes Pfadsegment nach …/photos/ (für Deduplizierung zwischen New und Legacy). */
function photoResourceSuffix(photoResourceName: string): string {
  const idx = photoResourceName.lastIndexOf('/photos/')
  if (idx < 0) return photoResourceName
  return photoResourceName.slice(idx + '/photos/'.length)
}

function stripHtmlAttribution(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

/**
 * Ergänzt die von der New API gelieferten Fotos um solche aus Legacy Place Details,
 * die noch nicht in der Liste vorkommen (gleiche Referenz = gleiches Suffix nach /photos/).
 */
export async function mergePlacePhotosWithLegacyDetails(
  rawPlaceId: string,
  newApiPhotos: PlacePhotoPickerEntry[],
  apiKey: string
): Promise<PlacePhotoPickerEntry[]> {
  const bySuffix = new Map<string, PlacePhotoPickerEntry>()
  for (const p of newApiPhotos) {
    const suf = photoResourceSuffix(p.name)
    if (!suf) continue
    bySuffix.set(suf, p)
  }

  try {
    const legacyUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    legacyUrl.searchParams.set('place_id', rawPlaceId)
    legacyUrl.searchParams.set('fields', 'photos')
    legacyUrl.searchParams.set('language', 'de')
    legacyUrl.searchParams.set('key', apiKey)
    const res = await fetch(legacyUrl.toString())
    if (!res.ok) return [...bySuffix.values()]
    const json = (await res.json()) as {
      status?: string
      result?: {
        photos?: Array<{ photo_reference?: string; html_attributions?: string[] }>
      }
    }
    if (json.status !== 'OK' || !json.result?.photos?.length) return [...bySuffix.values()]

    for (const ph of json.result.photos) {
      const ref = ph.photo_reference?.trim()
      if (!ref) continue
      if (bySuffix.has(ref)) continue
      const name = `places/${rawPlaceId}/photos/${ref}`
      const attrs = (ph.html_attributions ?? []).map(stripHtmlAttribution).filter(Boolean)
      bySuffix.set(ref, {
        name,
        authorAttributions: attrs.length ? attrs : undefined,
      })
    }
  } catch {
    /* Legacy optional */
  }

  return [...bySuffix.values()]
}

/** Nur New API (FieldMask photos) – z. B. für serverseitige Nachladung nach Autocomplete. */
export async function fetchNewPlacePhotosOnly(
  rawPlaceId: string,
  apiKey: string
): Promise<PlacePhotoPickerEntry[]> {
  const detailsUrl = `https://places.googleapis.com/v1/places/${encodeURIComponent(rawPlaceId)}`
  const detailsRes = await fetch(detailsUrl, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'photos',
    },
  })
  if (!detailsRes.ok) return []
  const place = (await detailsRes.json()) as { photos?: NewApiPhoto[] }
  return mapNewApiPhotos(place.photos)
}

export async function fetchMergedPlacePhotosForPicker(
  rawPlaceId: string,
  apiKey: string
): Promise<PlacePhotoPickerEntry[]> {
  const fromNew = await fetchNewPlacePhotosOnly(rawPlaceId, apiKey)
  return mergePlacePhotosWithLegacyDetails(rawPlaceId, fromNew, apiKey)
}
