import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { getAttentionSnoozes, upsertAttentionSnooze } from '@/lib/db-attention'
import { requireAuth } from '@/lib/api-auth'
import { canAccessConfig, canReadOptimierung, canReadWartung } from '@/lib/permissions'
import { isAdminRole } from '@/lib/user-roles'
import { addCalendarDays, todayInAppTimezone } from '@/lib/app-timezone'
import { buildAttentionFeed, MAX_ATTENTION_ITEMS } from '@/lib/attention-feed'
import { loadAttentionFeedInput } from '@/lib/attention-feed-sources'
import {
  capSnoozeUntil,
  isSnoozePresetDays,
  parseSnoozeUntilYmd,
} from '@/lib/attention-snooze'
import { parseGeoPoint } from '@/lib/sonnen-hub-arrival'

function snoozeErrorMessage(reason: 'too_close' | 'overdue' | 'invalid' | 'past_due'): string {
  if (reason === 'overdue') {
    return 'Überfällige Sicherheitswartung kann nicht zurückgestellt werden.'
  }
  if (reason === 'too_close') {
    return 'Sicherheitswartung kann ab 21 Tage vor Fälligkeit nicht mehr zurückgestellt werden.'
  }
  if (reason === 'past_due') {
    return 'Zurückstellen über die Fälligkeit hinaus ist nicht möglich.'
  }
  return 'Ungültiges Zurückstell-Datum.'
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const itemKey = typeof o.item_key === 'string' ? o.item_key.trim() : ''
    const hasDays = o.days !== undefined && o.days !== null && o.days !== ''
    const hasUntil = o.until !== undefined && o.until !== null && o.until !== ''
    const days = hasDays ? (typeof o.days === 'number' ? o.days : Number(o.days)) : NaN
    const untilRaw = hasUntil ? o.until : null

    if (!itemKey) {
      return NextResponse.json({ error: 'item_key ist erforderlich' }, { status: 400 })
    }
    if (hasDays === hasUntil) {
      return NextResponse.json(
        { error: 'Genau eines von days oder until ist erforderlich' },
        { status: 400 }
      )
    }
    if (hasDays && !isSnoozePresetDays(days)) {
      return NextResponse.json({ error: 'days muss 1, 3 oder 7 sein' }, { status: 400 })
    }
    const untilYmd = hasUntil ? parseSnoozeUntilYmd(untilRaw) : null
    if (hasUntil && !untilYmd) {
      return NextResponse.json({ error: 'until muss ein Datum YYYY-MM-DD sein' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const includeAdminItems = canAccessConfig(userContext)
    const includeWartungItems = canReadWartung(userContext)
    const includeOptimierungItems = canReadOptimierung(userContext)
    const mitreisenderFilter =
      !isAdminRole(userContext.role) && userContext.mitreisenderId
        ? userContext.mitreisenderId
        : undefined

    const snoozes = await getAttentionSnoozes(db)
    const input = await loadAttentionFeedInput(db, {
      includeAdminItems,
      includeWartungItems,
      includeOptimierungItems,
      mitreisenderFilter,
      snoozes,
      userId: userContext.userId,
      userPosition: parseGeoPoint(o.lat, o.lng),
    })

    const feed = buildAttentionFeed(input)
    const item = feed.items.find((i) => i.key === itemKey)
    if (!item) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
    }

    const todayYmd = todayInAppTimezone()
    const requestedUntilYmd = hasDays ? addCalendarDays(todayYmd, days) : untilYmd!
    const cap = capSnoozeUntil({
      todayYmd,
      requestedUntilYmd,
      dueYmd: item.dueYmd,
      sicherheitsrelevant: item.sicherheitsrelevant,
    })
    if (!cap.allowed) {
      return NextResponse.json({ error: snoozeErrorMessage(cap.reason) }, { status: 400 })
    }

    const ok = await upsertAttentionSnooze(db, itemKey, cap.untilYmd)
    if (!ok) {
      return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }

    const updatedSnoozes = await getAttentionSnoozes(db)
    const updatedFeed = buildAttentionFeed({ ...input, snoozes: updatedSnoozes })
    return NextResponse.json({
      success: true,
      data: {
        ...updatedFeed,
        items: updatedFeed.items.slice(0, MAX_ATTENTION_ITEMS),
      },
      snoozed_until: cap.untilYmd,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
