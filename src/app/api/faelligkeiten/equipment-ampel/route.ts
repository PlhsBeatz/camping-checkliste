import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getFaelligkeitSummaryByEquipmentIds,
  type CloudflareEnv,
  type FaelligkeitAmpelStatus,
} from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    if (!idsParam?.trim()) {
      return NextResponse.json({
        success: true,
        data: { ampel: {}, faelligkeitId: {} },
      })
    }
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { ampel, faelligkeitId } = await getFaelligkeitSummaryByEquipmentIds(db, ids)
    const ampelData: Record<string, FaelligkeitAmpelStatus> = {}
    const faelligkeitIdData: Record<string, string> = {}
    ampel.forEach((v, k) => {
      ampelData[k] = v
    })
    faelligkeitId.forEach((v, k) => {
      faelligkeitIdData[k] = v
    })
    const res = NextResponse.json({
      success: true,
      data: { ampel: ampelData, faelligkeitId: faelligkeitIdData },
    })
    res.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=300')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
