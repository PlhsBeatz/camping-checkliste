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

/**
 * Einmalige Nachoptimierung bestehender R2-Campingfotos (WebP, max. Kante 1600, Qualität 85).
 * POST JSON: { dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    let dryRun = false
    try {
      const body = (await request.json()) as { dryRun?: boolean }
      dryRun = body.dryRun === true
    } catch {
      dryRun = false
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const bucket = await getCampingPhotosR2(env)
    if (!bucket) {
      return NextResponse.json({ success: false, error: 'R2-Speicher nicht konfiguriert' }, { status: 503 })
    }

    const fotos = await listCampingplatzFotosWithR2Keys(db)
    let processed = 0
    let skipped = 0
    let bytesBefore = 0
    let bytesAfter = 0
    const errors: string[] = []

    for (const foto of fotos) {
      const key = foto.r2_object_key
      if (!key) {
        skipped++
        continue
      }
      try {
        const obj = await bucket.get(key)
        if (!obj) {
          errors.push(`R2 fehlt: ${key}`)
          skipped++
          continue
        }
        const buf = new Uint8Array(await obj.arrayBuffer())
        bytesBefore += buf.byteLength
        const opt = await optimizeCampingPhotoToWebp(buf, obj.httpMetadata?.contentType)
        if (!opt) {
          skipped++
          continue
        }
        bytesAfter += opt.data.byteLength
        const newKey = buildCampingplatzFotoObjectKey(foto.campingplatz_id, foto.id, 'image/webp')
        if (!dryRun) {
          await bucket.put(newKey, opt.data, { httpMetadata: { contentType: 'image/webp' } })
          const updated = await updateCampingplatzFotoR2(db, foto.id, newKey, 'image/webp')
          if (!updated) {
            errors.push(`DB-Update fehlgeschlagen: ${foto.id}`)
            try {
              await bucket.delete(newKey)
            } catch {
              /* ignore */
            }
            skipped++
            continue
          }
          if (newKey !== key) {
            try {
              await bucket.delete(key)
            } catch (e) {
              errors.push(`Altes R2-Objekt konnte nicht gelöscht werden (${key}): ${e instanceof Error ? e.message : String(e)}`)
            }
          }
        }
        processed++
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        dryRun,
        total: fotos.length,
        processed,
        skipped,
        errors,
        bytesBefore,
        bytesAfter,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
