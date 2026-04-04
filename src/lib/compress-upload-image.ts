/**
 * Verkleinert große Fotos im Browser (Canvas), bevor sie hochgeladen werden.
 * HEIC o. Ä. kann je nach Browser fehlschlagen — dann wird die Originaldatei verwendet.
 */

const COMPRESS_IF_LARGER_THAN_BYTES = 2 * 1024 * 1024
const MAX_EDGE_PX = 2560
const JPEG_QUALITY = 0.85

export async function prepareCampingplatzUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= COMPRESS_IF_LARGER_THAN_BYTES) {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const maxEdge = Math.max(bitmap.width, bitmap.height)
      const scale = maxEdge > MAX_EDGE_PX ? MAX_EDGE_PX / maxEdge : 1
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      ctx.drawImage(bitmap, 0, 0, w, h)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
      })
      if (!blob) return file
      if (blob.size >= file.size * 0.95) return file
      const base = file.name.replace(/\.[^.]+$/, '')
      return new File([blob], `${base || 'foto'}.jpg`, { type: 'image/jpeg' })
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}
