import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMedienAusruestungLinks,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireReadWartung } from '@/lib/api-auth'

/** Alle Medium↔Ausrüstung-Links in einer Abfrage (kein N+1 pro Medium). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const readErr = requireReadWartung(auth.userContext)
    if (readErr) return readErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const links = await getVerbrauchMedienAusruestungLinks(db)
    return NextResponse.json({ success: true, data: links })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
