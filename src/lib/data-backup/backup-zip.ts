/**
 * Admin-Backup als ZIP: backup.json + export-meta.json + Binärdateien unter r2/<object key>
 */
import { strFromU8, strToU8, unzipSync, zip } from 'fflate'

export const ZIP_BACKUP_JSON = 'backup.json'
export const ZIP_EXPORT_META = 'export-meta.json'
export const ZIP_R2_PREFIX = 'r2/'

export interface ZipExportMeta {
  warnings: string[]
}

export async function buildBackupZipBuffer(opts: {
  bundle: unknown
  warnings: string[]
  r2Files: Array<{ key: string; data: Uint8Array }>
}): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  const jsonText = JSON.stringify(opts.bundle, null, 2)
  files[ZIP_BACKUP_JSON] = strToU8(jsonText)
  files[ZIP_EXPORT_META] = strToU8(
    JSON.stringify({ warnings: opts.warnings } satisfies ZipExportMeta, null, 0)
  )
  for (const f of opts.r2Files) {
    const path = `${ZIP_R2_PREFIX}${f.key.replace(/\\/g, '/')}`
    files[path] = f.data
  }

  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function normalizeZipPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '')
}

function findZipEntry(files: Record<string, Uint8Array>, basename: string): Uint8Array | undefined {
  const n = basename.toLowerCase()
  for (const [k, v] of Object.entries(files)) {
    const parts = normalizeZipPath(k).split('/')
    const last = parts[parts.length - 1]
    if (last?.toLowerCase() === n) return v
  }
  return undefined
}

export function parseBackupZip(buf: Uint8Array): {
  rawBundle: unknown
  r2Files: Map<string, Uint8Array>
  warningsFromZip: string[]
  parseWarnings: string[]
} {
  const parseWarnings: string[] = []
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(buf)
  } catch (e) {
    throw new Error(`ZIP konnte nicht gelesen werden: ${e instanceof Error ? e.message : String(e)}`)
  }

  const flat: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(unzipped)) {
    flat[normalizeZipPath(k)] = v
  }

  const backupRaw = findZipEntry(flat, ZIP_BACKUP_JSON) ?? flat[ZIP_BACKUP_JSON]
  if (!backupRaw) {
    throw new Error('ZIP enthält keine backup.json')
  }

  let rawBundle: unknown
  try {
    rawBundle = JSON.parse(strFromU8(backupRaw))
  } catch (e) {
    throw new Error(`backup.json ist kein gültiges JSON: ${e instanceof Error ? e.message : String(e)}`)
  }

  let warningsFromZip: string[] = []
  const metaRaw = findZipEntry(flat, ZIP_EXPORT_META) ?? flat[ZIP_EXPORT_META]
  if (metaRaw) {
    try {
      const meta = JSON.parse(strFromU8(metaRaw)) as ZipExportMeta
      if (Array.isArray(meta.warnings)) warningsFromZip = meta.warnings.filter((w) => typeof w === 'string')
      else parseWarnings.push('export-meta.json: warnings fehlen oder ungültig')
    } catch {
      parseWarnings.push('export-meta.json konnte nicht gelesen werden')
    }
  }

  const r2Files = new Map<string, Uint8Array>()
  const prefix = ZIP_R2_PREFIX.toLowerCase()
  for (const [path, data] of Object.entries(flat)) {
    const p = normalizeZipPath(path)
    if (p.toLowerCase().startsWith(prefix)) {
      const objectKey = p.slice(ZIP_R2_PREFIX.length)
      if (objectKey.length > 0) r2Files.set(objectKey, data)
    }
  }

  return { rawBundle, r2Files, warningsFromZip, parseWarnings }
}

export function isZipMagic(buf: Uint8Array): boolean {
  return buf.byteLength >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
}
