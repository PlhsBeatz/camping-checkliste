import { NextRequest, NextResponse } from 'next/server'
import type { D1Database } from '@cloudflare/workers-types'
import {
  getDB,
  getMitreisendeForVacation,
  getPackingItems,
  getPacklisteId,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import {
  clearXorIgnoreForPackliste,
  ignoreXorGroupForPackliste,
  listAlternativeGroups,
  pruneXorIgnoresForPackliste,
} from '@/lib/packing-alternatives'

async function assertVacationAccess(
  request: NextRequest,
  vacationId: string
): Promise<
  | { ok: true; db: D1Database; env: CloudflareEnv }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return { ok: false, response: auth }

  const env = process.env as unknown as CloudflareEnv
  const db = await getDB(env)
  const mitreisende = await getMitreisendeForVacation(db, vacationId)
  if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 }),
    }
  }
  return { ok: true, db, env }
}

async function ignoredIdsForVacation(db: D1Database, vacationId: string): Promise<string[]> {
  const packlisteId = await getPacklisteId(db, vacationId)
  if (!packlisteId) return []

  const [groups, items] = await Promise.all([
    listAlternativeGroups(db),
    getPackingItems(db, vacationId),
  ])
  const packedIds = items.map((i) => i.gegenstand_id).filter((id): id is string => !!id)
  return pruneXorIgnoresForPackliste(db, packlisteId, groups, packedIds)
}

export async function GET(request: NextRequest) {
  try {
    const vacationId = new URL(request.url).searchParams.get('vacationId')
    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId ist erforderlich' }, { status: 400 })
    }

    const access = await assertVacationAccess(request, vacationId)
    if (!access.ok) return access.response

    const ignoredGroupIds = await ignoredIdsForVacation(access.db, vacationId)
    return NextResponse.json({ success: true, data: { ignoredGroupIds } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const vacationId = typeof o.vacationId === 'string' ? o.vacationId.trim() : ''
    const gruppeId = typeof o.gruppeId === 'string' ? o.gruppeId.trim() : ''
    if (!vacationId || !gruppeId) {
      return NextResponse.json(
        { error: 'vacationId und gruppeId sind erforderlich' },
        { status: 400 }
      )
    }

    const access = await assertVacationAccess(request, vacationId)
    if (!access.ok) return access.response

    const packlisteId = await getPacklisteId(access.db, vacationId)
    if (!packlisteId) {
      return NextResponse.json({ error: 'Keine Packliste für diesen Urlaub' }, { status: 404 })
    }

    const ok = await ignoreXorGroupForPackliste(access.db, packlisteId, gruppeId)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Ignorieren fehlgeschlagen' }, { status: 500 })
    }

    await notifyPackingSyncChange(access.env, vacationId)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const vacationId = typeof o.vacationId === 'string' ? o.vacationId.trim() : ''
    const gruppeId = typeof o.gruppeId === 'string' ? o.gruppeId.trim() : ''
    if (!vacationId || !gruppeId) {
      return NextResponse.json(
        { error: 'vacationId und gruppeId sind erforderlich' },
        { status: 400 }
      )
    }

    const access = await assertVacationAccess(request, vacationId)
    if (!access.ok) return access.response

    const packlisteId = await getPacklisteId(access.db, vacationId)
    if (!packlisteId) {
      return NextResponse.json({ error: 'Keine Packliste für diesen Urlaub' }, { status: 404 })
    }

    const ok = await clearXorIgnoreForPackliste(access.db, packlisteId, gruppeId)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Löschen fehlgeschlagen' }, { status: 500 })
    }

    await notifyPackingSyncChange(access.env, vacationId)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
