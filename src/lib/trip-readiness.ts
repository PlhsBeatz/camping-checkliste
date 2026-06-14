import {
  APP_TIMEZONE,
  addCalendarDays,
  differenceCalendarDays,
  normalizeCalendarDate,
  todayInAppTimezone,
} from '@/lib/app-timezone'
import type { PackingItem, Vacation } from '@/lib/db'

export type TripPhase =
  | 'planning'
  | 'departure_approaching'
  | 'departure_day'
  | 'on_trip'
  | 'returned'

export const PROGRESS_THRESHOLDS = [25, 50, 75, 90] as const

export function toYYYYMMDD(d: string | Date): string {
  return normalizeCalendarDate(d)
}

export function getDepartureDate(vacation: Vacation): string {
  const raw = vacation.abfahrtdatum?.trim() || vacation.startdatum?.trim() || ''
  return raw.slice(0, 10)
}

/** Packliste-Modus: welche Items zählen für Integrations-Fortschritt */
export function shouldCountPackingItem(
  item: PackingItem,
  departureDate: string,
  now = new Date()
): boolean {
  if (String(item.status || '').trim() === 'Immer gepackt') return false
  if (item.erst_abreisetag_gepackt && departureDate) {
    const abreiseStr = normalizeCalendarDate(departureDate)
    if (abreiseStr && todayInAppTimezone(now) !== abreiseStr) return false
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
  departureDate: string,
  now = new Date()
): PackingProgress {
  let total = 0
  let packed = 0
  const openItems: OpenPackingItem[] = []

  for (const item of items) {
    if (!shouldCountPackingItem(item, departureDate, now)) continue

    if (item.mitreisenden_typ === 'pauschal') {
      const modus = item.pauschal_gruppen_modus ?? 'einmal'
      if (modus === 'pro_gruppe' || modus === 'ausgewaehlte_gruppen') {
        for (const g of item.gruppen ?? []) {
          total += 1
          if (g.gepackt) {
            packed += 1
          } else {
            openItems.push({
              id: item.id,
              was: `${item.was} (${g.gruppe_name ?? g.gruppe_id})`,
              hauptkategorie: item.hauptkategorie,
              vorgemerkt: !!g.gepackt_vorgemerkt,
            })
          }
        }
      } else {
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

  const percent = total > 0 ? Math.round((packed / total) * 100) : 0
  const complete = total > 0 && packed >= total

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
  departureApproachingDays = 3,
  now = new Date()
): TripPhase {
  const today = todayInAppTimezone(now)
  const departure = normalizeCalendarDate(getDepartureDate(vacation))
  const end = normalizeCalendarDate(vacation.enddatum)

  const daysUntilDeparture = differenceCalendarDays(departure, today)
  const daysUntilEnd = differenceCalendarDays(end, today)

  if (daysUntilEnd < 0) return 'returned'
  if (daysUntilDeparture > departureApproachingDays) return 'planning'
  if (daysUntilDeparture > 0) return 'departure_approaching'
  if (daysUntilDeparture === 0) return 'departure_day'
  if (daysUntilEnd >= 0) return 'on_trip'
  return 'returned'
}

/** Nächster relevanter Urlaub (wie pack-status/page.tsx) */
export function findRelevantVacation(vacations: Vacation[], now = new Date()): Vacation | null {
  if (vacations.length === 0) return null
  const today = todayInAppTimezone(now)
  const cutoffDate = addCalendarDays(today, -7)

  const valid = vacations.filter((v) => {
    const endDate = normalizeCalendarDate(v.enddatum)
    return endDate >= cutoffDate
  })
  if (valid.length === 0) return null

  const upcoming = valid.filter((v) => normalizeCalendarDate(v.startdatum) >= today)
  const toUse = upcoming.length > 0 ? upcoming : valid
  return (
    toUse.sort(
      (a, b) =>
        normalizeCalendarDate(a.startdatum).localeCompare(normalizeCalendarDate(b.startdatum))
    )[0] ?? null
  )
}

export type TripStatusPayload = {
  schema_version: 1
  /** Kalendertag-Basis für phase und days_until_departure */
  calendar_timezone: typeof APP_TIMEZONE
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
  items: PackingItem[],
  now = new Date()
): TripStatusPayload {
  const departure_date = getDepartureDate(vacation)
  const today = todayInAppTimezone(now)
  const departure = normalizeCalendarDate(departure_date)
  const days_until_departure = differenceCalendarDays(departure, today)
  const progress = computePackingProgress(items, departure_date, now)
  const phase = getTripPhase(vacation, 3, now)

  return {
    schema_version: 1,
    calendar_timezone: APP_TIMEZONE,
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
