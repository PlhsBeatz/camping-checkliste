import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingplaetzeForVacation,
  setCampingplaetzeForVacation,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('urlaubId') || searchParams.get('vacationId')
    if (!vacationId) {
      return NextResponse.json(
        { success: false, error: 'urlaubId/vacationId is required' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const campingplaetze = await getCampingplaetzeForVacation(db, vacationId)
    return NextResponse.json({ success: true, data: campingplaetze })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = (await request.json()) as {
      urlaubId?: string
      vacationId?: string
      campingplatzIds?: string[]
    }

    const vacationId = body.urlaubId || body.vacationId
    const campingplatzIds = body.campingplatzIds ?? []

    if (!vacationId) {
      return NextResponse.json(
        { success: false, error: 'urlaubId/vacationId is required' },
        { status: 400 }
      )
    }

    const ok = await setCampingplaetzeForVacation(db, vacationId, campingplatzIds)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to set campingplaetze for vacation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

