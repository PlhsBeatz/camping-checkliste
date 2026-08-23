import {
  getCampingStaysForVacation,
  getChecklistenFullTree,
  getOptimierungen,
  getPackingItems,
  getPackStatus,
  getVacations,
  type PackingItem,
  type PackStatusData,
  type VacationCampingStay,
} from '@/lib/db'
import { getFaelligkeiten } from '@/lib/db-wartung'
import { getAttentionSnoozes } from '@/lib/db-attention'
import { findCurrentOrNextVacation, type AttentionFeedInput } from '@/lib/attention-feed'
import { findRelevantVacation } from '@/lib/trip-readiness'

export async function loadAttentionFeedInput(
  db: D1Database,
  opts: {
    includeAdminItems: boolean
    includeWartungItems: boolean
    includeOptimierungItems: boolean
    mitreisenderFilter?: string
    snoozes?: Map<string, string>
  }
): Promise<AttentionFeedInput> {
  const vacations = await getVacations(db, opts.mitreisenderFilter)
  const relevant = findRelevantVacation(vacations)
  const hubVacation = findCurrentOrNextVacation(vacations)
  const sameHub = !!relevant && !!hubVacation && relevant.id === hubVacation.id

  const [
    packingItems,
    packStatus,
    hubPackingExtra,
    hubStatusExtra,
    campingStays,
    faelligkeiten,
    checklisten,
    snoozes,
  ] = await Promise.all([
    relevant ? getPackingItems(db, relevant.id) : Promise.resolve<PackingItem[]>([]),
    relevant ? getPackStatus(db, relevant.id) : Promise.resolve<PackStatusData | null>(null),
    hubVacation && !sameHub
      ? getPackingItems(db, hubVacation.id)
      : Promise.resolve<PackingItem[] | null>(null),
    hubVacation && !sameHub
      ? getPackStatus(db, hubVacation.id)
      : Promise.resolve<PackStatusData | null>(null),
    hubVacation
      ? getCampingStaysForVacation(db, hubVacation.id)
      : Promise.resolve<VacationCampingStay[]>([]),
    opts.includeWartungItems ? getFaelligkeiten(db) : Promise.resolve([]),
    getChecklistenFullTree(db),
    opts.snoozes ? Promise.resolve(opts.snoozes) : getAttentionSnoozes(db),
  ])

  const optimierungen = opts.includeOptimierungItems ? await getOptimierungen(db) : []

  return {
    vacations,
    packingItems,
    packStatus,
    hubPackingItems: sameHub || !hubVacation ? packingItems : (hubPackingExtra ?? []),
    hubPackStatus: sameHub || !hubVacation ? packStatus : hubStatusExtra,
    campingStays,
    faelligkeiten,
    optimierungen,
    checklisten,
    snoozes,
    includeAdminItems: opts.includeAdminItems,
    includeWartungItems: opts.includeWartungItems,
    includeOptimierungItems: opts.includeOptimierungItems,
  }
}
