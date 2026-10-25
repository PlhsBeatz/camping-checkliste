import type { Campingplatz } from '@/lib/db'
import { placesPhotoProxyUrl } from '@/lib/places-photo'

/** Felder für Cover-URL (Campingplatz oder Attention-Tile). */
export type CoverPhotoFields = {
  cover_foto_id?: string | null
  cover_google_photo_name?: string | null
  photo_name?: string | null
}

/** Cover-URL mit wählbarer Breite – Cover-Foto, sonst Google/Legacy. */
export function campingplatzCoverSrc(
  source: CoverPhotoFields | null | undefined,
  maxWidthPx = 96
): string | null {
  if (!source) return null
  if (source.cover_foto_id) {
    const params = new URLSearchParams({ maxWidthPx: String(maxWidthPx) })
    return `/api/campingplaetze/fotos/${encodeURIComponent(source.cover_foto_id)}/image?${params.toString()}`
  }
  const googleName = source.cover_google_photo_name ?? source.photo_name ?? null
  if (googleName) return placesPhotoProxyUrl(googleName, maxWidthPx)
  return null
}

/** Thumbnail für Listen (Campingplätze, Urlaub) – Cover-Foto oder Legacy photo_name. */
export function campingplatzListThumbnailSrc(cp: Campingplatz): string | null {
  return campingplatzCoverSrc(cp, 96)
}

/** Erstes verfügbares Cover aus einer Platz-Liste (Urlaub-Karten-Streifen). */
export function firstCampingplatzCoverSrc(
  places: Campingplatz[] | null | undefined,
  maxWidthPx = 640
): string | null {
  if (!places?.length) return null
  for (const cp of places) {
    const src = campingplatzCoverSrc(cp, maxWidthPx)
    if (src) return src
  }
  return null
}

/** Cover für Heute-Urlaubskachel (AttentionVacationTile-Felder). */
export function vacationTileCoverSrc(
  tile: {
    coverFotoId?: string | null
    coverGooglePhotoName?: string | null
  } | null
  | undefined,
  maxWidthPx = 96
): string | null {
  if (!tile) return null
  return campingplatzCoverSrc(
    {
      cover_foto_id: tile.coverFotoId,
      cover_google_photo_name: tile.coverGooglePhotoName,
    },
    maxWidthPx
  )
}

export function campingplatzFotoImageSrc(fotoId: string, maxWidthPx: number): string {
  const params = new URLSearchParams({ maxWidthPx: String(maxWidthPx) })
  return `/api/campingplaetze/fotos/${encodeURIComponent(fotoId)}/image?${params.toString()}`
}
