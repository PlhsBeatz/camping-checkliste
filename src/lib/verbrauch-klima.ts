/**
 * Klimaproxy für typische Außentemperatur ohne Wetter-API.
 * Jahresgang + Breitenkorrektur (Europa), geeignet für Saisonvergleiche
 * (Ostern ≈ Herbst, Pfingsten wärmer).
 */

/** Mitteleuropa-Fallback, wenn keine Koordinaten bekannt. */
export const KLIMA_DEFAULT_LAT = 50

/** Maximaler |ΔT| für vergleichbare Reisen (°C). */
export const KLIMA_TEMP_DELTA_MAX_C = 3

export function dayOfYearFromYmd(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return 1
  const date = new Date(Date.UTC(y, m - 1, d))
  const start = new Date(Date.UTC(y, 0, 0))
  return Math.round((date.getTime() - start.getTime()) / 86_400_000)
}

/** Mittelpunkt zwischen zwei Kalenderdaten (inklusive), als YYYY-MM-DD. */
export function midYmdBetween(startYmd: string, endYmd: string): string {
  const a = startYmd.slice(0, 10)
  const b = endYmd.slice(0, 10)
  const [ys, ms, ds] = a.split('-').map(Number)
  const [ye, me, de] = b.split('-').map(Number)
  if (!ys || !ms || !ds || !ye || !me || !de) return a
  const t0 = Date.UTC(ys, ms - 1, ds)
  const t1 = Date.UTC(ye, me - 1, de)
  const mid = new Date(t0 + Math.round((t1 - t0) / 2))
  const y = mid.getUTCFullYear()
  const m = String(mid.getUTCMonth() + 1).padStart(2, '0')
  const d = String(mid.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Geschätzte mittlere Außentemperatur (°C) für Tag im Jahr und geografische Breite.
 * Amplitude und Phasenverschiebung an mitteleuropäisches Klima angelehnt.
 */
export function climateProxyTempC(dayOfYear: number, lat: number): number {
  const latClamped = Number.isFinite(lat) ? lat : KLIMA_DEFAULT_LAT
  // Jahresmittel sinkt mit Breite; Amplitude steigt leicht nach Norden
  const annualMean = 22 - 0.32 * latClamped
  const amplitude = 9 + Math.max(0, (latClamped - 45) * 0.25)
  // Maximum ~ Tag 200 (Mitte Juli), Sinus mit Phasenverschiebung
  const phase = ((dayOfYear - 30) / 365) * 2 * Math.PI
  return annualMean + amplitude * Math.sin(phase - Math.PI / 2)
}

export function climateProxyTempForYmd(ymd: string, lat: number | null | undefined): number {
  const day = dayOfYearFromYmd(ymd)
  const L = lat != null && Number.isFinite(lat) ? lat : KLIMA_DEFAULT_LAT
  return climateProxyTempC(day, L)
}

/** Lat vom längsten datierten Aufenthalt; sonst erster Stay mit Koordinaten. */
export function latFromCampingStays(
  stays: Array<{
    start_datum?: string | null
    end_datum?: string | null
    campingplatz?: { lat?: number | null } | null
  }>
): number | null {
  let bestLat: number | null = null
  let bestDays = -1
  for (const s of stays) {
    const lat = s.campingplatz?.lat
    if (lat == null || !Number.isFinite(lat)) continue
    if (s.start_datum && s.end_datum) {
      const [ys, ms, ds] = s.start_datum.slice(0, 10).split('-').map(Number)
      const [ye, me, de] = s.end_datum.slice(0, 10).split('-').map(Number)
      if (ys && ms && ds && ye && me && de) {
        const days = Math.round(
          (Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000
        )
        if (days >= bestDays) {
          bestDays = days
          bestLat = lat
        }
        continue
      }
    }
    if (bestLat == null) bestLat = lat
  }
  return bestLat
}
