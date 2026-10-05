/**
 * Schätzt die Parzellen-Ausrichtung aus:
 * 1) OSM-Wegen/Hecken (Overpass)
 * 2) OSM-Kartenkacheln
 * 3) Satellitenkacheln
 *
 * Campingplätze sind oft rechtwinklig (Hecken + Wege). Deshalb:
 * zwei orthogonale Achsen finden, Längsachse = stärkere Hecken-Richtung,
 * Polarität so, dass die Türseite (rechts vom Bug) zur Zufahrt/hellen Seite zeigt.
 */
import {
  DE_OSM_TILE_URL,
  SATELLITE_MAX_NATIVE_ZOOM,
  satelliteTileUrl,
} from '@/lib/satellite-tiles'
import { normalizeHeadingDeg } from '@/lib/caravan-geometry'
import type { PitchOrientationResult } from '@/lib/pitch-orientation-types'
import {
  estimateOrientationFromOsmWays,
  type OsmOverpassResponse,
} from '@/lib/pitch-orientation-osm'

export type { PitchOrientationResult } from '@/lib/pitch-orientation-types'

type TileRgba = { data: Uint8ClampedArray; w: number; h: number }
type Rgb = { r: number; g: number; b: number }

function latLngToTile(
  lat: number,
  lng: number,
  z: number
): { x: number; y: number; xf: number; yf: number } {
  const n = 2 ** z
  const xf = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x: Math.floor(xf), y: Math.floor(yf), xf, yf }
}

function osmTileUrl(z: number, x: number, y: number): string {
  const sub = ['a', 'b', 'c'][(x + y) % 3]!
  return DE_OSM_TILE_URL.replace('{s}', sub)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}

function proxiedTileUrl(
  source: 'satellite' | 'osm',
  z: number,
  x: number,
  y: number
): string {
  return `/api/map-tiles/${source}/${z}/${x}/${y}`
}

async function loadTileViaFetch(url: string): Promise<TileRgba | null> {
  try {
    const res = await fetch(url, {
      mode: 'cors',
      credentials: url.startsWith('/') ? 'same-origin' : 'omit',
      cache: 'force-cache',
    })
    if (!res.ok) return null
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      bmp.close()
      return null
    }
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { data: img.data, w: canvas.width, h: canvas.height }
  } catch {
    return null
  }
}

async function fetchTileRgba(
  source: 'satellite' | 'osm',
  z: number,
  x: number,
  y: number
): Promise<TileRgba | null> {
  const viaProxy = await loadTileViaFetch(proxiedTileUrl(source, z, x, y))
  if (viaProxy) return viaProxy
  const direct =
    source === 'satellite' ? satelliteTileUrl(z, x, y) : osmTileUrl(z, x, y)
  return loadTileViaFetch(direct)
}

function pixelDirToCompass(dx: number, dy: number): number {
  return normalizeHeadingDeg((Math.atan2(dx, -dy) * 180) / Math.PI)
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Satellit: dunkle Hecken vs. helles Gras/Kies stärker trennen. */
function edgeLuma(
  r: number,
  g: number,
  b: number,
  mode: 'satellite' | 'osm'
): number {
  if (mode === 'osm') {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    return luma(r, g, b) * (0.55 + sat * 0.9)
  }
  // Grünanteil dämpfen (Gras), dunkle Vegetation/Wege bleiben kontrastreich
  const greenBias = Math.max(0, g - Math.max(r, b))
  return luma(r, g, b) - greenBias * 0.35
}

function smoothBin(bins: Float64Array, i: number): number {
  return (
    bins[(i + 177) % 180]! * 0.05 +
    bins[(i + 178) % 180]! * 0.1 +
    bins[(i + 179) % 180]! * 0.2 +
    bins[i]! * 0.3 +
    bins[(i + 1) % 180]! * 0.2 +
    bins[(i + 2) % 180]! * 0.1 +
    bins[(i + 3) % 180]! * 0.05
  )
}

function undirectedDelta(a: number, b: number): number {
  const d = Math.abs(((a % 180) + 180) % 180 - (((b % 180) + 180) % 180))
  return Math.min(d, 180 - d)
}

/** Beste Achse + orthogonale Zweitachse (Camping-Raster). */
function findRectilinearAxes(bins: Float64Array): {
  primary: { deg: number; val: number }
  ortho: { deg: number; val: number }
  mass: number
} | null {
  let mass = 0
  const smooth = new Float64Array(180)
  for (let i = 0; i < 180; i++) {
    smooth[i] = smoothBin(bins, i)
    mass += bins[i]!
  }
  if (mass < 800) return null

  let bestI = 0
  let bestV = 0
  for (let i = 0; i < 180; i++) {
    if (smooth[i]! > bestV) {
      bestV = smooth[i]!
      bestI = i
    }
  }

  // Orthogonale Achse: Peak um ±90°
  let orthoI = (bestI + 90) % 180
  let orthoV = 0
  for (let d = -18; d <= 18; d++) {
    const i = (bestI + 90 + d + 180) % 180
    if (smooth[i]! > orthoV) {
      orthoV = smooth[i]!
      orthoI = i
    }
  }

  return {
    primary: { deg: bestI, val: bestV },
    ortho: { deg: orthoI, val: orthoV },
    mass,
  }
}

function analyzeRasterAround(opts: {
  lat: number
  lng: number
  zoom: number
  source: 'satellite' | 'osm'
  tiles: Array<{ tx: number; ty: number; rgba: Uint8ClampedArray; w: number; h: number }>
}): PitchOrientationResult | null {
  const { lat, lng, zoom: z, source, tiles } = opts
  if (tiles.length < 1) return null

  const tw = tiles[0]!.w
  const th = tiles[0]!.h
  const originTx = Math.min(...tiles.map((x) => x.tx))
  const originTy = Math.min(...tiles.map((x) => x.ty))
  const t = latLngToTile(lat, lng, z)

  const metersPerPx =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z
  // Etwas größerer Radius: Hecken der Nachbarparzellen mitnehmen
  const radiusPx = Math.max(
    48,
    Math.min(160, Math.round(26 / Math.max(metersPerPx, 0.05)))
  )
  const innerPx = Math.max(10, Math.round(radiusPx * 0.28))

  const cxGlobal = (t.xf - originTx) * tw
  const cyGlobal = (t.yf - originTy) * th

  const getPixel = (gx: number, gy: number): Rgb | null => {
    const tileX = Math.floor(gx / tw)
    const tileY = Math.floor(gy / th)
    const absTx = originTx + tileX
    const absTy = originTy + tileY
    const tile = tiles.find((x) => x.tx === absTx && x.ty === absTy)
    if (!tile) return null
    const lx = Math.floor(gx - tileX * tw)
    const ly = Math.floor(gy - tileY * th)
    if (lx < 1 || ly < 1 || lx >= tile.w - 1 || ly >= tile.h - 1) return null
    const i = (ly * tile.w + lx) * 4
    return { r: tile.rgba[i]!, g: tile.rgba[i + 1]!, b: tile.rgba[i + 2]! }
  }

  const bins = new Float64Array(180)
  // Zusätzlich: wie stark liegen Kanten parallel zu Achse nahe am Pin (Ring)
  const parallelNear = new Float64Array(180)
  let edgeMass = 0
  const magMin = source === 'osm' ? 14 : 16
  const step = 2

  for (let gy = cyGlobal - radiusPx; gy <= cyGlobal + radiusPx; gy += step) {
    for (let gx = cxGlobal - radiusPx; gx <= cxGlobal + radiusPx; gx += step) {
      const dx = gx - cxGlobal
      const dy = gy - cyGlobal
      const dist2 = dx * dx + dy * dy
      if (dist2 > radiusPx * radiusPx || dist2 < innerPx * innerPx) continue

      const c00 = getPixel(gx - 1, gy - 1)
      const c10 = getPixel(gx, gy - 1)
      const c20 = getPixel(gx + 1, gy - 1)
      const c01 = getPixel(gx - 1, gy)
      const c21 = getPixel(gx + 1, gy)
      const c02 = getPixel(gx - 1, gy + 1)
      const c12 = getPixel(gx, gy + 1)
      const c22 = getPixel(gx + 1, gy + 1)
      if (!c00 || !c10 || !c20 || !c01 || !c21 || !c02 || !c12 || !c22) continue

      const l00 = edgeLuma(c00.r, c00.g, c00.b, source)
      const l10 = edgeLuma(c10.r, c10.g, c10.b, source)
      const l20 = edgeLuma(c20.r, c20.g, c20.b, source)
      const l01 = edgeLuma(c01.r, c01.g, c01.b, source)
      const l21 = edgeLuma(c21.r, c21.g, c21.b, source)
      const l02 = edgeLuma(c02.r, c02.g, c02.b, source)
      const l12 = edgeLuma(c12.r, c12.g, c12.b, source)
      const l22 = edgeLuma(c22.r, c22.g, c22.b, source)
      const sx = -l00 + l20 - 2 * l01 + 2 * l21 - l02 + l22
      const sy = -l00 - 2 * l10 - l20 + l02 + 2 * l12 + l22
      const mag = Math.hypot(sx, sy)
      if (mag < magMin) continue

      const gradCompass = pixelDirToCompass(sx, sy)
      const lineDeg = normalizeHeadingDeg(gradCompass + 90) % 180
      const bin = Math.floor(lineDeg) % 180
      // Äußerer Ring stärker gewichten (Parzellengrenze)
      const ring = Math.sqrt(dist2) / radiusPx
      const w = mag * (0.55 + ring * 0.9)
      bins[bin]! += w
      parallelNear[bin]! += w
      edgeMass += w
    }
  }

  if (edgeMass < 900) return null

  const axes = findRectilinearAxes(bins)
  if (!axes) return null

  const { primary, ortho, mass } = axes
  const gridScore = ortho.val / Math.max(primary.val, 1)
  const isGrid = gridScore >= 0.55

  // Früher: peakRatio ~1 bei H+V-Raster → Abbruch. Jetzt akzeptieren.
  if (!isGrid && primary.val / mass < 0.012) return null
  if (!isGrid) {
    // Zweitpeak darf nicht zu nah am Erstpeak liegen ohne Ortho
    let nearCompetitor = 0
    for (let i = 0; i < 180; i++) {
      if (undirectedDelta(i, primary.deg) < 20) continue
      if (undirectedDelta(i, ortho.deg) < 20) continue
      const v = smoothBin(bins, i)
      if (v > nearCompetitor) nearCompetitor = v
    }
    if (primary.val / Math.max(nearCompetitor, 1) < 1.05 && gridScore < 0.45) {
      return null
    }
  }

  // Längsachse: welche Richtung hat stärkere parallele Hecken im Ring?
  const scoreAxis = (deg: number) => {
    let s = 0
    for (let d = -6; d <= 6; d++) {
      s += parallelNear[(deg + d + 180) % 180]!
    }
    return s
  }
  const scorePrimary = scoreAxis(primary.deg)
  const scoreOrtho = scoreAxis(ortho.deg)

  // Bei klarem Raster oft die stärkere Heckenzeile = Längsseite der Parzelle
  let lineDeg = scorePrimary >= scoreOrtho * 0.92 ? primary.deg : ortho.deg

  // Feinabstimmung ±6°
  let bestFine = lineDeg
  let bestFineVal = 0
  for (let d = -6; d <= 6; d++) {
    const i = (lineDeg + d + 180) % 180
    const v = smoothBin(bins, i)
    if (v > bestFineVal) {
      bestFineVal = v
      bestFine = i
    }
  }
  lineDeg = bestFine

  const sampleAlong = (compassDeg: number, distM: number): number => {
    const samples = 12
    let sum = 0
    let n = 0
    for (let i = 1; i <= samples; i++) {
      const d = (distM * i) / samples
      const rad = ((90 - compassDeg) * Math.PI) / 180
      const dLat = (d * Math.sin(rad)) / 111_320
      const cosLat = Math.cos((lat * Math.PI) / 180)
      const dLng =
        (d * Math.cos(rad)) / (111_320 * Math.max(Math.abs(cosLat), 0.01))
      const pt = latLngToTile(lat + dLat, lng + dLng, z)
      const gx = (pt.xf - originTx) * tw
      const gy = (pt.yf - originTy) * th
      const px = getPixel(gx, gy)
      if (!px) continue
      sum += edgeLuma(px.r, px.g, px.b, source)
      n++
    }
    return n > 0 ? sum / n : 128
  }

  // Tür sitzt rechts vom Bug (+90°). Tür soll zur helleren Seite / Zufahrt zeigen.
  const candidateA = lineDeg
  const candidateB = normalizeHeadingDeg(lineDeg + 180)
  const doorA = normalizeHeadingDeg(candidateA + 90)
  const doorB = normalizeHeadingDeg(candidateB + 90)
  const brightDoorA = sampleAlong(doorA, 14)
  const brightDoorB = sampleAlong(doorB, 14)
  const headingDeg = brightDoorA >= brightDoorB ? candidateA : candidateB

  const dominance = isGrid
    ? 0.45 + gridScore * 0.35
    : Math.min(1, Math.max(0.25, primary.val / Math.max(ortho.val, 1) / 2))

  return {
    headingDeg,
    confidence: Math.min(1, Math.max(0.28, dominance)),
    lineDeg,
    source: source === 'satellite' ? 'satellite' : 'map',
    detail: isGrid ? 'grid' : 'mono',
  }
}

async function estimateFromRaster(opts: {
  lat: number
  lng: number
  zoom: number
  source: 'satellite' | 'osm'
}): Promise<PitchOrientationResult | null> {
  if (typeof document === 'undefined') return null
  const z = Math.min(opts.zoom, SATELLITE_MAX_NATIVE_ZOOM)
  const t = latLngToTile(opts.lat, opts.lng, z)
  const maxIndex = 2 ** z - 1

  // Free-Tier: nur Nachbarn laden, wenn der Pin nah am Kachelrand liegt
  const fx = t.xf - t.x
  const fy = t.yf - t.y
  const edge = 0.28
  const offsets: Array<[number, number]> = [[0, 0]]
  if (fx < edge) offsets.push([-1, 0])
  if (fx > 1 - edge) offsets.push([1, 0])
  if (fy < edge) offsets.push([0, -1])
  if (fy > 1 - edge) offsets.push([0, 1])
  if (fx < edge && fy < edge) offsets.push([-1, -1])
  if (fx > 1 - edge && fy < edge) offsets.push([1, -1])
  if (fx < edge && fy > 1 - edge) offsets.push([-1, 1])
  if (fx > 1 - edge && fy > 1 - edge) offsets.push([1, 1])

  const loaded = await Promise.all(
    offsets.map(async ([dx, dy]) => {
      const tx = Math.min(maxIndex, Math.max(0, t.x + dx))
      const ty = Math.min(maxIndex, Math.max(0, t.y + dy))
      const tile = await fetchTileRgba(opts.source, z, tx, ty)
      if (!tile) return null
      return { tx, ty, rgba: tile.data, w: tile.w, h: tile.h }
    })
  )

  const tiles: Array<{
    tx: number
    ty: number
    rgba: Uint8ClampedArray
    w: number
    h: number
  }> = []
  for (const tile of loaded) {
    if (!tile) continue
    if (tiles.some((x) => x.tx === tile.tx && x.ty === tile.ty)) continue
    tiles.push(tile)
  }
  if (tiles.length < 1) return null

  return analyzeRasterAround({
    lat: opts.lat,
    lng: opts.lng,
    zoom: z,
    source: opts.source,
    tiles,
  })
}

async function estimateFromOsmApi(
  lat: number,
  lng: number
): Promise<PitchOrientationResult | null> {
  try {
    const res = await fetch(
      `/api/pitch-orientation?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
      { credentials: 'same-origin', cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      ok?: boolean
      result?: PitchOrientationResult | null
      elements?: OsmOverpassResponse['elements']
    }
    if (data.result && typeof data.result.headingDeg === 'number') {
      return { ...data.result, source: data.result.source ?? 'osm' }
    }
    if (data.elements?.length) {
      return estimateOrientationFromOsmWays(lat, lng, data.elements)
    }
    return null
  } catch {
    return null
  }
}

function lineAxisDistance(a: number, b: number): number {
  return undirectedDelta(a, b)
}

function mergeResults(
  results: PitchOrientationResult[]
): PitchOrientationResult | null {
  const usable = results.filter((r) => r.confidence >= 0.22)
  if (usable.length === 0) return null
  if (usable.length === 1) return usable[0]!

  const rank = (s: PitchOrientationResult['source']) =>
    s === 'osm' ? 3 : s === 'map' ? 2 : s === 'merged' ? 2 : 1

  usable.sort((a, b) => {
    const scoreA = a.confidence * 10 + rank(a.source)
    const scoreB = b.confidence * 10 + rank(b.source)
    return scoreB - scoreA
  })

  const primary = usable[0]!
  const ally = usable.find(
    (r) => r !== primary && lineAxisDistance(r.lineDeg, primary.lineDeg) <= 20
  )
  if (ally) {
    // Polarität: OSM-Tür-zur-Zufahrt bevorzugen, sonst Primary
    const heading =
      primary.source === 'osm' || ally.source !== 'osm'
        ? primary.headingDeg
        : ally.headingDeg
    return {
      headingDeg: heading,
      lineDeg: primary.lineDeg,
      confidence: Math.min(
        1,
        Math.max(primary.confidence, ally.confidence) + 0.15
      ),
      source: 'merged',
      detail: `${primary.source}+${ally.source}`,
    }
  }

  // Widersprüchliche Achsen: Satellit/Karte bei klarem Grid oft besser als dünnes OSM
  const grid = usable.find((r) => r.detail === 'grid' && r.confidence >= 0.4)
  if (grid && primary.source === 'osm' && primary.confidence < 0.55) {
    return grid
  }

  const osm = usable.find((r) => r.source === 'osm')
  if (osm && osm.confidence >= 0.4) return osm

  return primary
}

/**
 * Analysiert Umgebung um lat/lng und liefert Bug-Richtung
 * (Tür rechts vom Bug zur Zufahrt).
 *
 * Free-Tier: gestaffelt – OSM zuerst (1 Request), Raster nur bei Bedarf.
 */
export async function estimatePitchOrientation(opts: {
  lat: number
  lng: number
  zoom?: number
}): Promise<PitchOrientationResult | null> {
  const z = opts.zoom ?? 19

  const osm = await estimateFromOsmApi(opts.lat, opts.lng)
  if (osm && osm.confidence >= 0.48) {
    return osm
  }

  const satellite = await estimateFromRaster({
    lat: opts.lat,
    lng: opts.lng,
    zoom: z,
    source: 'satellite',
  })
  const afterSat = mergeResults(
    [osm, satellite].filter((r): r is PitchOrientationResult => r != null)
  )
  if (afterSat && afterSat.confidence >= 0.4) {
    return afterSat
  }

  // Kartenkacheln nur als letzte Stufe (zusätzliche Worker-Requests)
  const map = await estimateFromRaster({
    lat: opts.lat,
    lng: opts.lng,
    zoom: Math.min(z, 18),
    source: 'osm',
  })

  return mergeResults(
    [osm, satellite, map].filter((r): r is PitchOrientationResult => r != null)
  )
}
