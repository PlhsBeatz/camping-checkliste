import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const EARTH = 6371
function haversine(p) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(p.lat2 - p.lat1)
  const dLng = toRad(p.lng2 - p.lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p.lat1)) * Math.cos(toRad(p.lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function decode(encoded) {
  const points = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const d = result & 1 ? ~(result >> 1) : result >> 1
    lat += d
    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const d2 = result & 1 ? ~(result >> 1) : result >> 1
    lng += d2
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

const MIN_SEGMENT_KM = 0.05

function crossTrack(point, segStart, segEnd) {
  const seg = haversine({ lat1: segStart.lat, lng1: segStart.lng, lat2: segEnd.lat, lng2: segEnd.lng })
  if (seg < MIN_SEGMENT_KM) {
    const dStart = haversine({ lat1: segStart.lat, lng1: segStart.lng, lat2: point.lat, lng2: point.lng })
    const dEnd = haversine({ lat1: segEnd.lat, lng1: segEnd.lng, lat2: point.lat, lng2: point.lng })
    if (dStart <= dEnd) return { cross: dStart, along: 0, seg }
    return { cross: dEnd, along: seg, seg }
  }
  const refLat = (segStart.lat + segEnd.lat) / 2
  const refLng = (segStart.lng + segEnd.lng) / 2
  const latRad = (refLat * Math.PI) / 180
  const kmPerDegLat = 110.54
  const kmPerDegLng = 111.32 * Math.cos(latRad)
  const toLocal = (p) => ({
    x: (p.lng - refLng) * kmPerDegLng,
    y: (p.lat - refLat) * kmPerDegLat,
  })
  const a = toLocal(segStart)
  const b = toLocal(segEnd)
  const p = toLocal(point)
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abLenSq = abx * abx + aby * aby
  let t = 0
  if (abLenSq > 1e-12) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / abLenSq
    t = Math.max(0, Math.min(1, t))
  }
  const projX = a.x + t * abx
  const projY = a.y + t * aby
  const cross = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)
  return { cross, along: t * seg, seg }
}

function isNear(point, polylinePoints, maxKm = 5, endpointBufferKm = 3) {
  if (polylinePoints.length < 2) return false
  let minCross = Infinity
  let bestAlong = 0
  let cumulative = 0
  for (let i = 0; i < polylinePoints.length - 1; i++) {
    const a = polylinePoints[i]
    const b = polylinePoints[i + 1]
    const { cross, along, seg } = crossTrack(point, a, b)
    const alongRoute = cumulative + along
    if (cross < minCross) {
      minCross = cross
      bestAlong = alongRoute
    }
    cumulative += seg
  }
  if (minCross > maxKm) return { ok: false, minCross, bestAlong }
  let total = 0
  for (let i = 0; i < polylinePoints.length - 1; i++) {
    total += haversine({
      lat1: polylinePoints[i].lat,
      lng1: polylinePoints[i].lng,
      lat2: polylinePoints[i + 1].lat,
      lng2: polylinePoints[i + 1].lng,
    })
  }
  const ok = bestAlong <= total + endpointBufferKm && bestAlong >= -endpointBufferKm
  return { ok, minCross, bestAlong, total }
}

const raw = execSync(
  'npx wrangler d1 execute camping-db --local --command "SELECT encoded_polyline FROM campingplatz_routen_cache LIMIT 1;" --json',
  { encoding: 'utf8', cwd: process.cwd() }
)
const enc = JSON.parse(raw)[0].results[0].encoded_polyline
const pts = decode(enc)
console.log('polyline points', pts.length)

const rast = [
  { name: "ROSI'S Salzbergen", lat: 52.326224, lng: 7.4289076 },
  { name: 'Irschenberg Süd', lat: 47.8298858, lng: 11.9073426 },
  { name: 'Burger King Auetal', lat: 52.2261692, lng: 9.2317145 },
  { name: 'Garbsen Nord', lat: 52.4220981, lng: 9.5535527 },
]

for (const r of rast) {
  const res = isNear({ lat: r.lat, lng: r.lng }, pts)
  console.log(r.name, res)
}

// Far point Berlin center vs route DE->IT
const berlin = { lat: 52.52, lng: 13.405 }
console.log('Berlin', isNear(berlin, pts))

let minV = Infinity
let minPt = null
for (const p of pts) {
  const d = haversine({ lat1: berlin.lat, lng1: berlin.lng, lat2: p.lat, lng2: p.lng })
  if (d < minV) {
    minV = d
    minPt = p
  }
}
console.log('nearest vertex to Berlin km', minV, minPt)

let zeroSegs = 0
for (let i = 0; i < pts.length - 1; i++) {
  if (haversine({ lat1: pts[i].lat, lng1: pts[i].lng, lat2: pts[i + 1].lat, lng2: pts[i + 1].lng }) < 0.001)
    zeroSegs++
}
console.log('zero-length segments', zeroSegs, '/', pts.length - 1)

const uniq = new Set(pts.map((p) => p.lat.toFixed(5) + ',' + p.lng.toFixed(5)))
console.log('unique coords', uniq.size, 'of', pts.length)

// Find segment giving Berlin ~0 cross
let best = { cross: Infinity, i: -1 }
for (let i = 0; i < pts.length - 1; i++) {
  const a = pts[i]
  const b = pts[i + 1]
  const seg = haversine({ lat1: a.lat, lng1: a.lng, lat2: b.lat, lng2: b.lng })
  const d13 = haversine({ lat1: a.lat, lng1: a.lng, lat2: berlin.lat, lng2: berlin.lng })
  const d23 = haversine({ lat1: b.lat, lng1: b.lng, lat2: berlin.lat, lng2: berlin.lng })
  const ang = Math.acos(
    Math.min(1, Math.max(-1, (seg * seg + d13 * d13 - d23 * d23) / (2 * seg * d13 || 1)))
  )
  const cross = Math.abs(d13 * Math.sin(ang))
  if (cross < best.cross) best = { cross, i, seg, a, b, d13, d23 }
}
console.log('Berlin best segment', best)
