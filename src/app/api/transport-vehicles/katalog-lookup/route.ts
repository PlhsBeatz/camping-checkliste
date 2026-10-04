import { NextRequest, NextResponse } from 'next/server'
import { getDB, lookupWohnwagenKatalog, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

/** GET /api/transport-vehicles/katalog-lookup?hersteller=&modell=&baujahr= */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const url = new URL(request.url)
    const hersteller = url.searchParams.get('hersteller')?.trim() ?? ''
    const modell = url.searchParams.get('modell')?.trim() ?? ''
    const baujahrRaw = url.searchParams.get('baujahr')
    const baujahr =
      baujahrRaw != null && baujahrRaw !== '' ? Number(baujahrRaw) : null

    if (!hersteller || !modell) {
      return NextResponse.json(
        { success: false, error: 'hersteller und modell sind erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const match = await lookupWohnwagenKatalog(db, hersteller, modell, baujahr)
    if (!match) {
      return NextResponse.json({ success: true, data: null })
    }
    return NextResponse.json({
      success: true,
      data: {
        ...match,
        imageUrl: match.r2_object_key
          ? `/api/transport-vehicles/katalog/${encodeURIComponent(match.id)}/image`
          : null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
