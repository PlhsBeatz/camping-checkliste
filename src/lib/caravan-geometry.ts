/** Meter-Offset relativ zur Fahrzeugmitte → Lat/Lng (lokal, kleine Distanzen). */

const METERS_PER_DEG_LAT = 111_320

export type MeterPoint = [number, number]

export function parseGrundrissJson(raw: string | null | undefined): MeterPoint[] | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length < 3) return null
    const pts: MeterPoint[] = []
    for (const p of parsed) {
      if (!Array.isArray(p) || p.length < 2) return null
      const x = Number(p[0])
      const y = Number(p[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      pts.push([x, y])
    }
    return pts
  } catch {
    return null
  }
}

/** Rechteck: Länge längs y (Bug → Heck), Breite längs x. Mitte = 0,0; Bug = +y/2. */
export function rectangleGrundriss(laengeM: number, breiteM: number): MeterPoint[] {
  const hx = breiteM / 2
  const hy = laengeM / 2
  return [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ]
}

export function resolveCaravanOutline(opts: {
  laengeM?: number | null
  breiteM?: number | null
  grundrissJson?: string | null
}): MeterPoint[] | null {
  const fromJson = parseGrundrissJson(opts.grundrissJson)
  if (fromJson) return fromJson
  const L = opts.laengeM != null ? Number(opts.laengeM) : NaN
  const B = opts.breiteM != null ? Number(opts.breiteM) : NaN
  if (!Number.isFinite(L) || !Number.isFinite(B) || L <= 0 || B <= 0) return null
  return rectangleGrundriss(L, B)
}

function metersToLatLngDelta(
  eastM: number,
  northM: number,
  atLat: number
): { dLat: number; dLng: number } {
  const cosLat = Math.cos((atLat * Math.PI) / 180)
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.max(Math.abs(cosLat), 0.01)
  return {
    dLat: northM / METERS_PER_DEG_LAT,
    dLng: eastM / metersPerDegLng,
  }
}

/** headingDeg: 0 = Bug zeigt nach Norden, 90 = Osten (Uhrzeigersinn von Nord). */
export function rotateMeterPoint(point: MeterPoint, headingDeg: number): MeterPoint {
  const rad = (headingDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const [x, y] = point
  // lokales x = Ost, y = Nord; Rotation um heading (Bug-Richtung)
  const east = x * cos + y * sin
  const north = -x * sin + y * cos
  return [east, north]
}

export function caravanOutlineToLatLngs(
  outline: MeterPoint[],
  centerLat: number,
  centerLng: number,
  headingDeg: number
): Array<[number, number]> {
  return outline.map((pt) => {
    const [east, north] = rotateMeterPoint(pt, headingDeg)
    const { dLat, dLng } = metersToLatLngDelta(east, north, centerLat)
    return [centerLat + dLat, centerLng + dLng]
  })
}

export function normalizeHeadingDeg(deg: number): number {
  let d = deg % 360
  if (d < 0) d += 360
  return d
}
