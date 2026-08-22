import { NextRequest, NextResponse } from 'next/server'
import { getDB, getFaelligkeitCountByTransportIds, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    if (!idsParam?.trim()) {
      return NextResponse.json({ success: true, data: {} })
    }
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const map = await getFaelligkeitCountByTransportIds(db, ids)
    const data: Record<string, number> = {}
    map.forEach((v, k) => {
      data[k] = v
    })
    const res = NextResponse.json({ success: true, data })
    res.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=300')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
