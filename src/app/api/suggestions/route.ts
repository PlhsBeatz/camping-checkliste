import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { isAdminRole } from '@/lib/user-roles'
import { isSnoozePresetDays } from '@/lib/attention-snooze'
import { applySmartSuggestionAccept } from '@/lib/smart-suggestion-actions'
import {
  countOpenSmartSuggestions,
  getSmartSuggestionById,
  listSmartSuggestions,
  setSmartSuggestionStatus,
  snoozeSmartSuggestion,
  suggestionAdminOnly,
  type SmartSuggestionKind,
  SMART_SUGGESTION_KINDS,
} from '@/lib/smart-suggestions'

function isKind(v: string): v is SmartSuggestionKind {
  return (SMART_SUGGESTION_KINDS as readonly string[]).includes(v)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { searchParams } = new URL(request.url)
    if (searchParams.get('count') === '1') {
      const count = await countOpenSmartSuggestions(db)
      return NextResponse.json({ success: true, data: { count } })
    }
    const kindRaw = searchParams.get('kind')
    const kind = kindRaw && isKind(kindRaw) ? kindRaw : undefined
    const kontextId = searchParams.get('kontextId') ?? undefined
    const status = searchParams.get('status') === 'all' ? undefined : 'open'
    const items = await listSmartSuggestions(db, { status, kind, kontextId })
    const visible = isAdminRole(auth.userContext.role)
      ? items
      : items.filter((s) => !suggestionAdminOnly(s.kind))
    return NextResponse.json({ success: true, data: visible })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      action?: string
      id?: string
      days?: number
    }
    if (!body.id || !body.action) {
      return NextResponse.json({ success: false, error: 'id und action erforderlich' }, { status: 400 })
    }
    const suggestion = await getSmartSuggestionById(db, body.id)
    if (!suggestion) {
      return NextResponse.json({ success: false, error: 'Vorschlag nicht gefunden' }, { status: 404 })
    }
    if (suggestionAdminOnly(suggestion.kind)) {
      const adminErr = requireAdmin(auth.userContext)
      if (adminErr) return adminErr
    }

    if (body.action === 'dismiss') {
      const updated = await setSmartSuggestionStatus(db, suggestion.id, 'dismissed')
      return NextResponse.json({ success: true, data: updated })
    }
    if (body.action === 'snooze') {
      const days = body.days ?? 7
      if (!isSnoozePresetDays(days) && days !== 7 && days !== 14 && days !== 30) {
        return NextResponse.json({ success: false, error: 'Ungültige Snooze-Dauer' }, { status: 400 })
      }
      const updated = await snoozeSmartSuggestion(db, suggestion.id, days)
      return NextResponse.json({ success: true, data: updated })
    }
    if (body.action === 'accept') {
      const result = await applySmartSuggestionAccept(db, suggestion)
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
      const updated = await getSmartSuggestionById(db, suggestion.id)
      return NextResponse.json({ success: true, data: updated })
    }
    return NextResponse.json({ success: false, error: 'Unbekannte action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
