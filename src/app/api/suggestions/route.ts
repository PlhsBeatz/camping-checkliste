import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { D1Database } from '@cloudflare/workers-types'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { isAdminRole } from '@/lib/user-roles'
import { isSnoozePresetDays } from '@/lib/attention-snooze'
import { applySmartSuggestionAccept } from '@/lib/smart-suggestion-actions'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import {
  countOpenSmartSuggestions,
  getSmartSuggestionById,
  listSmartSuggestions,
  setSmartSuggestionStatus,
  snoozeSmartSuggestion,
  suggestionAdminOnly,
  type SmartSuggestion,
  type SmartSuggestionKind,
  SMART_SUGGESTION_KINDS,
} from '@/lib/smart-suggestions'

function isKind(v: string): v is SmartSuggestionKind {
  return (SMART_SUGGESTION_KINDS as readonly string[]).includes(v)
}

async function attachVacationTitles(
  db: D1Database,
  items: SmartSuggestion[]
): Promise<void> {
  const ids = [
    ...new Set(
      items
        .filter(
          (s) =>
            (s.kind === 'packing_add' || s.kind === 'packing_copack') &&
            !String(s.payload.vacation_titel ?? '').trim()
        )
        .map((s) => String(s.payload.vacation_id ?? s.kontext_id ?? ''))
        .filter(Boolean)
    ),
  ]
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db
    .prepare(`SELECT id, titel FROM urlaube WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<{ id: string; titel: string }>()
  const titles = new Map((rows.results ?? []).map((r) => [r.id, r.titel]))
  for (const s of items) {
    if (s.kind !== 'packing_add' && s.kind !== 'packing_copack') continue
    if (String(s.payload.vacation_titel ?? '').trim()) continue
    const id = String(s.payload.vacation_id ?? s.kontext_id ?? '')
    const titel = titles.get(id)
    if (titel) s.payload = { ...s.payload, vacation_titel: titel }
  }
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
    const id = searchParams.get('id')?.trim()
    if (id) {
      const one = await getSmartSuggestionById(db, id)
      const visible =
        one && (isAdminRole(auth.userContext.role) || !suggestionAdminOnly(one.kind)) ? [one] : []
      await attachVacationTitles(db, visible)
      return NextResponse.json({ success: true, data: visible })
    }
    const kindRaw = searchParams.get('kind')
    const kind = kindRaw && isKind(kindRaw) ? kindRaw : undefined
    const kontextId = searchParams.get('kontextId') ?? undefined
    const status = searchParams.get('status') === 'all' ? undefined : 'open'
    const items = await listSmartSuggestions(db, { status, kind, kontextId })
    const visible = isAdminRole(auth.userContext.role)
      ? items
      : items.filter((s) => !suggestionAdminOnly(s.kind))
    await attachVacationTitles(db, visible)
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
      url?: string
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
      const result = await applySmartSuggestionAccept(db, suggestion, {
        url: body.url?.trim() || null,
      })
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
      if (suggestion.kind === 'packing_add' || suggestion.kind === 'packing_copack') {
        const vacationId = String(suggestion.payload.vacation_id ?? suggestion.kontext_id ?? '')
        if (vacationId) {
          const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
          await notifyPackingSyncChange(cfEnv, vacationId)
          await notifyIntegrationChange(cfEnv, vacationId)
        }
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
