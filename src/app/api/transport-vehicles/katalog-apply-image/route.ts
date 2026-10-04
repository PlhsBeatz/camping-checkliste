import { NextRequest, NextResponse } from 'next/server'
import {
  getCampingPhotosR2,
  getDB,
  getTransportVehicleById,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  clearKatalogGrundrissImage,
  clearTransportGrundrissImage,
  getWohnwagenKatalogById,
  setKatalogGrundrissImage,
  setTransportGrundrissImage,
} from '@/lib/wohnwagen-katalog-db'
import {
  buildWohnwagenKatalogImageKey,
  fetchProcessAndStoreFloorplan,
} from '@/lib/wohnwagen-katalog-research'
import { processGrundrissImage } from '@/lib/grundriss-image-process'

/**
 * POST /api/transport-vehicles/katalog-apply-image
 * User-gewähltes Bild verarbeiten und speichern.
 *
 * body: {
 *   katalogId: string
 *   applyToTransportId?: string | null
 *   mode: 'url' | 'keep' | 'reprocess-existing' | 'skip' | 'clear'
 *   imageUrl?: string  // bei mode=url
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as {
      katalogId?: string
      applyToTransportId?: string | null
      mode?: 'url' | 'keep' | 'reprocess-existing' | 'skip' | 'clear'
      imageUrl?: string | null
    }

    const katalogId = typeof body.katalogId === 'string' ? body.katalogId.trim() : ''
    if (!katalogId) {
      return NextResponse.json({ success: false, error: 'katalogId erforderlich' }, { status: 400 })
    }
    const mode = body.mode ?? 'url'
    const transportId = body.applyToTransportId?.trim() || null

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const bucket = await getCampingPhotosR2(env)
    if (!bucket) {
      return NextResponse.json(
        { success: false, error: 'R2 nicht verfügbar' },
        { status: 503 }
      )
    }

    const entry = await getWohnwagenKatalogById(db, katalogId)
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Katalogeintrag nicht gefunden' },
        { status: 404 }
      )
    }

    if (mode === 'skip') {
      // Nur Auswahl schließen – gespeichertes Bild bleibt unverändert
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: null,
          warning: null as string | null,
          kept: true,
          skipped: true,
          cleared: false,
        },
      })
    }

    if (mode === 'clear') {
      await clearKatalogGrundrissImage(db, katalogId)
      if (transportId) {
        await clearTransportGrundrissImage(db, transportId)
      }
      // Optional: R2-Objekt belassen (orphan ok) – Keys aus DB entfernt
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: null,
          warning: 'Gespeichertes Grundriss-Bild entfernt.',
          kept: false,
          skipped: false,
          cleared: true,
        },
      })
    }

    if (mode === 'keep') {
      const r2Key = entry.r2_object_key
      let contentType = entry.content_type || 'image/webp'
      if (!r2Key && transportId) {
        const vehicle = await getTransportVehicleById(db, transportId)
        if (vehicle?.grundriss_bild_r2_key) {
          return NextResponse.json({
            success: true,
            data: {
              imageUrl: `/api/transport-vehicles/${encodeURIComponent(transportId)}/grundriss-image?t=${Date.now()}`,
              warning: null as string | null,
              kept: true,
              skipped: false,
            },
          })
        }
      }
      if (!r2Key) {
        return NextResponse.json(
          { success: false, error: 'Kein bestehendes Bild zum Behalten' },
          { status: 400 }
        )
      }
      if (transportId) {
        await setTransportGrundrissImage(db, transportId, { r2Key, contentType })
      }
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: `/api/transport-vehicles/katalog/${encodeURIComponent(katalogId)}/image?t=${Date.now()}`,
          warning: null as string | null,
          kept: true,
          skipped: false,
        },
      })
    }

    if (mode === 'reprocess-existing') {
      let sourceKey = entry.r2_object_key
      let sourceMime = entry.content_type || 'image/jpeg'
      if (!sourceKey && transportId) {
        const vehicle = await getTransportVehicleById(db, transportId)
        if (vehicle?.grundriss_bild_r2_key) {
          sourceKey = vehicle.grundriss_bild_r2_key
          sourceMime = vehicle.grundriss_bild_content_type || sourceMime
        }
      }
      if (!sourceKey) {
        return NextResponse.json(
          { success: false, error: 'Kein bestehendes Bild zum Neuverarbeiten' },
          { status: 400 }
        )
      }
      const obj = await bucket.get(sourceKey)
      if (!obj) {
        return NextResponse.json(
          { success: false, error: 'Bilddatei fehlt in R2' },
          { status: 404 }
        )
      }
      const bytes = new Uint8Array(await obj.arrayBuffer())
      const mime = obj.httpMetadata?.contentType || sourceMime
      const processed = await processGrundrissImage(bytes, mime)
      if (!processed.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Neuverarbeitung fehlgeschlagen: ${processed.reason}`,
          },
          { status: 422 }
        )
      }
      const r2Key = buildWohnwagenKatalogImageKey(katalogId, processed.mime)
      await bucket.put(r2Key, processed.data, {
        httpMetadata: { contentType: processed.mime },
      })
      await setKatalogGrundrissImage(db, katalogId, {
        r2Key,
        contentType: processed.mime,
        sourceUrl: entry.grundriss_bild_url,
      })
      if (transportId) {
        await setTransportGrundrissImage(db, transportId, {
          r2Key,
          contentType: processed.mime,
        })
      }
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: `/api/transport-vehicles/katalog/${encodeURIComponent(katalogId)}/image?t=${Date.now()}`,
          warning: processed.cropped
            ? 'Bestehendes Bild neu zugeschnitten.'
            : 'Bestehendes Bild neu gespeichert.',
          kept: false,
          skipped: false,
        },
      })
    }

    // mode === 'url'
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'imageUrl erforderlich' },
        { status: 400 }
      )
    }

    const stored = await fetchProcessAndStoreFloorplan({
      imageUrl,
      katalogId,
      bucket,
      referer: entry.source_url,
    })
    await setKatalogGrundrissImage(db, katalogId, {
      r2Key: stored.r2Key,
      contentType: stored.contentType,
      sourceUrl: stored.sourceUrl,
    })
    if (transportId) {
      await setTransportGrundrissImage(db, transportId, {
        r2Key: stored.r2Key,
        contentType: stored.contentType,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: `/api/transport-vehicles/katalog/${encodeURIComponent(katalogId)}/image?t=${Date.now()}`,
        warning: stored.warning,
        kept: false,
        skipped: false,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
