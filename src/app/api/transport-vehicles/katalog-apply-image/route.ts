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
  deleteStaleKatalogImages,
  fetchProcessAndStoreFloorplan,
} from '@/lib/wohnwagen-katalog-research'
import { processGrundrissImage } from '@/lib/grundriss-image-process'

function imageResponseUrl(opts: {
  katalogId: string
  transportId: string | null
}): string {
  const t = Date.now()
  if (opts.transportId) {
    return `/api/transport-vehicles/${encodeURIComponent(opts.transportId)}/grundriss-image?t=${t}`
  }
  return `/api/transport-vehicles/katalog/${encodeURIComponent(opts.katalogId)}/image?t=${t}`
}

async function persistImageKeys(opts: {
  db: Awaited<ReturnType<typeof getDB>>
  katalogId: string
  transportId: string | null
  r2Key: string
  contentType: string
  sourceUrl?: string | null
}): Promise<void> {
  const katalogOk = await setKatalogGrundrissImage(opts.db, opts.katalogId, {
    r2Key: opts.r2Key,
    contentType: opts.contentType,
    sourceUrl: opts.sourceUrl ?? null,
  })
  if (!katalogOk) {
    throw new Error('Katalog-Bild konnte nicht gespeichert werden')
  }
  if (opts.transportId) {
    const transportOk = await setTransportGrundrissImage(opts.db, opts.transportId, {
      r2Key: opts.r2Key,
      contentType: opts.contentType,
    })
    if (!transportOk) {
      throw new Error(
        'Bild im Katalog gespeichert, aber Fahrzeug-Bild konnte nicht überschrieben werden'
      )
    }
  }
}

/**
 * POST /api/transport-vehicles/katalog-apply-image
 * User-gewähltes Bild verarbeiten und speichern (überschreibt vorhandenes).
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
      try {
        const listed = await bucket.list({ prefix: `wwk/${katalogId}/` })
        for (const obj of listed.objects) {
          if (obj.key) await bucket.delete(obj.key)
        }
      } catch {
        /* orphan ok */
      }
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
      const contentType = entry.content_type || 'image/webp'
      if (!r2Key && transportId) {
        const vehicle = await getTransportVehicleById(db, transportId)
        if (vehicle?.grundriss_bild_r2_key) {
          return NextResponse.json({
            success: true,
            data: {
              imageUrl: imageResponseUrl({ katalogId, transportId }),
              warning: null as string | null,
              kept: true,
              skipped: false,
              cleared: false,
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
        const ok = await setTransportGrundrissImage(db, transportId, { r2Key, contentType })
        if (!ok) {
          return NextResponse.json(
            { success: false, error: 'Fahrzeug-Bild konnte nicht aktualisiert werden' },
            { status: 500 }
          )
        }
      }
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: imageResponseUrl({ katalogId, transportId }),
          warning: null as string | null,
          kept: true,
          skipped: false,
          cleared: false,
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
      await deleteStaleKatalogImages(bucket, katalogId, r2Key)
      await persistImageKeys({
        db,
        katalogId,
        transportId,
        r2Key,
        contentType: processed.mime,
        sourceUrl: entry.grundriss_bild_url,
      })
      return NextResponse.json({
        success: true,
        data: {
          imageUrl: imageResponseUrl({ katalogId, transportId }),
          warning: processed.cropped
            ? 'Bestehendes Bild neu zugeschnitten.'
            : 'Bestehendes Bild neu gespeichert.',
          kept: false,
          skipped: false,
          cleared: false,
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

    let referer = entry.source_url
    if (!referer || /\.pdf(\?|$)/i.test(referer)) {
      try {
        referer = new URL(imageUrl).origin + '/'
      } catch {
        referer = 'https://caravanvergelijker.nl/'
      }
    }

    const stored = await fetchProcessAndStoreFloorplan({
      imageUrl,
      katalogId,
      bucket,
      referer,
    })
    await persistImageKeys({
      db,
      katalogId,
      transportId,
      r2Key: stored.r2Key,
      contentType: stored.contentType,
      sourceUrl: stored.sourceUrl,
    })

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: imageResponseUrl({ katalogId, transportId }),
        warning: stored.warning,
        kept: false,
        skipped: false,
        cleared: false,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
