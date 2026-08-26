import type { Campingplatz } from './db'

/** Baut die Platzplan-URL mit optional eingesetzter Platznummer. */
export function buildPlatzplanUrl(
  campingplatz: Pick<
    Campingplatz,
    'platzplan_url' | 'platzplan_url_vorlage'
  >,
  platznummer?: string | null
): string | null {
  const num = platznummer?.trim()
  if (num && campingplatz.platzplan_url_vorlage) {
    return campingplatz.platzplan_url_vorlage.replace(/\{platznummer\}/gi, encodeURIComponent(num))
  }
  if (campingplatz.platzplan_url) return campingplatz.platzplan_url
  return null
}
