/**
 * Campingplatz-Fotos: Objekte aus / in R2-Bucket „CAMPING_PHOTOS“ für Backup-Export/Import.
 */
import type { R2Bucket } from '@cloudflare/workers-types'

import type { R2CampingPhotoEntry } from './types'

export function collectR2KeysFromCampingplatzFotos(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>()
  for (const r of rows) {
    const k = r.r2_object_key
    if (typeof k === 'string' && k.trim().length > 0) keys.add(k.trim())
  }
  return [...keys]
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buf).toString('base64')
  }
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const u = Buffer.from(b64, 'base64')
    return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)
  }
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/**
 * Aus R2 lesen: Rohbytes für ZIP-Export (ohne Base64).
 */
export async function fetchR2CampingPhotoFilesForZip(
  bucket: R2Bucket,
  keys: string[]
): Promise<{ files: R2BinaryFile[]; warnings: string[] }> {
  const files: R2BinaryFile[] = []
  const warnings: string[] = []
  for (const key of keys) {
    try {
      const obj = await bucket.get(key)
      if (!obj) {
        warnings.push(`R2: Datei fehlt (Metadaten existieren in D1) — ${key}`)
        continue
      }
      const buf = new Uint8Array(await obj.arrayBuffer())
      const contentType = obj.httpMetadata?.contentType || 'application/octet-stream'
      files.push({ key, data: buf, contentType })
    } catch (e) {
      warnings.push(`R2 GET ${key}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { files, warnings }
}

export interface R2BinaryFile {
  key: string
  data: Uint8Array
  contentType: string
}

/**
 * Binärdateien (ZIP-Import) in R2 schreiben.
 */
export async function putBinaryR2ObjectsToBucket(
  bucket: R2Bucket,
  files: R2BinaryFile[],
  dryRun: boolean
): Promise<{ written: number; warnings: string[]; errors: string[] }> {
  const warnings: string[] = []
  const errors: string[] = []
  if (files.length === 0) {
    return { written: 0, warnings, errors }
  }
  if (dryRun) {
    warnings.push(`R2 (Probelauf): würde ${files.length} Objekt(e) schreiben — keine Bytes übertragen.`)
    return { written: 0, warnings, errors }
  }
  let written = 0
  for (const f of files) {
    if (typeof f.key !== 'string' || !f.key.trim()) {
      errors.push('R2: Eintrag ohne gültigen key übersprungen.')
      continue
    }
    if (!f.data || f.data.byteLength === 0) {
      errors.push(`R2: leere Daten für ${f.key}`)
      continue
    }
    try {
      const ct =
        typeof f.contentType === 'string' && f.contentType.trim()
          ? f.contentType
          : contentTypeFromKey(f.key)
      await bucket.put(f.key.trim(), f.data, {
        httpMetadata: { contentType: ct },
      })
      written++
    } catch (e) {
      errors.push(`R2 put ${f.key}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { written, warnings, errors }
}

export function contentTypeFromKey(r2Key: string): string {
  const lower = r2Key.toLowerCase()
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/**
 * Aus R2 lesen und als Base64-Einträge für das JSON-Bundle aufbauen (Legacy-Import).
 */
export async function fetchR2CampingPhotosForBackup(
  bucket: R2Bucket,
  keys: string[]
): Promise<{ objects: R2CampingPhotoEntry[]; warnings: string[] }> {
  const objects: R2CampingPhotoEntry[] = []
  const warnings: string[] = []
  for (const key of keys) {
    try {
      const obj = await bucket.get(key)
      if (!obj) {
        warnings.push(`R2: Datei fehlt (Metadaten existieren in D1) — ${key}`)
        continue
      }
      const buf = await obj.arrayBuffer()
      const contentType = obj.httpMetadata?.contentType || 'application/octet-stream'
      objects.push({
        key,
        contentType,
        dataBase64: arrayBufferToBase64(buf),
      })
    } catch (e) {
      warnings.push(`R2 GET ${key}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { objects, warnings }
}

/**
 * Base64-Objekte aus dem Backup in R2 schreiben (nach D1-Import der campingplatz_fotos-Zeilen).
 */
export async function putR2CampingPhotosFromBackup(
  bucket: R2Bucket,
  objects: R2CampingPhotoEntry[],
  dryRun: boolean
): Promise<{ written: number; warnings: string[]; errors: string[] }> {
  const warnings: string[] = []
  const errors: string[] = []
  if (objects.length === 0) {
    return { written: 0, warnings, errors }
  }
  if (dryRun) {
    warnings.push(`R2 (Probelauf): würde ${objects.length} Objekt(e) schreiben — keine Bytes übertragen.`)
    return { written: 0, warnings, errors }
  }
  let written = 0
  for (const o of objects) {
    if (typeof o.key !== 'string' || !o.key.trim()) {
      errors.push('R2: Eintrag ohne gültigen key übersprungen.')
      continue
    }
    if (typeof o.dataBase64 !== 'string' || o.dataBase64.length === 0) {
      errors.push(`R2: leere dataBase64 für ${o.key}`)
      continue
    }
    try {
      const body = base64ToArrayBuffer(o.dataBase64)
      const ct = typeof o.contentType === 'string' && o.contentType.trim() ? o.contentType : 'application/octet-stream'
      await bucket.put(o.key.trim(), body, {
        httpMetadata: { contentType: ct },
      })
      written++
    } catch (e) {
      errors.push(`R2 put ${o.key}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { written, warnings, errors }
}

export function parseR2CampingPhotosFromRaw(raw: unknown): {
  entries: R2CampingPhotoEntry[]
  warnings: string[]
} {
  const warnings: string[] = []
  if (raw === undefined || raw === null) return { entries: [], warnings }
  if (!Array.isArray(raw)) {
    warnings.push('r2CampingPhotos: kein Array — ignoriert.')
    return { entries: [], warnings }
  }
  const entries: R2CampingPhotoEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const key = o.key
    const dataBase64 = o.dataBase64
    const contentType = o.contentType
    if (typeof key !== 'string' || typeof dataBase64 !== 'string') {
      warnings.push('r2CampingPhotos: Eintrag ohne key/dataBase64 übersprungen.')
      continue
    }
    entries.push({
      key,
      dataBase64,
      contentType: typeof contentType === 'string' ? contentType : 'application/octet-stream',
    })
  }
  return { entries, warnings }
}
