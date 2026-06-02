import { differenceInCalendarDays } from 'date-fns'
import type { PackingItem, Vacation } from '@/lib/db'

export type TripPhase =
  | 'planning'
  | 'departure_approaching'
  | 'departure_day'
  | 'on_trip'
  | 'returned'

export const PROGRESS_THRESHOLDS = [25, 50, 75, 90] as const

export function toYYYYMMDD(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayDateStr(): string {
  return toYYYYMMDD(new Date())
}

export function getDepartureDate(vacation: Vacation): string {
  const raw = vacation.abfahrtdatum?.trim() || vacation.startdatum?.trim() || ''
  return raw.slice(0, 10)
}

/** Packliste-Modus: welche Items zählen für Integrations-Fortschritt */
export function shouldCountPackingItem(item: PackingItem, departureDate: string): boolean {
  if (String(item.status || '').trim() === 'Immer gepackt') return false
  if (item.erst_abreisetag_gepackt && departureDate) {
    const abreiseStr = toYYYYMMDD(departureDate)
    if (abreiseStr && todayDateStr() !== abreiseStr) return false
  }
  return true
}

export type OpenPackingItem = {
  id: string
  was: string
  hauptkategorie: string
  vorgemerkt?: boolean
}

export type PackingProgress = {
  total: number
  packed: number
  percent: number
  complete: boolean
  open_items_count: number
  openItems: OpenPackingItem[]
}

export function computePackingProgress(
  items: PackingItem[],
  departureDate: string
): PackingProgress {
  let total = 0
  let packed = 0
  const openItems: OpenPackingItem[] = []

  for (const item of items) {
    if (!shouldCountPackingItem(item, departureDate)) continue

    if (item.mitreisenden_typ === 'pauschal') {
      total += 1
      if (item.gepackt) {
        packed += 1
      } else {
        openItems.push({
          id: item.id,
          was: item.was,
          hauptkategorie: item.hauptkategorie,
          vorgemerkt: !!item.gepackt_vorgemerkt,
        })
      }
      continue
    }

    if (item.mitreisende && item.mitreisende.length > 0) {
      for (const m of item.mitreisende) {
        total += 1
        if (m.gepackt) {
          packed += 1
        } else {
          openItems.push({
            id: item.id,
            was: `${item.was} (${m.mitreisender_name})`,
            hauptkategorie: item.hauptkategorie,
            vorgemerkt: !!m.gepackt_vorgemerkt,
          })
        }
      }
    }
  }

  const percent = total > 0 ? Math.round((packed / total) * 100) : 100
  const complete = total === 0 || packed >= total

  return {
    total,
    packed,
    percent,
    complete,
    open_items_count: total - packed,
    openItems,
  }
}

export function getTripPhase(
  vacation: Vacation,
  departureApproachingDays = 3
): TripPhase {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const departure = new Date(getDepartureDate(vacation))
  departure.setHours(0, 0, 0, 0)
  const end = new Date(vacation.enddatum)
  end.setHours(0, 0, 0, 0)

  const daysUntilDeparture = differenceInCalendarDays(departure, today)
  const daysUntilEnd = differenceInCalendarDays(end, today)

  if (daysUntilEnd < 0) return 'returned'
  if (daysUntilDeparture > departureApproachingDays) return 'planning'
  if (daysUntilDeparture > 0) return 'departure_approaching'
  if (daysUntilDeparture === 0) return 'departure_day'
  if (daysUntilEnd >= 0) return 'on_trip'
  return 'returned'
}

/** Nächster relevanter Urlaub (wie pack-status/page.tsx) */
export function findRelevantVacation(vacations: Vacation[]): Vacation | null {
  if (vacations.length === 0) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cutoffDate = new Date(today)
  cutoffDate.setDate(cutoffDate.getDate() - 7)

  const valid = vacations.filter((v) => {
    const endDate = new Date(v.enddatum)
    endDate.setHours(0, 0, 0, 0)
    return endDate >= cutoffDate
  })
  if (valid.length === 0) return null

  const upcoming = valid.filter((v) => new Date(v.startdatum) >= today)
  const toUse = upcoming.length > 0 ? upcoming : valid
  return (
    toUse.sort(
      (a, b) => new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime()
    )[0] ?? null
  )
}

export type TripStatusPayload = {
  schema_version: 1
  vacation: {
    id: string
    titel: string
    startdatum: string
    abfahrtdatum: string | null
    enddatum: string
    reiseziel_name: string
    departure_date: string
  }
  phase: TripPhase
  days_until_departure: number
  packing: {
    percent: number
    complete: boolean
    packed: number
    total: number
  }
  readiness: {
    ready_to_depart: boolean
    open_items_count: number
  }
}

export function buildTripStatusPayload(
  vacation: Vacation,
  items: PackingItem[]
): TripStatusPayload {
  const departure_date = getDepartureDate(vacation)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const departure = new Date(departure_date)
  departure.setHours(0, 0, 0, 0)
  const days_until_departure = differenceInCalendarDays(departure, today)
  const progress = computePackingProgress(items, departure_date)
  const phase = getTripPhase(vacation)

  return {
    schema_version: 1,
    vacation: {
      id: vacation.id,
      titel: vacation.titel,
      startdatum: vacation.startdatum,
      abfahrtdatum: vacation.abfahrtdatum ?? null,
      enddatum: vacation.enddatum,
      reiseziel_name: vacation.reiseziel_name,
      departure_date,
    },
    phase,
    days_until_departure,
    packing: {
      percent: progress.percent,
      complete: progress.complete,
      packed: progress.packed,
      total: progress.total,
    },
    readiness: {
      ready_to_depart: progress.complete,
      open_items_count: progress.open_items_count,
    },
  }
}
