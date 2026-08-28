import { NextRequest, NextResponse } from 'next/server'
import { getDB, getPackingItems, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  conflictIfAdding,
  conflictsForPackingList,
  createAlternativeGroup,
  listAlternativeGroups,
  replacementAfterRemoving,
} from '@/lib/packing-alternatives'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const params = new URL(request.url).searchParams
    const vacationId = params.get('vacationId')
    const addingId = params.get('addingId')
    const removedId = params.get('removedId')
    const removedWas = params.get('removedWas') ?? ''

    const groups = await listAlternativeGroups(db)
    if (!vacationId) {
      return NextResponse.json({ success: true, data: { groups, conflicts: [], addConflict: null, replacement: null } })
    }
    const items = await getPackingItems(db, vacationId)
    const packedIds = items.map((i) => i.gegenstand_id).filter((id): id is string => !!id)
    const conflicts = conflictsForPackingList(groups, packedIds)
    const addConflict = addingId ? conflictIfAdding(groups, packedIds, addingId) : null
    const replacement =
      removedId ? replacementAfterRemoving(groups, packedIds, removedId, removedWas) : null
    return NextResponse.json({
      success: true,
      data: { groups, conflicts, addConflict, replacement },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as { gegenstandIds?: string[]; titel?: string }
    const group = await createAlternativeGroup(db, body.gegenstandIds ?? [], body.titel ?? null)
    if (!group) {
      return NextResponse.json({ success: false, error: 'Mindestens zwei Gegenstände' }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: group })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
