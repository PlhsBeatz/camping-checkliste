/**
 * Fälligkeitsberechnung für Optimierungen (Chips → konkretes faellig_am).
 *
 * - naechster_urlaub: 1 Woche vor Abfahrt (abfahrtdatum || startdatum) des nächsten zukünftigen Urlaubs
 * - saisonstart: nächster Saisonstart relativ zum Bezugstag (Anlegen/Bearbeiten der Fälligkeit):
 *   Anker = erster Urlaub des Kalenderjahres, sonst 1. März; Fälligkeit = Anker − 7 Tage.
 *   Es zählt der früheste Anker, der am Bezugstag noch nicht vorbei ist.
 * - irgendwann: kein Datum, kein Reminder
 *
 * Winterpause entfällt fachlich (= Saisonstart).
 */
import type { Vacation } from '@/lib/db'
import {
  addCalendarDays,
  normalizeCalendarDate,
  todayInAppTimezone,
} from '@/lib/app-timezone'

export type OptimierungFaelligkeitModus =
  | 'naechster_urlaub'
  | 'saisonstart'
  | 'irgendwann'

export const FAELLIGKEIT_MODUS_LABEL: Record<OptimierungFaelligkeitModus, string> = {
  naechster_urlaub: 'Nächster Urlaub',
  saisonstart: 'Saisonstart',
  irgendwann: 'Irgendwann',
}

/** Abreisetag wie Packliste: abfahrtdatum falls gesetzt, sonst startdatum */
export function vacationAbreiseYmd(
  v: Pick<Vacation, 'startdatum' | 'abfahrtdatum'>
): string | null {
  const raw = (v.abfahrtdatum?.trim() || v.startdatum || '').trim()
  if (!raw) return null
  const ymd = normalizeCalendarDate(raw)
  return ymd || null
}

function vacationsInYear(
  vacations: Vacation[],
  year: number
): { vacation: Vacation; abreise: string }[] {
  const out: { vacation: Vacation; abreise: string }[] = []
  for (const v of vacations) {
    const abreise = vacationAbreiseYmd(v)
    if (!abreise) continue
    if (Number(abreise.slice(0, 4)) !== year) continue
    out.push({ vacation: v, abreise })
  }
  out.sort((a, b) => a.abreise.localeCompare(b.abreise))
  return out
}

function futureVacations(
  vacations: Vacation[],
  todayYmd: string
): { vacation: Vacation; abreise: string }[] {
  const out: { vacation: Vacation; abreise: string }[] = []
  for (const v of vacations) {
    const abreise = vacationAbreiseYmd(v)
    if (!abreise) continue
    if (abreise < todayYmd) continue
    out.push({ vacation: v, abreise })
  }
  out.sort((a, b) => a.abreise.localeCompare(b.abreise))
  return out
}

/**
 * Nächster Saisonstart-Anker ab Bezugstag (inkl.):
 * erster Urlaub des Jahres bzw. 1. März, sobald dieser Anker >= Bezugstag.
 */
/**
 * Letzter Saisonstart-Anker, der am Stichtag bereits erreicht ist
 * (erster Urlaub des Jahres bzw. 1. März).
 */
export function resolveCurrentSaisonstartAnchor(
  vacations: Vacation[],
  todayYmd: string
): string {
  const startYear = Number(todayYmd.slice(0, 4))
  for (let y = startYear; y >= startYear - 6; y--) {
    const first = vacationsInYear(vacations, y)[0]
    const anchor = first?.abreise ?? `${y}-03-01`
    if (anchor <= todayYmd) return anchor
  }
  return `${startYear}-03-01`
}

export function resolveNextSaisonstartAnchor(
  vacations: Vacation[],
  bezugYmd: string
): string {
  const startYear = Number(bezugYmd.slice(0, 4))
  for (let y = startYear; y <= startYear + 6; y++) {
    const first = vacationsInYear(vacations, y)[0]
    const anchor = first?.abreise ?? `${y}-03-01`
    if (anchor >= bezugYmd) return anchor
  }
  return `${startYear + 1}-03-01`
}

/**
 * @param bezugYmd Bezugstag für Saisonstart (wann Fälligkeit gesetzt/geändert wurde).
 *                 Default: heute. Für naechster_urlaub irrelevant (immer ab heute).
 */
export function computeFaelligAm(
  modus: OptimierungFaelligkeitModus | null | undefined,
  vacations: Vacation[],
  opts?: { bezugYmd?: string | null; now?: Date }
): string | null {
  if (!modus || modus === 'irgendwann') return null

  const now = opts?.now ?? new Date()
  const todayYmd = todayInAppTimezone(now)

  if (modus === 'naechster_urlaub') {
    const next = futureVacations(vacations, todayYmd)[0]
    if (!next) return null
    return addCalendarDays(next.abreise, -7)
  }

  // saisonstart: Bezug = Setzzeitpunkt der Fälligkeit (nicht „heute bei jedem Recalc“)
  const bezugYmd = opts?.bezugYmd?.trim() || todayYmd
  const anchor = resolveNextSaisonstartAnchor(vacations, bezugYmd)
  return addCalendarDays(anchor, -7)
}

export function isOptimierungFaelligkeitModus(
  v: unknown
): v is OptimierungFaelligkeitModus {
  return v === 'naechster_urlaub' || v === 'saisonstart' || v === 'irgendwann'
}

/** Anzeigehilfetext unter dem Chip / in der Liste */
export function describeFaelligkeit(
  modus: OptimierungFaelligkeitModus | null | undefined,
  faelligAm: string | null | undefined,
  vacations: Vacation[],
  now = new Date()
): string | null {
  if (!modus) return null
  if (modus === 'irgendwann') return null
  if (faelligAm) {
    const [y, m, d] = faelligAm.split('-').map(Number)
    if (y && m && d) {
      const label = new Date(y, m - 1, d).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      return `Fällig am ${label}`
    }
  }
  if (modus === 'naechster_urlaub') {
    const todayYmd = todayInAppTimezone(now)
    if (futureVacations(vacations, todayYmd).length === 0) {
      return 'Kein zukünftiger Urlaub — Datum folgt nach Planung'
    }
  }
  return null
}
