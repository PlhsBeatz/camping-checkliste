import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getVacation,
  getMitreisendeForVacation,
  getCampingplaetzeForVacation,
} from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Fehlende ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const vacation = await getVacation(db, id)
    if (!vacation) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const [mitreisende, campingplaetze] = await Promise.all([
      getMitreisendeForVacation(db, id),
      getCampingplaetzeForVacation(db, id),
    ])

    if (!canAccessVacation(userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ success: false, error: 'Kein Zugriff' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: { vacation, mitreisende, campingplaetze },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
