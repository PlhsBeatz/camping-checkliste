/**
 * Web Share Target: Payload parsen und Ziel-Heuristik.
 * Manifest liefert nur title/text/url – Typ und Prefill kommen aus dieser Logik.
 */

export type ShareTargetKind =
  | 'campingplatz'
  | 'rastplatz'
  | 'ausruestung'
  | 'optimierung'
  | 'buchung'

export type SharePayloadInput = {
  title?: string | null
  text?: string | null
  url?: string | null
}

export type ShareMapsInfo = {
  isMaps: boolean
  lat: number | null
  lng: number | null
  placeId: string | null
  query: string | null
}

export type ParsedShare = {
  title: string
  text: string
  /** Explizites url-Feld (kann leer sein; Android packt URLs oft in text) */
  url: string
  /** Alle gefundenen http(s)-URLs aus title/text/url */
  urls: string[]
  primaryUrl: string | null
  maps: ShareMapsInfo
  suggestedName: string
}

export type ShareOptionScore = {
  kind: ShareTargetKind
  score: number
  reasons: string[]
}

export const SHARE_TARGET_KINDS: ShareTargetKind[] = [
  'campingplatz',
  'rastplatz',
  'ausruestung',
  'optimierung',
  'buchung',
]

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]]+/gi

const CAMPING_RE =
  /\b(camping(?:platz)?|campground|stellplatz|wohnmobil(?:stellplatz)?|wohnwagenplatz|motorhome|caravan(?:site)?|aire\b|campsite)\b/i

const RAST_RE =
  /\b(rastplatz|raststätte|raststaette|rastanlage|tankstelle|autohof|parkplatz|service\s*area|rastort)\b/i

const BOOKING_RE =
  /\b(buchungsbestätigung|buchungsbestaetigung|buchung|reservation|reservierung|check[- ]?in|booking\.com|pitchup|camping\.info|sehr geehrte|reservation\s*number|buchungsnummer)\b/i

const SHOP_HOST_RE =
  /(^|\.)(amazon\.|amazon\.[a-z.]+|amzn\.|decathlon\.|ebay\.|aliexpress\.|otto\.de|hornbach\.|obi\.de|lidl\.|aldi\.|bergfreunde\.|bergzeit\.|globetrotter\.|thomann\.|campingaz\.|outwell\.|thule\.|douglas\.|zalando\.)/i

const IDEA_HOST_RE =
  /(^|\.)(youtube\.|youtu\.be|vimeo\.|pinterest\.|instagram\.|tiktok\.|reddit\.|facebook\.|fb\.watch)/i

function cleanUrlCandidate(raw: string): string {
  return raw.replace(/[.,;:!?)\]}>]+$/g, '')
}

function extractUrls(...parts: string[]): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    if (!part) continue
    const matches = part.match(URL_IN_TEXT_RE) ?? []
    for (const m of matches) {
      const cleaned = cleanUrlCandidate(m)
      if (!seen.has(cleaned)) {
        seen.add(cleaned)
        found.push(cleaned)
      }
    }
    // Manchmal kommt nur eine nackte Domain ohne Schema – ignorieren.
  }
  return found
}

function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isFiniteCoord(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n) <= 180
}

function parseLatLngPair(raw: string): { lat: number; lng: number } | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng) || Math.abs(lat) > 90) return null
  return { lat, lng }
}

export function parseMapsInfo(urlString: string): ShareMapsInfo {
  const empty: ShareMapsInfo = {
    isMaps: false,
    lat: null,
    lng: null,
    placeId: null,
    query: null,
  }
  const u = tryParseUrl(urlString)
  if (!u) return empty

  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  const path = u.pathname.toLowerCase()
  const isMaps =
    host === 'maps.google.com' ||
    host === 'maps.app.goo.gl' ||
    host === 'maps.apple.com' ||
    (host === 'goo.gl' && path.startsWith('/maps')) ||
    ((host === 'google.com' || host.endsWith('.google.com')) && path.includes('/maps')) ||
    host.includes('google.') && path.includes('/maps')

  if (!isMaps) return empty

  let lat: number | null = null
  let lng: number | null = null

  const at = urlString.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/)
  if (at) {
    const pair = parseLatLngPair(`${at[1]},${at[2]}`)
    if (pair) {
      lat = pair.lat
      lng = pair.lng
    }
  }

  if (lat == null) {
    const bang = urlString.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/)
    if (bang) {
      const pair = parseLatLngPair(`${bang[1]},${bang[2]}`)
      if (pair) {
        lat = pair.lat
        lng = pair.lng
      }
    }
  }

  const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('destination')
  if (lat == null && q) {
    const pair = parseLatLngPair(q)
    if (pair) {
      lat = pair.lat
      lng = pair.lng
    }
  }

  const placeId =
    u.searchParams.get('query_place_id') ||
    u.searchParams.get('place_id') ||
    null

  let query: string | null = null
  if (q && !parseLatLngPair(q)) query = q.trim() || null
  if (!query) {
    const placePath = u.pathname.match(/\/place\/([^/]+)/)
    if (placePath?.[1]) {
      try {
        query = decodeURIComponent(placePath[1].replace(/\+/g, ' '))
      } catch {
        query = placePath[1]
      }
    }
  }

  return { isMaps: true, lat, lng, placeId, query }
}

function firstNonUrlLine(...parts: string[]): string {
  for (const part of parts) {
    if (!part.trim()) continue
    for (const line of part.split(/\r?\n/)) {
      const t = line.trim()
      if (!t) continue
      if (/^https?:\/\//i.test(t)) continue
      // Zeile die nur aus URL + Müll besteht
      const withoutUrls = t.replace(URL_IN_TEXT_RE, '').trim()
      if (!withoutUrls) continue
      return withoutUrls.slice(0, 120)
    }
  }
  return ''
}

export function parseSharePayload(input: SharePayloadInput): ParsedShare {
  const title = (input.title ?? '').trim()
  const text = (input.text ?? '').trim()
  const url = (input.url ?? '').trim()

  const urls = extractUrls(url, text, title)
  // Explizites url-Feld bevorzugen, sonst erste gefundene URL
  const primaryUrl =
    (url && /^https?:\/\//i.test(url) ? cleanUrlCandidate(url) : null) ||
    urls[0] ||
    null

  const maps = primaryUrl
    ? parseMapsInfo(primaryUrl)
    : { isMaps: false, lat: null, lng: null, placeId: null, query: null }

  let suggestedName = firstNonUrlLine(title, text)
  if (!suggestedName && maps.query) suggestedName = maps.query.slice(0, 120)

  return {
    title,
    text,
    url,
    urls,
    primaryUrl,
    maps,
    suggestedName,
  }
}

function hostOf(url: string | null): string {
  if (!url) return ''
  const u = tryParseUrl(url)
  return u ? u.hostname.replace(/^www\./, '').toLowerCase() : ''
}

/** Bewertet alle Zielarten; höchster Score = Heuristik-Vorschlag. */
export function scoreShareTargets(parsed: ParsedShare): ShareOptionScore[] {
  const blob = `${parsed.title}\n${parsed.text}\n${parsed.primaryUrl ?? ''}`.toLowerCase()
  const host = hostOf(parsed.primaryUrl)
  const hasUrl = !!parsed.primaryUrl
  const isMaps = parsed.maps.isMaps
  const hasCoords = parsed.maps.lat != null && parsed.maps.lng != null

  const campingHit = CAMPING_RE.test(blob)
  const rastHit = RAST_RE.test(blob)
  const bookingHit = BOOKING_RE.test(blob)
  const shopHit = SHOP_HOST_RE.test(host)
  const ideaHit = IDEA_HOST_RE.test(host)
  const longText = parsed.text.length > 280

  const scores: Record<ShareTargetKind, ShareOptionScore> = {
    campingplatz: { kind: 'campingplatz', score: 1, reasons: [] },
    rastplatz: { kind: 'rastplatz', score: 1, reasons: [] },
    ausruestung: { kind: 'ausruestung', score: 1, reasons: [] },
    optimierung: { kind: 'optimierung', score: 2, reasons: ['Allgemeiner Link/Idee'] },
    buchung: { kind: 'buchung', score: 0, reasons: [] },
  }

  if (isMaps) {
    scores.rastplatz.score += 6
    scores.rastplatz.reasons.push('Google-/Karten-Link')
    scores.campingplatz.score += 4
    scores.campingplatz.reasons.push('Karten-Link (Ort)')
    if (hasCoords) {
      scores.rastplatz.score += 2
      scores.rastplatz.reasons.push('Koordinaten erkannt')
      scores.campingplatz.score += 1
    }
  }

  if (campingHit) {
    scores.campingplatz.score += 8
    scores.campingplatz.reasons.push('Camping-/Stellplatz-Begriff')
    if (isMaps) {
      scores.rastplatz.score -= 3
    }
  }

  if (rastHit) {
    scores.rastplatz.score += 8
    scores.rastplatz.reasons.push('Rast-/Tankstellen-Begriff')
    if (isMaps) {
      scores.campingplatz.score -= 2
    }
  }

  if (hasUrl && !isMaps && !shopHit && !ideaHit) {
    scores.campingplatz.score += 3
    scores.campingplatz.reasons.push('Webseite')
    if (campingHit) {
      scores.campingplatz.score += 2
    }
  }

  if (shopHit) {
    scores.ausruestung.score += 10
    scores.ausruestung.reasons.push('Shop-/Produktdomain')
  }

  if (ideaHit) {
    scores.optimierung.score += 7
    scores.optimierung.reasons.push('Video-/Ideen-Link')
  }

  if (bookingHit || (longText && /\b(buchung|reserv|confirmation|bestätigung)\b/i.test(blob))) {
    scores.buchung.score += 10
    scores.buchung.reasons.push('Buchungs-/Reservierungstext')
  }

  if (hasUrl && !isMaps && !shopHit) {
    scores.optimierung.score += 2
  }

  if (!hasUrl && parsed.suggestedName) {
    scores.optimierung.score += 1
    scores.ausruestung.score += 1
  }

  // Leerer Share: alles gleich niedrig
  if (!hasUrl && !parsed.title && !parsed.text) {
    for (const k of SHARE_TARGET_KINDS) {
      scores[k].score = 0
      scores[k].reasons = []
    }
  }

  return SHARE_TARGET_KINDS.map((k) => scores[k]).sort((a, b) => b.score - a.score)
}

export function pickHighlightedKind(
  scores: ShareOptionScore[],
  allowed: ReadonlySet<ShareTargetKind>
): ShareTargetKind | null {
  for (const s of scores) {
    if (s.score <= 0) continue
    if (allowed.has(s.kind)) return s.kind
  }
  for (const kind of SHARE_TARGET_KINDS) {
    if (allowed.has(kind)) return kind
  }
  return null
}

export type ShareDestinationPrefill = {
  name?: string
  webseite?: string
  url?: string
  titel?: string
  was?: string
  lat?: number
  lng?: number
  adresse?: string
  title?: string
  text?: string
}

/** Query für die Zielseite (ohne Auth). */
export function buildShareDestinationHref(
  kind: ShareTargetKind,
  parsed: ParsedShare
): string {
  const params = new URLSearchParams()
  params.set('share', '1')

  const name = parsed.suggestedName
  const primary = parsed.primaryUrl

  switch (kind) {
    case 'campingplatz': {
      if (name) params.set('name', name)
      if (primary && !parsed.maps.isMaps) params.set('webseite', primary)
      if (parsed.maps.lat != null && parsed.maps.lng != null) {
        params.set('lat', String(parsed.maps.lat))
        params.set('lng', String(parsed.maps.lng))
      }
      if (parsed.maps.query) params.set('adresse', parsed.maps.query)
      else if (name && parsed.maps.isMaps) params.set('adresse', name)
      return `/campingplaetze?${params.toString()}`
    }
    case 'rastplatz': {
      if (name) params.set('name', name)
      if (parsed.maps.lat != null && parsed.maps.lng != null) {
        params.set('lat', String(parsed.maps.lat))
        params.set('lng', String(parsed.maps.lng))
      }
      if (parsed.maps.placeId) params.set('placeId', parsed.maps.placeId)
      if (parsed.maps.query) params.set('adresse', parsed.maps.query)
      else if (name) params.set('adresse', name)
      return `/rastplaetze?${params.toString()}`
    }
    case 'ausruestung': {
      if (name) params.set('was', name)
      if (primary) params.set('url', primary)
      return `/ausruestung?${params.toString()}`
    }
    case 'optimierung': {
      if (name) params.set('titel', name)
      if (primary) params.set('url', primary)
      return `/tools/optimierungen?${params.toString()}`
    }
    case 'buchung': {
      const b = new URLSearchParams()
      b.set('bookingImport', '1')
      if (parsed.title) b.set('title', parsed.title)
      if (parsed.text) b.set('text', parsed.text)
      else if (primary) b.set('text', primary)
      if (parsed.url) b.set('url', parsed.url)
      else if (primary) b.set('url', primary)
      return `/urlaube?${b.toString()}`
    }
  }
}

export function readShareSearchParams(
  searchParams: URLSearchParams | { get(name: string): string | null }
): SharePayloadInput {
  return {
    title: searchParams.get('title'),
    text: searchParams.get('text'),
    url: searchParams.get('url'),
  }
}

export function parseCoordParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
