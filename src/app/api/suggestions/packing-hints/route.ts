import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { seasonTagIdsForVacation } from '@/lib/packing-season-tags'
import { getPackingPatternSnapshot } from '@/lib/packing-patterns'
import { listSmartSuggestions } from '@/lib/smart-suggestions'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const vacationId = new URL(request.url).searchParams.get('vacationId')
    if (!vacationId) {
      return NextResponse.json({ success: false, error: 'vacationId erforderlich' }, { status: 400 })
    }
    const [tagIds, snapshot, suggestions] = await Promise.all([
      seasonTagIdsForVacation(db, vacationId),
      getPackingPatternSnapshot(db),
      listSmartSuggestions(db, { status: 'open', kontextId: vacationId }),
    ])
    const packingHints = suggestions.filter(
      (s) => s.kind === 'packing_add' || s.kind === 'packing_copack' || s.kind === 'temp_promote'
    )
    return NextResponse.json({
      success: true,
      data: {
        seasonTagIds: tagIds,
        packingHints,
        frequentAdds: snapshot?.frequent_adds ?? [],
        tempRepeats: snapshot?.temp_repeats ?? [],
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
