import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getAllFaelligkeitEquipmentLinks,
  type CloudflareEnv,
  type FaelligkeitAmpelStatus,
} from '@/lib/db'
import { requireAuth, requireReadWartung } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const readErr = requireReadWartung(auth.userContext)
    if (readErr) return readErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { ampel, faelligkeitId } = await getAllFaelligkeitEquipmentLinks(db)
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
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
