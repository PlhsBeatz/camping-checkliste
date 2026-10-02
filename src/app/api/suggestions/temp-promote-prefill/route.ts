import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import {
  buildTempPromotePrefill,
  fetchTempPromoteSamples,
} from '@/lib/temp-promote-prefill'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const was = searchParams.get('was')?.trim() ?? ''
    const kategorieId = searchParams.get('kategorie_id')?.trim() ?? ''
    if (!was || !kategorieId) {
      return NextResponse.json(
        { success: false, error: 'was und kategorie_id erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const samples = await fetchTempPromoteSamples(db, was, kategorieId)
    const prefill = buildTempPromotePrefill(was, samples)

    return NextResponse.json({
      success: true,
      data: {
        form: {
          was: prefill.form.was,
          kategorie_id: prefill.form.kategorie_id,
          transport_id: prefill.form.transport_id,
          einzelgewicht: prefill.form.einzelgewicht,
          standard_anzahl: prefill.form.standard_anzahl,
        },
        hints: prefill.hints,
        sampleCount: prefill.sampleCount,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
