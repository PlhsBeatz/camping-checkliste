import { differenceInCalendarDays } from 'date-fns'
import type { Campingplatz, Vacation } from '@/lib/db'

export function deriveReisezielName(
  reisezielName: string,
  campingIds: string[],
  allCampingplaetze: Campingplatz[]
): string {
  const trimmed = reisezielName.trim()
  if (trimmed) return trimmed
  const firstId = campingIds[0]
  if (!firstId) return ''
  const cp = allCampingplaetze.find((c) => c.id === firstId)
  if (!cp) return ''
  const loc = [cp.ort, cp.land].filter(Boolean).join(', ')
  return loc || cp.name
}

export type ReisezielDisplay = {
  name: string | null
  hint: string
}

export function getReisezielDisplay(
  vacation: Vacation,
  campingplaetze: Campingplatz[]
): ReisezielDisplay {
  if (vacation.reiseziel_name?.trim()) {
    return {
      name: vacation.reiseziel_name.trim(),
      hint: 'Beim Anlegen oder Bearbeiten des Urlaubs hinterlegt.',
    }
  }
  if (campingplaetze.length > 0) {
    const first = campingplaetze[0]!
    const derived = [first.ort, first.land].filter(Boolean).join(', ') || first.name
    return {
      name: derived,
      hint: 'Automatisch aus dem ersten zugeordneten Campingplatz abgeleitet (Ort und Land).',
    }
  }
  return {
    name: null,
    hint: 'Wird automatisch aus dem ersten zugeordneten Campingplatz abgeleitet, sobald einer zugeordnet ist.',
  }
}

export type VacationCountdown = {
  primary: string
  secondary: string | null
  tone: 'upcoming' | 'today' | 'active' | 'past'
}

export function getVacationCountdown(vacation: Vacation): VacationCountdown {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const departure = new Date(vacation.abfahrtdatum || vacation.startdatum)
  departure.setHours(0, 0, 0, 0)
  const start = new Date(vacation.startdatum)
  start.setHours(0, 0, 0, 0)
  const end = new Date(vacation.enddatum)
  end.setHours(0, 0, 0, 0)

  const daysUntilDeparture = differenceInCalendarDays(departure, today)
  const daysUntilEnd = differenceInCalendarDays(end, today)

  if (daysUntilEnd < 0) {
    const daysAgo = Math.abs(daysUntilEnd)
    return {
      primary: 'Beendet',
      secondary:
        daysAgo === 1 ? 'vor 1 Tag' : `vor ${daysAgo} Tagen`,
      tone: 'past',
    }
  }

  if (daysUntilDeparture > 0) {
    return {
      primary: daysUntilDeparture === 1 ? 'Noch 1 Tag' : `Noch ${daysUntilDeparture} Tage`,
      secondary: 'bis zur Abreise',
      tone: 'upcoming',
    }
  }

  if (daysUntilDeparture === 0) {
    return {
      primary: 'Heute geht\u2019s los!',
      secondary: null,
      tone: 'today',
    }
  }

  if (daysUntilEnd === 0) {
    return {
      primary: 'Reise läuft',
      secondary: 'Letzter Tag',
      tone: 'active',
    }
  }

  return {
    primary: 'Reise läuft',
    secondary:
      daysUntilEnd === 1 ? 'noch 1 Tag' : `noch ${daysUntilEnd + 1} Tage`,
    tone: 'active',
  }
}
