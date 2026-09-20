import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMedien,
  activateVerbrauchMediumFromKatalog,
  createCustomVerbrauchMedium,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireWriteWartung, requireReadWartung } from '@/lib/api-auth'
import { isKnownKatalogSchluessel, type VerbrauchMessmodus } from '@/lib/verbrauch-medien-katalog'

interface MedienPostBody {
  /** Katalog-Schlüssel aktivieren */
  schluessel?: string
  /** Eigenes Medium anlegen */
  name?: string
  einheit?: string
  messmodus?: VerbrauchMessmodus
  label_wert_start?: string
  label_wert_ende?: string
  sort_order?: number
  dichte_kg_pro_l?: number | null
  leergewicht_kg?: number | null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const readErr = requireReadWartung(auth.userContext)
    if (readErr) return readErr

    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get('active') === '1'

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const items = await getVerbrauchMedien(db, { onlyActive })
    return NextResponse.json({ success: true, data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const writeErr = requireWriteWartung(auth.userContext)
    if (writeErr) return writeErr

    const body = (await request.json()) as MedienPostBody
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    if (body.schluessel) {
      if (!isKnownKatalogSchluessel(body.schluessel)) {
        return NextResponse.json({ error: 'Unbekannter Katalog-Schlüssel' }, { status: 400 })
      }
      const item = await activateVerbrauchMediumFromKatalog(db, body.schluessel)
      if (!item) {
        return NextResponse.json({ error: 'Medium konnte nicht aktiviert werden' }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: item })
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Name oder Katalog-Schlüssel erforderlich' },
        { status: 400 }
      )
    }

    const item = await createCustomVerbrauchMedium(db, {
      name: body.name,
      einheit: body.einheit?.trim() || 'kg',
      messmodus: body.messmodus,
      label_wert_start: body.label_wert_start,
      label_wert_ende: body.label_wert_ende,
      sort_order: body.sort_order,
      dichte_kg_pro_l: body.dichte_kg_pro_l,
      leergewicht_kg: body.leergewicht_kg,
    })
    if (!item) {
      return NextResponse.json({ error: 'Medium konnte nicht angelegt werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: item })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
