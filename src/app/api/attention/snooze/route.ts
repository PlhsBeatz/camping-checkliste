import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { getAttentionSnoozes, upsertAttentionSnooze } from '@/lib/db-attention'
import { requireAuth } from '@/lib/api-auth'
import { canAccessConfig, canReadOptimierung, canReadWartung } from '@/lib/permissions'
import { isAdminRole } from '@/lib/user-roles'
import { addCalendarDays, todayInAppTimezone } from '@/lib/app-timezone'
import { buildAttentionFeed, MAX_ATTENTION_ITEMS } from '@/lib/attention-feed'
import { loadAttentionFeedInput } from '@/lib/attention-feed-sources'
import { capSnoozeUntil, isSnoozePresetDays } from '@/lib/attention-snooze'
import { parseGeoPoint } from '@/lib/sonnen-hub-arrival'

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
    const days = typeof o.days === 'number' ? o.days : Number(o.days)
    if (!itemKey) {
      return NextResponse.json({ error: 'item_key ist erforderlich' }, { status: 400 })
    }
    if (!isSnoozePresetDays(days)) {
      return NextResponse.json({ error: 'days muss 1, 3 oder 7 sein' }, { status: 400 })
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

    const input = await loadAttentionFeedInput(db, {
      includeAdminItems,
      includeWartungItems,
      includeOptimierungItems,
      mitreisenderFilter,
      snoozes: new Map(),
      userId: userContext.userId,
      userPosition: parseGeoPoint(o.lat, o.lng),
    })

    const unsnoozed = buildAttentionFeed(input)
    const item = unsnoozed.items.find((i) => i.key === itemKey)
    if (!item) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
    }

    const todayYmd = todayInAppTimezone()
    const requestedUntilYmd = addCalendarDays(todayYmd, days)
    const cap = capSnoozeUntil({
      todayYmd,
      requestedUntilYmd,
      dueYmd: item.dueYmd,
      sicherheitsrelevant: item.sicherheitsrelevant,
    })
    if (!cap.allowed) {
      return NextResponse.json(
        {
          error:
            cap.reason === 'overdue'
              ? 'Überfällige Sicherheitswartung kann nicht zurückgestellt werden.'
              : 'Sicherheitswartung kann ab 21 Tage vor Fälligkeit nicht mehr zurückgestellt werden.',
        },
        { status: 400 }
      )
    }

    const ok = await upsertAttentionSnooze(db, itemKey, cap.untilYmd)
    if (!ok) {
      return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }

    const snoozes = await getAttentionSnoozes(db)
    const feed = buildAttentionFeed({ ...input, snoozes })
    return NextResponse.json({
      success: true,
      data: { ...feed, items: feed.items.slice(0, MAX_ATTENTION_ITEMS) },
      snoozed_until: cap.untilYmd,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
