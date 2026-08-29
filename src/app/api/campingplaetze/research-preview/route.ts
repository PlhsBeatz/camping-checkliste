import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { researchDraftGaps } from '@/lib/platzplan-research'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as {
      name?: string
      webseite?: string | null
      adresse?: string | null
      oeffnungszeiten?: string | null
      platzplan_url?: string | null
      platzplan_url_vorlage?: string | null
    }

    const name = body.name?.trim() ?? ''
    if (!name && !body.webseite?.trim()) {
      return NextResponse.json(
        { success: false, error: 'name oder webseite ist erforderlich' },
        { status: 400 }
      )
    }

    const result = await researchDraftGaps(
      {
        name,
        webseite: body.webseite ?? null,
        adresse: body.adresse ?? null,
        oeffnungszeiten: body.oeffnungszeiten ?? null,
        platzplan_url: body.platzplan_url ?? null,
        platzplan_url_vorlage: body.platzplan_url_vorlage ?? null,
      },
      { apiKey: process.env.OPENROUTER_API_KEY?.trim() ?? null, maxPages: 8 }
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
