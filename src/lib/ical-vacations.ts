import { addCalendarDays, normalizeCalendarDate } from '@/lib/app-timezone'
import type { Vacation, VacationCampingStay } from '@/lib/db'

export type IcalView = 'summary' | 'stays'

export const ICAL_FEED_KEYS = ['summary', 'summary_dep', 'stays', 'stays_dep'] as const
export type IcalFeedKey = (typeof ICAL_FEED_KEYS)[number]

export function icalFeedKey(view: IcalView, includeDeparture: boolean): IcalFeedKey {
  if (view === 'summary') return includeDeparture ? 'summary_dep' : 'summary'
  return includeDeparture ? 'stays_dep' : 'stays'
}

export function parseIcalView(raw: string | null): IcalView | null {
  if (raw == null || raw === '' || raw === 'summary') return 'summary'
  if (raw === 'stays') return 'stays'
  return null
}

export function parseIncludeDeparture(raw: string | null): boolean {
  if (raw == null || raw === '' || raw === '0' || raw === 'false') return false
  return raw === '1' || raw === 'true'
}

type VEvent = {
  uid: string
  summary: string
  description: string
  dtStart: string
  dtEndExclusive: string
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function ymdToIcsDate(ymd: string): string {
  return normalizeCalendarDate(ymd).replace(/-/g, '')
}

function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  parts.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`)
    remaining = remaining.slice(74)
  }
  return parts.join('\r\n')
}

function buildVEvent(event: VEvent): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtcStamp(new Date())}`,
    `DTSTART;VALUE=DATE:${ymdToIcsDate(event.dtStart)}`,
    `DTEND;VALUE=DATE:${ymdToIcsDate(event.dtEndExclusive)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    'END:VEVENT',
  ]
  return lines.map(foldLine).join('\r\n')
}

function formatUtcStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function vacationDescription(v: Vacation): string {
  const parts = [
    v.reiseziel_name?.trim() ? `Ziel: ${v.reiseziel_name.trim()}` : null,
    `Start: ${normalizeCalendarDate(v.startdatum)}`,
    v.abfahrtdatum?.trim()
      ? `Abfahrt: ${normalizeCalendarDate(v.abfahrtdatum)}`
      : null,
    `Ende: ${normalizeCalendarDate(v.enddatum)}`,
  ]
  return parts.filter(Boolean).join('\n')
}

function hasDistinctAbfahrtdatum(v: Vacation): boolean {
  const abfahrt = v.abfahrtdatum?.trim()
  if (!abfahrt) return false
  return normalizeCalendarDate(abfahrt) !== normalizeCalendarDate(v.startdatum)
}

function departureEvent(v: Vacation): VEvent | null {
  if (!hasDistinctAbfahrtdatum(v)) return null
  const day = normalizeCalendarDate(v.abfahrtdatum!)
  return {
    uid: `vacation-${v.id}-departure@camping-packliste`,
    summary: `Abfahrt: ${v.titel}`,
    description: vacationDescription(v),
    dtStart: day,
    dtEndExclusive: addCalendarDays(day, 1),
  }
}

function summaryEvent(v: Vacation): VEvent {
  const start = normalizeCalendarDate(v.startdatum)
  const end = normalizeCalendarDate(v.enddatum)
  return {
    uid: `vacation-${v.id}@camping-packliste`,
    summary: v.titel,
    description: vacationDescription(v),
    dtStart: start,
    dtEndExclusive: addCalendarDays(end, 1),
  }
}

function stayEvent(v: Vacation, stay: VacationCampingStay): VEvent {
  const start = normalizeCalendarDate(stay.start_datum || v.startdatum)
  const end = normalizeCalendarDate(stay.end_datum || v.enddatum)
  const placeName = stay.campingplatz?.name?.trim() || v.titel
  return {
    uid: `vacation-stay-${stay.id}@camping-packliste`,
    summary: placeName,
    description: [
      `Urlaub: ${v.titel}`,
      stay.campingplatz?.name?.trim() ? `Campingplatz: ${stay.campingplatz.name.trim()}` : null,
      vacationDescription(v),
    ]
      .filter(Boolean)
      .join('\n'),
    dtStart: start,
    dtEndExclusive: addCalendarDays(end, 1),
  }
}

export function buildVacationsIcs(options: {
  vacations: Vacation[]
  staysByVacationId: Map<string, VacationCampingStay[]>
  view: IcalView
  includeDeparture: boolean
  calendarName?: string
}): string {
  const {
    vacations,
    staysByVacationId,
    view,
    includeDeparture,
    calendarName = 'Camping Packliste Urlaube',
  } = options

  const events: VEvent[] = []

  for (const v of vacations) {
    if (view === 'summary') {
      events.push(summaryEvent(v))
    } else {
      const stays = staysByVacationId.get(v.id) ?? []
      if (stays.length === 0) {
        events.push(summaryEvent(v))
      } else {
        for (const stay of stays) {
          events.push(stayEvent(v, stay))
        }
      }
    }

    if (includeDeparture) {
      const dep = departureEvent(v)
      if (dep) events.push(dep)
    }
  }

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Camping Packliste//Urlaubskalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ]

  const body = events.map(buildVEvent)
  return [...header, ...body, 'END:VCALENDAR'].join('\r\n') + '\r\n'
}

export const ICAL_FEED_META: {
  feedKey: IcalFeedKey
  view: IcalView
  includeDeparture: boolean
  label: string
  description: string
  calendarName: string
}[] = [
  {
    feedKey: 'summary',
    view: 'summary',
    includeDeparture: false,
    label: 'Zusammengefasst',
    description: 'Ein Event pro Urlaub (Startdatum–Ende)',
    calendarName: 'Camping Packliste – Urlaube',
  },
  {
    feedKey: 'summary_dep',
    view: 'summary',
    includeDeparture: true,
    label: 'Zusammengefasst + Abfahrt',
    description: 'Urlaubstitel plus separates Abfahrts-Event bei abweichendem Abfahrtsdatum',
    calendarName: 'Camping Packliste – Urlaube inkl. Abfahrt',
  },
  {
    feedKey: 'stays',
    view: 'stays',
    includeDeparture: false,
    label: 'Campingplätze einzeln',
    description: 'Ein Event pro Campingplatz-Aufenthalt',
    calendarName: 'Camping Packliste – Aufenthalte',
  },
  {
    feedKey: 'stays_dep',
    view: 'stays',
    includeDeparture: true,
    label: 'Campingplätze + Abfahrt',
    description: 'Einzelne Aufenthalte plus separates Abfahrts-Event',
    calendarName: 'Camping Packliste – Aufenthalte inkl. Abfahrt',
  },
]
