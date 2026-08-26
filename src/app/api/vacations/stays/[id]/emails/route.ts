import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { getEmailsForStay } from '@/lib/booking-db'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id: stayId } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const emails = await getEmailsForStay(db, stayId)
    return NextResponse.json({ success: true, data: emails })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
