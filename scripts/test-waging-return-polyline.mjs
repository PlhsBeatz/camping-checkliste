import { execSync } from 'child_process'

const WAGING_ID = 'a29fad50-854c-45ad-a478-af2334066d47'
const raw = execSync(
  `npx wrangler d1 execute camping-db --local --command "SELECT encoded_polyline, return_encoded_polyline FROM campingplatz_routen_cache WHERE campingplatz_id = '${WAGING_ID}';" --json`,
  { encoding: 'utf8', cwd: process.cwd() }
)
const row = JSON.parse(raw)[0].results[0]

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

const MIN = 0.05
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

function crossTrack(point, segStart, segEnd) {
  const seg = haversine({ lat1: segStart.lat, lng1: segStart.lng, lat2: segEnd.lat, lng2: segEnd.lng })
  if (seg < MIN) {
    const dStart = haversine({ lat1: segStart.lat, lng1: segStart.lng, lat2: point.lat, lng2: point.lng })
    const dEnd = haversine({ lat1: segEnd.lat, lng1: segEnd.lng, lat2: point.lat, lng2: point.lng })
    return dStart <= dEnd ? dStart : dEnd
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
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)
}

function isNear(point, pts, maxKm = 5) {
  let minCross = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const c = crossTrack(point, pts[i], pts[i + 1])
    if (c < minCross) minCross = c
  }
  return { ok: minCross <= maxKm, minCross }
}

const irsch = { lat: 47.8298858, lng: 11.9073426 }
for (const [label, enc] of [
  ['forward', row.encoded_polyline],
  ['return', row.return_encoded_polyline],
]) {
  const pts = decode(enc)
  console.log(label, 'points', pts.length, 'start', pts[0], 'end', pts[pts.length - 1])
  console.log(label, 'Irschenberg', isNear(irsch, pts))
}
