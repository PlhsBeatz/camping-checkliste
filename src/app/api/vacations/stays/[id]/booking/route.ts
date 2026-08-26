import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { updateCampingStayBooking } from '@/lib/booking-db'
import type { StayBookingFields } from '@/lib/booking-types'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id: stayId } = await params
    const body = (await request.json()) as StayBookingFields

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await updateCampingStayBooking(db, stayId, body)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Speichern fehlgeschlagen' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
