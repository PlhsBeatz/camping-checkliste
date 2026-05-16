/**
 * Campingplatz-Foto vor Upload im Browser verkleinern/neu kodieren (Canvas).
 * Parameter entsprechen serverseitig `camping-photo-optimize.ts` (1600 px / Qualität ≈ 85 %).
 *
 * HEIC u. Ä. kann je nach Gerät/Browser bei `createImageBitmap` fehlschlagen — dann Originaldatei.
 */

/** Entspricht `CAMPING_PHOTO_MAX_EDGE` auf dem Server */
const CLIENT_MAX_EDGE_PX = 1600

/** Entspricht grob `CAMPING_PHOTO_WEBP_QUALITY` (Canvas erwartet 0–1) */
const CLIENT_WEBP_QUALITY = 0.85

const JPEG_QUALITY = 0.85

/** Unterhalb dieser Größe wird nicht neu kodiert, solange die Pixelkanten schon ausreichend klein sind */
const COMPRESS_IF_LARGER_THAN_BYTES = 2 * 1024 * 1024

export async function prepareCampingplatzUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  try {
    const bitmap = await createImageBitmap(file)
    try {
      const maxEdge = Math.max(bitmap.width, bitmap.height)
      const needsResize = maxEdge > CLIENT_MAX_EDGE_PX
      const needsReencodeForSize = file.size > COMPRESS_IF_LARGER_THAN_BYTES

      if (!needsResize && !needsReencodeForSize) {
        return file
      }

      const scale = needsResize ? CLIENT_MAX_EDGE_PX / maxEdge : 1
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return file

      ctx.drawImage(bitmap, 0, 0, w, h)

      let blob =
        (await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/webp', CLIENT_WEBP_QUALITY)
        })) ?? null

      if (!blob || blob.size === 0) {
        blob =
          (await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
          })) ?? null
      }

      if (!blob || blob.size === 0) return file

      const base = file.name.replace(/\.[^.]+$/, '')
      const stem = base || 'foto'

      if (blob.type === 'image/webp') {
        return new File([blob], `${stem}.webp`, { type: 'image/webp' })
      }

      return new File([blob], `${stem}.jpg`, { type: 'image/jpeg' })

    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}
