/**
 * Google Places API (New) – Foto-Media-URL und Pfad-Encoding.
 * Ressourcenname z. B. places/ChIJ.../photos/...
 */

export function encodePlacesPhotoResourceForUrl(photoName: string): string {
  const trimmed = photoName.trim()
  if (!trimmed) return ''
  return trimmed
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function buildPlacesPhotoMediaUrl(
  photoName: string,
  maxWidthPx: number,
  apiKey: string
): string {
  const path = encodePlacesPhotoResourceForUrl(photoName)
  const params = new URLSearchParams({
    maxWidthPx: String(maxWidthPx),
    key: apiKey,
  })
  return `https://places.googleapis.com/v1/${path}/media?${params.toString()}`
}

/** Authentifizierter Proxy (gleiche Origin, Session-Cookie) – für <img> / next/image. */
export function placesPhotoProxyUrl(photoName: string, maxWidthPx: number): string {
  const params = new URLSearchParams({
    name: photoName,
    maxWidthPx: String(maxWidthPx),
  })
  return `/api/places-photo?${params.toString()}`
}
