import type { R2Bucket } from '@cloudflare/workers-types'
import { buildPlacesPhotoMediaUrl } from '@/lib/places-photo'

const IMPORT_MAX_PX = 1600

function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

/** Bild von Google Places (new) laden — ohne Upload nach R2 (Aufrufer optimiert und speichert). */
export async function fetchGooglePlacePhotoBytes(opts: {
  apiKey: string
  googlePhotoName: string
}): Promise<{ data: Uint8Array; contentType: string } | null> {
  const url = buildPlacesPhotoMediaUrl(opts.googlePhotoName, IMPORT_MAX_PX, opts.apiKey)
  const res = await fetch(url, { redirect: 'follow', headers: { Accept: 'image/*' } })
  if (!res.ok) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength === 0) return null
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  return { data: buf, contentType }
}

export function buildCampingplatzFotoObjectKey(campingplatzId: string, fotoId: string, contentType: string): string {
  const ext = extFromContentType(contentType)
  return `cp/${campingplatzId}/${fotoId}.${ext}`
}
