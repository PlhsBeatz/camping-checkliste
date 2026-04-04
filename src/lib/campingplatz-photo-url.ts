import type { Campingplatz } from '@/lib/db'
import { placesPhotoProxyUrl } from '@/lib/places-photo'

/** Thumbnail für Listen (Campingplätze, Urlaub) – Cover-Foto oder Legacy photo_name. */
export function campingplatzListThumbnailSrc(cp: Campingplatz): string | null {
  if (cp.cover_foto_id) {
    const params = new URLSearchParams({ maxWidthPx: '96' })
    return `/api/campingplaetze/fotos/${encodeURIComponent(cp.cover_foto_id)}/image?${params.toString()}`
  }
  const googleName = cp.cover_google_photo_name ?? cp.photo_name ?? null
  if (googleName) return placesPhotoProxyUrl(googleName, 96)
  return null
}

export function campingplatzFotoImageSrc(fotoId: string, maxWidthPx: number): string {
  const params = new URLSearchParams({ maxWidthPx: String(maxWidthPx) })
  return `/api/campingplaetze/fotos/${encodeURIComponent(fotoId)}/image?${params.toString()}`
}
