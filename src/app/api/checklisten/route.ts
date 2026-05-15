import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getChecklistenFullTree,
  createCheckliste,
  reorderChecklisten,
  CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const data = await getChecklistenFullTree(db)
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const titel =
      body && typeof body === 'object' && typeof (body as { titel?: unknown }).titel === 'string'
        ? (body as { titel: string }).titel.trim()
        : ''
    if (!titel) {
      return NextResponse.json({ error: 'titel ist erforderlich' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const id = await createCheckliste(db, titel)
    if (!id) {
      return NextResponse.json({ error: 'Checkliste konnte nicht angelegt werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Reihenfolge der Checklisten (Übersicht) */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const orderedIds =
      body &&
      typeof body === 'object' &&
      Array.isArray((body as { orderedIds?: unknown }).orderedIds)
        ? (body as { orderedIds: unknown[] }).orderedIds.filter((x): x is string => typeof x === 'string')
        : null
    if (!orderedIds || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds (string[]) erforderlich' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await reorderChecklisten(db, orderedIds)
    if (!ok) {
      return NextResponse.json({ error: 'Sortierung fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
