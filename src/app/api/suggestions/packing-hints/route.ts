import { NextRequest, NextResponse } from 'next/server'
import { getCampingplaetzeForVacation, getDB, getEquipmentByTags, getVacation, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { seasonTagIdsForVacation } from '@/lib/packing-season-tags'
import { getPackingPatternSnapshot } from '@/lib/packing-patterns'
import { listSmartSuggestions } from '@/lib/smart-suggestions'
import {
  itemFitsTargetTrip,
  loadItemTripOccurrences,
  loadTripPackProfiles,
  profileFromVacation,
} from '@/lib/packing-trip-match'

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
    const [tagIds, snapshot, suggestions, vacation] = await Promise.all([
      seasonTagIdsForVacation(db, vacationId),
      getPackingPatternSnapshot(db),
      listSmartSuggestions(db, { status: 'open', kontextId: vacationId }),
      getVacation(db, vacationId),
    ])
    const packingHints = suggestions.filter(
      (s) => s.kind === 'packing_add' || s.kind === 'packing_copack' || s.kind === 'temp_promote'
    )
    const covered = await getEquipmentByTags(db, tagIds, true)
    const coveredIds = new Set(covered.map((item) => item.id))
    let frequentAdds = (snapshot?.frequent_adds ?? []).filter(
      (add) => !coveredIds.has(add.gegenstand_id)
    )
    if (vacation) {
      const trips = await loadTripPackProfiles(db)
      const itemOcc = await loadItemTripOccurrences(db, trips)
      const places = await getCampingplaetzeForVacation(db, vacation.id)
      const target = trips.get(vacation.id) ?? profileFromVacation(
        vacation,
        places.map((p) => p.land)
      )
      const allTrips = [...trips.values()]
      frequentAdds = frequentAdds.filter((add) => {
        const fit = itemFitsTargetTrip(target, itemOcc.get(add.gegenstand_id) ?? [], allTrips)
        return fit.ok
      })
    }
    return NextResponse.json({
      success: true,
      data: {
        seasonTagIds: tagIds,
        packingHints,
        frequentAdds,
        tempRepeats: snapshot?.temp_repeats ?? [],
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
