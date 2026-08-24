import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { canAccessConfig, canReadOptimierung, canReadWartung } from '@/lib/permissions'
import { isAdminRole } from '@/lib/user-roles'
import { buildAttentionFeed, MAX_ATTENTION_ITEMS } from '@/lib/attention-feed'
import { loadAttentionFeedInput } from '@/lib/attention-feed-sources'
import { parseGeoPoint } from '@/lib/sonnen-hub-arrival'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const includeAdminItems = canAccessConfig(userContext)
    const includeWartungItems = canReadWartung(userContext)
    const includeOptimierungItems = canReadOptimierung(userContext)

    const mitreisenderFilter =
      !isAdminRole(userContext.role) && userContext.mitreisenderId
        ? userContext.mitreisenderId
        : undefined

    const { searchParams } = new URL(request.url)
    const userPosition = parseGeoPoint(searchParams.get('lat'), searchParams.get('lng'))

    const input = await loadAttentionFeedInput(db, {
      includeAdminItems,
      includeWartungItems,
      includeOptimierungItems,
      mitreisenderFilter,
      userId: userContext.userId,
      userPosition,
    })
    const feed = buildAttentionFeed(input)

    const payload = {
      ...feed,
      items: feed.items.slice(0, MAX_ATTENTION_ITEMS),
    }

    if (searchParams.get('count') === '1') {
      const res = NextResponse.json({ success: true, badgeCount: feed.badgeCount })
      res.headers.set('Cache-Control', 'private, no-store')
      return res
    }

    const res = NextResponse.json({ success: true, data: payload })
    res.headers.set('Cache-Control', 'private, no-store')
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
