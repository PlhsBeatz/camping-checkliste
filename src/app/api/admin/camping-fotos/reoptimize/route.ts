import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingPhotosR2,
  listCampingplatzFotosWithR2Keys,
  updateCampingplatzFotoR2,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  detectCampingPhotoKind,
  optimizeCampingPhotoToWebp,
  peekRasterMegapixels,
} from '@/lib/camping-photo-optimize'
import { buildCampingplatzFotoObjectKey } from '@/lib/campingplatz-foto-import'

/**
 * Cloudflare Workers Free: ca. 10 ms CPU und max. 50 Subrequests je Aufruf.
 * Ein Foto (R2 GET/PUT, D1-Updates, ggf. Löschen) verbraucht mehrere Schritte;
 * zusätzliche WASM-Verarbeitung — daher Standard: **ein** Foto pro Request.
 */
function getReoptimizeBatchSize(): number {
  const raw = process.env.REOPTIMIZE_BATCH_SIZE
  if (raw != null && raw !== '') {
    const n = Math.floor(Number(raw))
    if (Number.isFinite(n) && n >= 1) return Math.min(n, 50)
  }
  return 1
}

/** Etwas leichtere WebP‑Parameter nur für Bulk-Nachlauf (Workers-CPU unter Free Limits). Neue Uploads bleiben 1600 px @ 85 %. */
function getReoptimizeEncodeOptions(): { maxEdge: number; webpQuality: number } {
  const defEdge = 896
  const defQuality = 72
  const maxEdgeRaw = process.env.REOPTIMIZE_MAX_EDGE
  const qRaw = process.env.REOPTIMIZE_WEBP_QUALITY
  let maxEdge =
    maxEdgeRaw != null && maxEdgeRaw !== ''
      ? Math.floor(Number(maxEdgeRaw))
      : defEdge
  let webpQuality =
    qRaw != null && qRaw !== ''
      ? Math.floor(Number(qRaw))
      : defQuality
  if (!Number.isFinite(maxEdge)) maxEdge = defEdge
  if (!Number.isFinite(webpQuality)) webpQuality = defQuality
  maxEdge = Math.min(Math.max(maxEdge, 480), 1600)
  webpQuality = Math.min(Math.max(webpQuality, 50), 95)
  return { maxEdge, webpQuality }
}

/**
 * Vor der Volldekodierung: JPEG-/PNG-Schätzung (Header), um `exceededCpu` auf Workers Free zu vermeiden.
 * WebP ohne Headerpeek zählen nicht gegen dieses Limit.
 */
function getReoptimizeMaxDecodeMegapixels(): number {
  const raw = process.env.REOPTIMIZE_MAX_DECODE_MEGAPIXELS
  const def = 5
  if (raw == null || raw === '') return def
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0.25) return def
  return Math.min(n, 200)
}

/**
 * Nachoptimierung bestehender R2-Campingfotos (Bulk: WebP, Standard max. Kante 896 px, Qualität 72 — über Env anpassbar).
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

    const batchLimit = getReoptimizeBatchSize()
    const encodeOpts = getReoptimizeEncodeOptions()
    const maxDecodeMegapixels = getReoptimizeMaxDecodeMegapixels()

    /** Schneller Probelauf: keine R2-/WASM-Arbeit — nur Zeilen aus D1 */
    if (dryRun) {
      const batchesNeeded = fotos.length === 0 ? 0 : Math.ceil(fotos.length / batchLimit)
      return NextResponse.json({
        success: true,
        data: {
          dryRun: true,
          total: fotos.length,
          batchSize: batchLimit,
          batchesNeeded,
          reoptimizeEncode: encodeOpts,
          maxDecodeMegapixels,
          note:
            'Es wurden keine Bilddaten gelesen. Auf Cloudflare Free ist standardmäßig ein Bild pro Server-Anfrage (über REOPTIMIZE_BATCH_SIZE erhöhbar). Bulk nutzt leichtere WebP‑Parameter als frische Uploads (REOPTIMIZE_MAX_EDGE / REOPTIMIZE_WEBP_QUALITY). Großflächige JPG/PNG werden vor der Dekodierung begrenzt (REOPTIMIZE_MAX_DECODE_MEGAPIXELS, Standard 5 MP).',
        },
      })
    }

    const slice = fotos.slice(batchOffset, batchOffset + batchLimit)
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
        const guessedMp = peekRasterMegapixels(buf, obj.httpMetadata?.contentType)
        if (guessedMp != null && guessedMp > maxDecodeMegapixels) {
          errors.push(
            `${key}: sehr große Vorlage (~${guessedMp.toFixed(
              1,
            )} MP; Dekodierungsgrenze Nachkomprimierung ${maxDecodeMegapixels} MP). Überspringe, damit Workers Free‑CPU nicht überschritten wird.`,
          )
          skippedInBatch++
          continue
        }
        const opt = await optimizeCampingPhotoToWebp(buf, obj.httpMetadata?.contentType, {
          ...encodeOpts,
          maxDecodeMegapixels,
        })
        if (!opt) {
          const fmt = detectCampingPhotoKind(buf, obj.httpMetadata?.contentType)
          let detail: string
          if (!fmt) {
            detail =
              'Datei konnte nicht als JPEG/PNG/WebP erkannt werden (MIME-Typ oder Inhalt passt nicht).'
          } else if (fmt === 'jpeg' || fmt === 'png') {
            const mpLabel =
              guessedMp != null ? `~${guessedMp.toFixed(2)} MP, ` : 'Megapixelzahl nicht aus Header ermittelbar, '
            detail = `${fmt.toUpperCase()}, ${mpLabel}unter der Dekodierungsgrenze oder Grenze nicht prüfbar — Dekodierung oder WebP‑Encode ist fehlgeschlagen (beschädigte Daten, unübliches JPEG‑Profil, PNG zu groß/komplex, oder Workers‑Limits).`
          } else {
            detail =
              `${fmt.toUpperCase()} — Dekodierung oder Neu‑Encode fehlgeschlagen (beschädigte Daten oder Codec‑Limits).`
          }
          errors.push(`${key}: ${detail}`)
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
        batchSizeConfigured: batchLimit,
        batchSize: slice.length,
        reoptimizeEncode: encodeOpts,
        maxDecodeMegapixels,
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
