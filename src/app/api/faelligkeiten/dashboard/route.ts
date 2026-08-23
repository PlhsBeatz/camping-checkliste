import { NextRequest, NextResponse } from 'next/server'
import { getDB, getFaelligkeitDashboard, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireReadWartung } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const readErr = requireReadWartung(auth.userContext)
    if (readErr) return readErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const data = await getFaelligkeitDashboard(db)
    const res = NextResponse.json({ success: true, data })
    res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
