import type { R2Bucket } from '@cloudflare/workers-types'
import { buildPlacesPhotoMediaUrl } from '@/lib/places-photo'

const IMPORT_MAX_PX = 1600

function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

export async function downloadGooglePlacePhotoToR2(opts: {
  bucket: R2Bucket
  apiKey: string
  googlePhotoName: string
  r2ObjectKey: string
}): Promise<{ contentType: string } | null> {
  const url = buildPlacesPhotoMediaUrl(opts.googlePhotoName, IMPORT_MAX_PX, opts.apiKey)
  const res = await fetch(url, { redirect: 'follow', headers: { Accept: 'image/*' } })
  if (!res.ok) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength === 0) return null
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  await opts.bucket.put(opts.r2ObjectKey, buf, {
    httpMetadata: { contentType },
  })
  return { contentType }
}

export function buildCampingplatzFotoObjectKey(campingplatzId: string, fotoId: string, contentType: string): string {
  const ext = extFromContentType(contentType)
  return `cp/${campingplatzId}/${fotoId}.${ext}`
}
