import { NextRequest, NextResponse } from 'next/server'
import { getDB, getMitreisendeBerechtigungen, setMitreisendeBerechtigungen, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(_request)
    if (auth instanceof NextResponse) return auth
    const adminCheck = requireAdmin(auth.userContext)
    if (adminCheck) return adminCheck

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const berechtigungen = await getMitreisendeBerechtigungen(db, id)
    return NextResponse.json({ success: true, data: berechtigungen })
  } catch (error) {
    console.error('Error fetching berechtigungen:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminCheck = requireAdmin(auth.userContext)
    if (adminCheck) return adminCheck

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })
    }

    const body = (await request.json()) as { berechtigungen?: string[] }
    const berechtigungen = Array.isArray(body.berechtigungen) ? body.berechtigungen : []

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const success = await setMitreisendeBerechtigungen(db, id, berechtigungen)
    if (!success) {
      return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving berechtigungen:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
