import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingPhotosR2,
  listCampingplatzFotosWithR2Keys,
  updateCampingplatzFotoR2,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { optimizeCampingPhotoToWebp } from '@/lib/camping-photo-optimize'
import { buildCampingplatzFotoObjectKey } from '@/lib/campingplatz-foto-import'

/** Pro Aufruf verarbeitete Fotos — vermeidet Worker-CPU-/Zeitlimits bei vielen Bildern. */
const BATCH_SIZE = 12

/**
 * Nachoptimierung bestehender R2-Campingfotos (WebP, max. Kante 1600, Qualität 85).
 *
 * Probelauf (`dryRun: true`): nur Datenbank — keine R2-Zugriffe (sofort, kein Worker-Timeout).
 *
 * Echter Lauf: mehrstufig mit `batchOffset` — Client ruft wiederholt auf, bis `complete: true`.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    let body: { dryRun?: boolean; batchOffset?: number } = {}
    try {
      body = (await request.json()) as { dryRun?: boolean; batchOffset?: number }
    } catch {
      body = {}
    }

    const dryRun = body.dryRun === true
    const batchOffset = Math.max(0, Math.floor(Number(body.batchOffset ?? 0)))

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const bucket = await getCampingPhotosR2(env)
    if (!bucket) {
      return NextResponse.json({ success: false, error: 'R2-Speicher nicht konfiguriert' }, { status: 503 })
    }

    const fotos = await listCampingplatzFotosWithR2Keys(db)
    const errors: string[] = []

    /** Schneller Probelauf: keine R2-/WASM-Arbeit — nur Zeilen aus D1 */
    if (dryRun) {
      const batchesNeeded = fotos.length === 0 ? 0 : Math.ceil(fotos.length / BATCH_SIZE)
      return NextResponse.json({
        success: true,
        data: {
          dryRun: true,
          total: fotos.length,
          batchSize: BATCH_SIZE,
          batchesNeeded,
          note:
            'Es wurden keine Bilddaten gelesen. Die echte Komprimierung erfolgt über mehrere Server-Anfragen („Bestand neu komprimieren“), um Zeitlimits zu vermeiden.',
        },
      })
    }

    const slice = fotos.slice(batchOffset, batchOffset + BATCH_SIZE)
    let processedInBatch = 0
    let skippedInBatch = 0
    let batchBytesBefore = 0
    let batchBytesAfter = 0

    for (const foto of slice) {
      const key = foto.r2_object_key
      if (!key) {
        skippedInBatch++
        continue
      }
      try {
        const obj = await bucket.get(key)
        if (!obj) {
          errors.push(`R2 fehlt: ${key}`)
          skippedInBatch++
          continue
        }
        const buf = new Uint8Array(await obj.arrayBuffer())
        batchBytesBefore += buf.byteLength
        const opt = await optimizeCampingPhotoToWebp(buf, obj.httpMetadata?.contentType)
        if (!opt) {
          skippedInBatch++
          continue
        }
        batchBytesAfter += opt.data.byteLength
        const newKey = buildCampingplatzFotoObjectKey(foto.campingplatz_id, foto.id, 'image/webp')

        await bucket.put(newKey, opt.data, { httpMetadata: { contentType: 'image/webp' } })
        const updated = await updateCampingplatzFotoR2(db, foto.id, newKey, 'image/webp')
        if (!updated) {
          errors.push(`DB-Update fehlgeschlagen: ${foto.id}`)
          try {
            await bucket.delete(newKey)
          } catch {
            /* ignore */
          }
          skippedInBatch++
          continue
        }
        if (newKey !== key) {
          try {
            await bucket.delete(key)
          } catch (e) {
            errors.push(`Altes R2-Objekt konnte nicht gelöscht werden (${key}): ${e instanceof Error ? e.message : String(e)}`)
          }
        }
        processedInBatch++
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`)
        skippedInBatch++
      }
    }

    const nextBatchOffset = batchOffset + slice.length
    const complete = nextBatchOffset >= fotos.length

    return NextResponse.json({
      success: true,
      data: {
        dryRun: false,
        complete,
        total: fotos.length,
        batchOffsetStart: batchOffset,
        batchSize: slice.length,
        processedInBatch,
        skippedInBatch,
        nextBatchOffset: complete ? null : nextBatchOffset,
        batchBytesBefore,
        batchBytesAfter,
        errors,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
