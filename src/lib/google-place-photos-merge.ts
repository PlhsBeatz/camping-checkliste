/**
 * Google Places liefert pro Place-Details-Antwort höchstens 10 Fotos (API-Vorgabe).
 * Es gibt nur eine zuverlässige Quelle: Places API (New). Eine zweite Abfrage (Legacy)
 * liefert dieselben Motive mit anderen Referenz-Strings und erzeugte bei uns fälschlich
 * bis zu 20 Einträge mit Duplikaten – daher keine Doppelabfrage mehr.
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
        name: (p.name ?? '').trim(),
        authorAttributions: attrs.length ? attrs : undefined,
      }
    })
    .filter((p) => p.name.startsWith('places/') && p.name.includes('/photos/'))
}

/**
 * Einheitlicher Schlüssel für dasselbe Foto (Suffix nach …/photos/, perzent-decodiert).
 */
export function placePhotoDedupeKey(fullResourceName: string): string {
  const t = fullResourceName.trim()
  const i = t.lastIndexOf('/photos/')
  const tail = i >= 0 ? t.slice(i + '/photos/'.length) : t
  try {
    return decodeURIComponent(tail)
  } catch {
    return tail
  }
}

/** Entfernt doppelte Foto-Einträge (gleiche Referenz, ggf. unterschiedlich kodiert). */
export function dedupePlacePhotos(entries: PlacePhotoPickerEntry[]): PlacePhotoPickerEntry[] {
  const seen = new Set<string>()
  const out: PlacePhotoPickerEntry[] = []
  for (const e of entries) {
    if (!e.name.startsWith('places/') || !e.name.includes('/photos/')) continue
    const k = placePhotoDedupeKey(e.name)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(e)
  }
  return out
}

/** Nur New API (FieldMask photos). */
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

/** New-API-Fotoliste, dedupliziert (für Picker / Server-Route). */
export async function fetchPlacePhotosForPicker(
  rawPlaceId: string,
  apiKey: string
): Promise<PlacePhotoPickerEntry[]> {
  const raw = await fetchNewPlacePhotosOnly(rawPlaceId, apiKey)
  return dedupePlacePhotos(raw)
}
