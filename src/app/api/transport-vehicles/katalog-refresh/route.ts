import { NextRequest, NextResponse } from 'next/server'
import {
  getCampingPhotosR2,
  getDB,
  type CloudflareEnv,
  type WohnwagenKatalogEntry,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  researchAndUpsertWohnwagenKatalog,
  type FloorplanCandidate,
} from '@/lib/wohnwagen-katalog-research'

export type KatalogRefreshResponse = {
  entry: WohnwagenKatalogEntry
  /** Vorhandenes Bild (noch nicht durch User-Wahl ersetzt) */
  imageUrl: string | null
  imageApplied: boolean
  imageWarning?: string | null
  sourceNotes?: string | null
  massKlarheit?: string | null
  /** Bis zu 8 Kandidaten zur manuellen Auswahl */
  imageCandidates: FloorplanCandidate[]
  existingImageUrl: string | null
  katalogId: string
}

/** POST /api/transport-vehicles/katalog-refresh – Netz-Recherche Maße + Bildkandidaten */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const apiKey = env.OPENROUTER_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY ist nicht konfiguriert' },
        { status: 503 }
      )
    }

    const body = (await request.json()) as {
      hersteller?: string
      modell?: string
      baujahr?: number | null
      applyToTransportId?: string | null
    }

    const hersteller = typeof body.hersteller === 'string' ? body.hersteller.trim() : ''
    const modell = typeof body.modell === 'string' ? body.modell.trim() : ''
    if (!hersteller || !modell) {
      return NextResponse.json(
        { success: false, error: 'hersteller und modell sind erforderlich' },
        { status: 400 }
      )
    }

    const baujahr =
      body.baujahr != null && body.baujahr !== ('' as unknown as number)
        ? Number(body.baujahr)
        : null

    const db = await getDB(env)
    const bucket = await getCampingPhotosR2(env)

    const result = await researchAndUpsertWohnwagenKatalog({
      hersteller,
      modell,
      baujahr: baujahr != null && Number.isFinite(baujahr) ? baujahr : null,
      apiKey,
      db,
      bucket,
      applyToTransportId: body.applyToTransportId?.trim() || null,
    })

    const existingImageUrl = result.existingImageUrl
    const data: KatalogRefreshResponse = {
      entry: result.entry,
      imageUrl: existingImageUrl,
      imageApplied: false,
      imageWarning: result.imageWarning,
      sourceNotes: result.sourceNotes,
      massKlarheit: result.massKlarheit,
      imageCandidates: result.imageCandidates,
      existingImageUrl,
      katalogId: result.entry.id,
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
