/**
 * Mehrstufige Platzplan-Suche auf der Campingplatz-Website.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { chatJson } from '@/lib/ai/openrouter-client'
import { todayInAppTimezone } from '@/lib/app-timezone'
import { isRejectedPlatzplanUrl, isXmlPlatzplanUrl } from '@/lib/platzplan-url'
import { filenameFromUrl } from '@/lib/smart-suggestion-copy'
import { looksLikeOpeningHours } from '@/lib/place-value-normalize'
import { upsertSmartSuggestion } from '@/lib/smart-suggestions'

const MAX_PAGES = 12
const MAX_DEPTH = 3
const MAX_HTML_BYTES = 400_000
const FETCH_MS = 8_000

export type PlatzplanCandidate = {
  url: string
  anchor: string
  found_on: string
  score: number
  /** Seitentitel, PDF-Dateiname oder anderer Anzeigename */
  title?: string
}

/** Camping-Platzplan – nicht „sitemap“/„site-map“ (HTML-Navigationsübersicht). */
const PLAN_RE =
  /platzplan|lageplan|stellplatzplan|parzellenplan|campingplan|campingplatzplan|camping[-_]?map|campsite[-_]?map|map[-_]?campsite|pitch[-_]?map|pitchmap|park[-_]?map|site[-_]?plan|siteplan|plan[-_]?du[-_]?camping|planimetria|plattegrond|mappa(?:[-_]?campeggio)?|mapa[-_]?del[-_]?camping|stellplatz[-_]?karte|interactive[-_]?map|live[-_]?map|pitch[-_]?finder|pitch[-_]?locator|booking[-_]?map|availability[-_]?map|grundriss/i

/** Linktexte wie „Karte“, „Lageplan“ – nicht „Karten und Vorteile“ (Treuekarte). */
const PLAN_LABEL_RE =
  /(?:^|[^a-zäöü0-9])(?:platzpl[aä]ne?|lagepl[aä]ne?|stellplatzpl[aä]ne?|parzellenpl[aä]ne?|karte)(?:[^a-zäöü0-9]|$)/i

const PLAN_FALSE_RE =
  /speisekarte|weinkarte|getr(?:ä|ae)nkekarte|g(?:ä|ae)stekarte|mitgliedskarte|treuekarte|karte-rabatte|karten[-_ ]und[-_ ]vorteile|loyalty[-_]?card|gift[-_]?card|codice[-_]?etico|ethi(?:c|sch)er?[-_]?kodex/i

const NAV_RE =
  /plan|anlage|platz|info|download|pdf|karte|map|pitch|emplacement|facilit|dokument|media|galerie|photos?/i

const SKIP_RE = /\.(css|js|woff2?|mp4|zip|mp3|xml|xml\.gz)(\?|$)/i
const MEDIA_RE = /\.(jpg|jpeg|png|gif|webp|svg|pdf)(\?|$)/i
const PDF_RE = /\.pdf(\?|$)/i
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i

const SITEMAP_LABEL_RE =
  /^(site[-_ ]?maps?|sitemaps?|html[-_ ]?sitemap|xml[-_ ]?sitemap|plan du site|mappa del sito|mapa del sitio|sitemappe?)$/i

const CAMPSITE_MAP_SEGMENTS = new Set([
  'map',
  'karte',
  'lageplan',
  'platzplan',
  'stellplatzplan',
  'siteplan',
  'site-plan',
  'site_plan',
  'camping-map',
  'campsite-map',
  'pitch-map',
  'park-map',
  'interactive-map',
  'live-map',
  'plattegrond',
  'mappa',
  'mappa-campeggio',
  'map-campsite',
  'lageplan-campingplatz',
])

function urlPathname(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

function pathSuggestsCampsiteMap(url: string): boolean {
  if (isRejectedPlatzplanUrl(url) || PLAN_FALSE_RE.test(url)) return false
  const segs = urlPathname(url)
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/\.(html?|php|aspx?)$/i, ''))
  const last = segs[segs.length - 1] ?? ''
  if (CAMPSITE_MAP_SEGMENTS.has(last)) return true
  return segs.some(
    (s) =>
      /^(lageplan|platzplan|stellplatzplan|map-campsite|mappa-campeggio)([-_]|$)/i.test(s) ||
      (/^karte([-_]|$)/i.test(s) && !/rabatt|vorteil|treue|card/i.test(s))
  )
}

function hostWithoutWww(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase()
}

function registrableDomain(host: string): string {
  const h = hostWithoutWww(host)
  const parts = h.split('.').filter(Boolean)
  if (parts.length <= 2) return h
  const last = parts[parts.length - 1] ?? ''
  const second = parts[parts.length - 2] ?? ''
  if (['uk', 'au', 'nz', 'za', 'br'].includes(last) && second.length <= 3) {
    return parts.slice(-3).join('.')
  }
  return `${second}.${last}`
}

/** Gleiche Website-Familie, z. B. www.unionlido.com und mare.unionlido.com. */
function sameSite(a: string, b: string): boolean {
  try {
    return registrableDomain(new URL(a).hostname) === registrableDomain(new URL(b).hostname)
  } catch {
    return false
  }
}

function isSiblingSiteHome(url: string, start: string): boolean {
  if (sameOrigin(url, start) || !sameSite(url, start)) return false
  const path = urlPathname(url).replace(/\/+$/, '') || '/'
  return /^\/([a-z]{2}(-[a-z]{2})?)?$/i.test(path)
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}

function resolveUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractHtmlTitle(html: string): string {
  const og =
    html.match(
      /<meta\b[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/i
    ) ??
    html.match(
      /<meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:title["'][^>]*>/i
    )
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const raw = (og?.[1] ?? titleTag?.[1] ?? '').replace(/\s+/g, ' ').trim()
  return stripTags(raw).slice(0, 120)
}

function isPdfUrl(url: string): boolean {
  return PDF_RE.test(url)
}

function isImageUrl(url: string): boolean {
  return IMAGE_RE.test(url)
}

function isDirectFileUrl(url: string): boolean {
  return isPdfUrl(url) || isImageUrl(url)
}

function isRejectedPlatzplanCandidate(url: string, text = ''): boolean {
  if (isRejectedPlatzplanUrl(url)) return true
  if (PLAN_FALSE_RE.test(url) || PLAN_FALSE_RE.test(text)) return true
  const label = text.trim()
  if (SITEMAP_LABEL_RE.test(label) && !isDirectFileUrl(url) && !PLAN_RE.test(url)) {
    return true
  }
  return false
}

function looksLikePlan(url: string, text: string): boolean {
  if (isRejectedPlatzplanCandidate(url, text)) return false
  return (
    PLAN_RE.test(url) ||
    PLAN_RE.test(text) ||
    PLAN_LABEL_RE.test(text) ||
    pathSuggestsCampsiteMap(url)
  )
}

function defaultCandidateTitle(url: string, anchor: string): string | undefined {
  if (isPdfUrl(url)) return filenameFromUrl(url)
  const a = anchor.trim()
  if (a && !['link', 'embed', 'sitemap', 'nav'].includes(a.toLowerCase())) return undefined
  return filenameFromUrl(url)
}

function languagePreferenceScore(url: string, text: string): number {
  const hay = `${url} ${text}`.toLowerCase()
  if (
    /(?:^|[/?&#._/-])de(?:[-_/]|$)|\blang(?:uage)?=de\b|\blocale=de\b|\/de-de\b|deutsch|\bgerman\b|_de\.pdf|_de[-_.]/.test(
      hay
    )
  ) {
    return 6
  }
  if (
    /(?:^|[/?&#._/-])en(?:[-_/]|$)|\blang(?:uage)?=en\b|\blocale=en\b|english|_en\.pdf|_en[-_.]/.test(
      hay
    )
  ) {
    return 3
  }
  return 1
}

function shouldSkipAsset(url: string, text: string): boolean {
  if (isXmlPlatzplanUrl(url) || SKIP_RE.test(url)) return true
  if (isPdfUrl(url)) {
    // Keine beliebigen PDFs (Datenschutz, Bewerbung, Speisekarte …)
    return !looksLikePlan(url, text)
  }
  if (!MEDIA_RE.test(url)) return false
  return !looksLikePlan(url, text)
}

function extractLinks(html: string, pageUrl: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = []
  const re = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = m[2]
    const inner = m[4]
    if (!href) continue
    const abs = resolveUrl(href, pageUrl)
    if (!abs) continue
    const attrs = `${m[1] ?? ''} ${m[3] ?? ''}`
    const aria = attrs.match(/aria-label\s*=\s*["']([^"']+)["']/i)?.[1] ?? ''
    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ?? ''
    const text = (stripTags(inner ?? '') || stripTags(aria) || stripTags(title)).slice(0, 120)
    if (shouldSkipAsset(abs, text)) continue
    out.push({ href: abs, text })
  }
  return out
}

/** PDFs/Bilder in JSON-Payloads (z. B. CMS), nicht nur in <a href>. */
function extractLooseMediaUrls(html: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = []
  const re = /https?:\/\/[^\s"'<>\\]+?\.(?:pdf|jpe?g|png|webp)(?:\?[^\s"'<>\\]*)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = (m[0] ?? '').replace(/\\+$/, '')
    const abs = resolveUrl(raw, 'https://example.invalid')
    if (!abs || abs.includes('example.invalid')) continue
    const hint = filenameFromUrl(abs)
    if (shouldSkipAsset(abs, hint)) continue
    if (!looksLikePlan(abs, hint)) continue
    out.push({ href: abs, text: hint })
  }
  return out
}

function extractEmbeds(html: string, pageUrl: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = []
  const patterns = [
    /<iframe\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<embed\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<object\b[^>]*data\s*=\s*["']([^"']+)["'][^>]*>/gi,
    /<source\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const abs = resolveUrl(m[1] ?? '', pageUrl)
      if (!abs || shouldSkipAsset(abs, 'embed')) continue
      out.push({ href: abs, text: 'embed' })
    }
  }
  return out
}

function extractHreflang(html: string, pageUrl: string): Array<{ lang: string; href: string }> {
  const out: Array<{ lang: string; href: string }> = []
  const re =
    /<link\b[^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi
  const reFlip =
    /<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const abs = resolveUrl(m[2] ?? '', pageUrl)
    if (abs) out.push({ lang: (m[1] ?? '').toLowerCase(), href: abs })
  }
  while ((m = reFlip.exec(html))) {
    const abs = resolveUrl(m[1] ?? '', pageUrl)
    if (abs) out.push({ lang: (m[2] ?? '').toLowerCase(), href: abs })
  }
  return out
}

async function fetchHtml(url: string): Promise<string | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'CampingPackliste/1.0 (Platzplan-Suche)',
        'Accept-Language': 'de,en;q=0.8',
      },
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf
    return new TextDecoder('utf-8', { fatal: false }).decode(slice)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function recencyBonus(url: string, planRelated: boolean): number {
  if (!planRelated) return 0
  const m = url.match(/20(\d{2})(?:0[1-9]|1[0-2])?/)
  if (!m) return 0
  const year = 2000 + Number(m[1])
  const now = new Date().getFullYear()
  if (year === now || year === now + 1) return 4
  if (year === now - 1) return 2
  if (year < now - 3) return -3
  return 0
}

function scoreCandidate(url: string, text: string): number {
  if (isRejectedPlatzplanCandidate(url, text)) return 0
  const hay = `${url} ${text}`.replace(/site[-_]?maps?/gi, ' ').replace(/sitemaps?/gi, ' ')
  const planHit = looksLikePlan(url, text)
  const mapHit =
    /(?:^|[^a-zäöü])(?:map|lageplan|platzplan|stellplatzplan|karte|site[-_]?plan)(?:[^a-zäöü]|$)/i.test(
      hay
    )
  if (isPdfUrl(url) && !planHit && !mapHit) return 0
  if (!isDirectFileUrl(url) && !planHit) return 0

  let s = 0
  if (planHit) s += 8
  if (isPdfUrl(url) && (planHit || mapHit)) s += 14
  else if (isImageUrl(url) && (planHit || mapHit)) s += 6
  if (mapHit) s += 2
  if (/runterladen|download|herunterladen/i.test(text)) s += 2
  s += recencyBonus(url, planHit || mapHit)
  if (s === 0) return 0
  return s + languagePreferenceScore(url, text)
}

function directnessRank(c: PlatzplanCandidate): number {
  if (isPdfUrl(c.url) && looksLikePlan(c.url, c.anchor)) return 3
  if (isImageUrl(c.url) && looksLikePlan(c.url, c.anchor)) return 2
  return 1
}

function sortCandidates(list: PlatzplanCandidate[]): PlatzplanCandidate[] {
  return [...list].sort(
    (a, b) => directnessRank(b) - directnessRank(a) || b.score - a.score
  )
}

function bestDirectPlanFile(candidates: PlatzplanCandidate[]): PlatzplanCandidate | null {
  return (
    candidates.find((c) => isPdfUrl(c.url) && looksLikePlan(c.url, c.anchor)) ??
    candidates.find((c) => isImageUrl(c.url) && looksLikePlan(c.url, c.anchor)) ??
    null
  )
}

function orderCandidatesForPayload(
  candidates: PlatzplanCandidate[],
  picked: string
): PlatzplanCandidate[] {
  const pickedRow = candidates.find((c) => c.url === picked)
  const rest = candidates.filter((c) => c.url !== picked)
  const files = rest.filter((c) => isDirectFileUrl(c.url))
  const pages = rest.filter((c) => !isDirectFileUrl(c.url))
  return [pickedRow, ...files, ...pages].filter((c): c is PlatzplanCandidate => !!c)
}

function likelyNav(url: string, text: string, start: string): boolean {
  if (isRejectedPlatzplanCandidate(url, text)) return false
  if (isSiblingSiteHome(url, start)) return true
  return NAV_RE.test(url) || NAV_RE.test(text) || PLAN_LABEL_RE.test(text)
}

function isXmlSitemapDocument(url: string, html: string): boolean {
  if (isXmlPlatzplanUrl(url) && /<loc>/i.test(html)) return true
  if (/<urlset[\s>]|<sitemapindex[\s>]/i.test(html)) return true
  return /sitemap/i.test(url) && html.includes('<loc>')
}

async function attachMissingTitles(candidates: PlatzplanCandidate[]): Promise<void> {
  let extra = 0
  for (const c of candidates) {
    if (c.title && !['link', 'embed', 'sitemap', 'nav'].includes(c.title.toLowerCase())) continue
    if (isPdfUrl(c.url) || isImageUrl(c.url)) {
      c.title = filenameFromUrl(c.url)
      continue
    }
    if (extra >= 5) {
      if (!c.title) c.title = filenameFromUrl(c.url)
      continue
    }
    extra += 1
    const html = await fetchHtml(c.url)
    const title = html ? extractHtmlTitle(html) : ''
    c.title = title || filenameFromUrl(c.url)
  }
}

export async function crawlPlatzplanCandidates(startUrl: string): Promise<{
  candidates: PlatzplanCandidate[]
  pages: string[]
  navHints: Array<{ url: string; text: string }>
}> {
  const start = resolveUrl(startUrl, startUrl)
  if (!start) return { candidates: [], pages: [], navHints: [] }

  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [{ url: start, depth: 0 }]
  const guessed: Array<{ url: string; depth: number }> = []
  const extraOrigins = new Set<string>()
  const candidates: PlatzplanCandidate[] = []
  const pages: string[] = []
  const navHints: Array<{ url: string; text: string }> = []
  const pageTitles = new Map<string, string>()

  const extraPaths = [
    '/platzplan',
    '/lageplan',
    '/karte',
    '/map',
    '/de/platzplan',
    '/de/lageplan',
    '/de/karte',
    '/de/lageplan-campingplatz',
    '/en/map',
    '/en/map-campsite',
    '/mappa-campeggio',
    '/sitemap.xml',
  ]
  const enqueueGuessedPaths = (origin: string) => {
    if (extraOrigins.has(origin)) return
    extraOrigins.add(origin)
    for (const p of extraPaths) {
      const extraUrl = origin + p
      if (isRejectedPlatzplanUrl(extraUrl) && !isXmlPlatzplanUrl(extraUrl)) continue
      guessed.push({ url: extraUrl, depth: 1 })
    }
  }
  try {
    enqueueGuessedPaths(new URL(start).origin)
  } catch {
    /* ignore */
  }

  while ((queue.length > 0 || guessed.length > 0) && pages.length < MAX_PAGES) {
    const next = queue.shift() ?? guessed.shift()
    if (!next) break
    if (visited.has(next.url)) continue
    if (!sameSite(start, next.url)) continue
    // HTML-Navigations-Sitemaps nicht crawlen; XML-Sitemaps nur als Index für echte Plan-URLs.
    if (isRejectedPlatzplanUrl(next.url) && !isXmlPlatzplanUrl(next.url)) {
      visited.add(next.url)
      continue
    }
    visited.add(next.url)

    const html = await fetchHtml(next.url)
    if (!html) continue
    pages.push(next.url)
    try {
      enqueueGuessedPaths(new URL(next.url).origin)
    } catch {
      /* ignore */
    }
    const pageTitle = extractHtmlTitle(html)
    if (pageTitle) pageTitles.set(next.url, pageTitle)

    if (isXmlSitemapDocument(next.url, html)) {
      const locs = [...html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
        .map((x) => x[1]?.trim())
        .filter((loc): loc is string => !!loc)
      for (const loc of locs) {
        if (isXmlPlatzplanUrl(loc) || isRejectedPlatzplanUrl(loc)) continue
        const hint = filenameFromUrl(loc)
        if (PLAN_RE.test(loc) || pathSuggestsCampsiteMap(loc) || PLAN_LABEL_RE.test(hint)) {
          const sc = scoreCandidate(loc, hint)
          if (sc >= 4) {
            candidates.push({
              url: loc,
              anchor: hint,
              found_on: next.url,
              score: sc,
              title: hint,
            })
          }
        } else if (likelyNav(loc, hint, start) && next.depth < MAX_DEPTH && sameSite(start, loc)) {
          queue.push({ url: loc, depth: next.depth + 1 })
        }
      }
      continue
    }

    for (const alt of extractHreflang(html, next.url)) {
      if (isRejectedPlatzplanUrl(alt.href) && !isXmlPlatzplanUrl(alt.href)) continue
      if (!sameSite(start, alt.href) || next.depth >= MAX_DEPTH) continue
      if (alt.lang.startsWith('de')) {
        queue.unshift({ url: alt.href, depth: next.depth + 1 })
      } else if (alt.lang.startsWith('en')) {
        queue.push({ url: alt.href, depth: next.depth + 1 })
      }
    }

    const links = [
      ...extractLinks(html, next.url),
      ...extractEmbeds(html, next.url),
      ...extractLooseMediaUrls(html),
    ]
    for (const link of links) {
      const sc = scoreCandidate(link.href, link.text)
      if (sc >= 4) {
        candidates.push({
          url: link.href,
          anchor: link.text,
          found_on: next.url,
          score: sc,
          title: defaultCandidateTitle(link.href, link.text),
        })
        // HTML-Treffer weiter öffnen, damit der direkte PDF-/Bild-Link darauf gefunden wird
        if (
          !isDirectFileUrl(link.href) &&
          !isRejectedPlatzplanUrl(link.href) &&
          next.depth + 1 <= MAX_DEPTH &&
          sameSite(start, link.href)
        ) {
          queue.unshift({ url: link.href, depth: next.depth + 1 })
        }
      } else if (likelyNav(link.href, link.text, start) && sameSite(start, link.href)) {
        navHints.push({ url: link.href, text: link.text })
        if (next.depth + 1 <= MAX_DEPTH) {
          if (isSiblingSiteHome(link.href, start)) {
            queue.unshift({ url: link.href, depth: next.depth + 1 })
          } else {
            queue.push({ url: link.href, depth: next.depth + 1 })
          }
        }
      }
    }
  }

  const uniq = new Map<string, PlatzplanCandidate>()
  for (const c of candidates) {
    const prev = uniq.get(c.url)
    if (!prev || c.score > prev.score) {
      uniq.set(c.url, { ...c, title: c.title || prev?.title })
    } else if (!prev.title && c.title) {
      uniq.set(c.url, { ...prev, title: c.title })
    }
  }
  const sorted = sortCandidates(
    [...uniq.values()].filter((c) => c.score >= 4 && !isRejectedPlatzplanCandidate(c.url, c.anchor))
  ).slice(0, 12)
  for (const c of sorted) {
    const crawled = pageTitles.get(c.url)
    if (crawled) c.title = crawled
    else if (!c.title) c.title = defaultCandidateTitle(c.url, c.anchor) ?? filenameFromUrl(c.url)
  }
  await attachMissingTitles(sorted)
  const uniqNav: Array<{ url: string; text: string }> = []
  const seenNav = new Set<string>()
  for (const n of navHints) {
    if (seenNav.has(n.url) || isRejectedPlatzplanUrl(n.url)) continue
    seenNav.add(n.url)
    uniqNav.push(n)
    if (uniqNav.length >= 20) break
  }
  return { candidates: sorted, pages, navHints: uniqNav }
}

const PICK_SYSTEM = `Du wählst die direkteste URL zum aktuellen Camping-Platzplan (Lageplan/Stellplatzplan der Parzellen).
JSON: {"url":"<eine URL aus der Liste oder null>","begruendung":"<kurz auf Deutsch>"}.
Nur eine URL aus der Liste. Wenn kein Platzplan erkennbar: url null.
Niemals wählen: XML-Dateien, sitemap.xml, WordPress-Sitemaps (wp-sitemap-…xml) oder HTML-Seiten wie /site-map und /sitemap. Das ist die Navigationsübersicht der Website („plan du site“), kein Camping-Lageplan – trotz ähnlicher englischer Wörter (site map vs. site plan / map).
Typische richtige Treffer: Bild, PDF oder Webseite mit dem Plan. Menüworte dafür sind oft „Karte“, „Lageplan“, „Platzplan“ – nicht „Sitemap“ und nicht Treue-/Rabattkarten („Karten und Vorteile“).
Interaktive/dynamische Pläne sind erwünscht, auch wenn sie den Stellplatz markieren oder die Route dorthin zeigen.
Reihenfolge der Güte:
1. PDF oder Bilddatei, die der Plan selbst ist (Dateiname mit Platzplan/Lageplan, aktuelles Jahr, „runterladen“).
2. Interaktive Karten-Seite (Stellplatzwahl, markierter Platz, Anfahrt zum Platz).
3. Nur wenn kein solches File existiert: HTML-Seite, auf der der Plan liegt.
Keine Datenschutzerklärungen, Bewerbungen, Speisekarten, Bereichs-Detailkarten.
HTML-Übersichtsseiten sind Alternativen, nicht die beste Wahl, wenn ein PDF existiert.
Sprach-Reihenfolge: Deutsch vor Englisch vor der Landessprache.`

const DISCOVER_SYSTEM = `Du findest den Camping-Platzplan (Lageplan/Stellplatzplan) für einen Campingplatz.
JSON: {"urls":["https://..."],"begruendung":"<kurz auf Deutsch>"}.
Liefere 1–5 konkrete http(s)-URLs. Typische Treffer: PDF, Bild oder HTML-Seite mit Karte/Lageplan/Platzplan.
Interaktive Pläne (markierter Stellplatz, Route dorthin) sind erwünscht.
Niemals: XML, sitemap.xml, wp-sitemap, HTML-Sitemaps (/site-map, /sitemap, plan du site).
Keine Datenschutzerklärungen, Speisekarten, Treuekarten.
Nutze die angegebene Website und übliche Pfade (/karte, /lageplan, /platzplan, /map, /mappa, lageplan-campingplatz).`

async function discoverPlatzplanWithAi(
  apiKey: string,
  campingplatzName: string,
  website: string
): Promise<{ urls: string[]; begruendung: string }> {
  const run = async (useWeb: boolean) =>
    chatJson({
      apiKey,
      system: DISCOVER_SYSTEM,
      user: `Campingplatz: ${campingplatzName}\nWebsite: ${website}\n\nWelche URLs führen zum aktuellen Platzplan?`,
      temperature: 0.2,
      trigger: 'auto',
      title: 'Camping Packliste Platzplan-Suche',
      plugins: useWeb ? [{ id: 'web', max_results: 5 }] : undefined,
    })
  try {
    let result: Awaited<ReturnType<typeof chatJson>>
    try {
      result = await run(true)
    } catch {
      result = await run(false)
    }
    const raw = result.json.urls
    const urls: string[] = []
    if (Array.isArray(raw)) {
      for (const u of raw) {
        const s = String(u ?? '').trim()
        if (/^https?:\/\//i.test(s) && !isRejectedPlatzplanUrl(s) && !urls.includes(s)) urls.push(s)
      }
    }
    const single = String(result.json.url ?? '').trim()
    if (/^https?:\/\//i.test(single) && !isRejectedPlatzplanUrl(single) && !urls.includes(single)) {
      urls.push(single)
    }
    return { urls: urls.slice(0, 5), begruendung: String(result.json.begruendung ?? '') }
  } catch (error) {
    console.error('discoverPlatzplanWithAi:', error)
    return { urls: [], begruendung: '' }
  }
}

function aiUrlIsCrawlable(url: string, start: string): boolean {
  if (isRejectedPlatzplanUrl(url)) return false
  if (isDirectFileUrl(url)) return looksLikePlan(url, filenameFromUrl(url))
  return sameSite(url, start)
}

async function pickWithAi(
  apiKey: string,
  campingplatzName: string,
  candidates: PlatzplanCandidate[],
  navHints: Array<{ url: string; text: string }>
): Promise<{ url: string | null; begruendung: string; extraUrls: string[] }> {
  const candText =
    candidates.length > 0
      ? candidates
          .map((c, i) => {
            const kind = isPdfUrl(c.url) ? 'PDF' : isImageUrl(c.url) ? 'Bild' : 'Seite'
            return `${i + 1}. [${kind}] ${c.url} (${c.anchor || 'link'} auf ${c.found_on})`
          })
          .join('\n')
      : '(keine direkten Treffer)'
  const navText = navHints
    .slice(0, 12)
    .map((n) => `- ${n.url} (${n.text || 'nav'})`)
    .join('\n')
  const result = await chatJson({
    apiKey,
    system: PICK_SYSTEM,
    user: `Campingplatz: ${campingplatzName}\n\nKandidaten:\n${candText}\n\nWeitere Navigationslinks:\n${navText || '(keine)'}`,
    temperature: 0.1,
    trigger: 'auto',
    title: 'Camping Packliste Platzplan',
  })
  const urlRaw = result.json.url
  const url = urlRaw == null || urlRaw === '' ? null : String(urlRaw)
  const extra = navHints
    .filter(
      (n) =>
        !isRejectedPlatzplanUrl(n.url) &&
        (PLAN_RE.test(n.url) || PLAN_RE.test(n.text) || PLAN_LABEL_RE.test(n.text) || /pdf/i.test(n.url))
    )
    .map((n) => n.url)
    .slice(0, 3)
  const allowed =
    !!url &&
    !isRejectedPlatzplanUrl(url) &&
    (candidates.some((c) => c.url === url) || navHints.some((n) => n.url === url && !isRejectedPlatzplanUrl(n.url)))
  return {
    url: allowed ? url : null,
    begruendung: String(result.json.begruendung ?? ''),
    extraUrls: extra,
  }
}

export function shouldResearchPlatzplan(cp: {
  webseite?: string | null
  platzplan_url?: string | null
  platzplan_url_vorlage?: string | null
}): boolean {
  return !!cp.webseite?.trim() && !cp.platzplan_url?.trim() && !cp.platzplan_url_vorlage?.trim()
}

const BOOKING_PORTAL_HOST =
  /(?:^|\.)(?:booking|pitchup|camping\.info|camping-info|adac|google|facebook|instagram|tripadvisor|airbnb|expedia)\./i

function isLikelyOfficialWebsite(url: string): boolean {
  try {
    const u = new URL(url)
    if (!/^https?:$/i.test(u.protocol)) return false
    return !BOOKING_PORTAL_HOST.test(u.hostname)
  } catch {
    return false
  }
}

async function discoverOfficialWebsiteWithAi(
  apiKey: string,
  campingplatzName: string,
  adresse?: string | null
): Promise<string | null> {
  try {
    const result = await chatJson({
      apiKey,
      system: `Du findest die offizielle Website eines Campingplatzes.
JSON: {"url":"https://... oder null"}.
Nur die Betreiber-Website. Keine Buchungsportale (booking.com, pitchup, camping.info, ADAC, Google, Facebook).`,
      user: `Campingplatz: ${campingplatzName}${adresse ? `\nAdresse: ${adresse}` : ''}`,
      temperature: 0.1,
      trigger: 'auto',
      title: 'Camping Packliste Website-Suche',
      plugins: [{ id: 'web', max_results: 5 }],
    })
    const url = String(result.json.url ?? '').trim()
    if (/^https?:\/\//i.test(url) && isLikelyOfficialWebsite(url)) return url
  } catch (error) {
    console.error('discoverOfficialWebsiteWithAi:', error)
  }
  return null
}

function extractOpeningHoursFromHtml(html: string): string | null {
  const text = stripTags(html).replace(/\s+/g, ' ').trim()
  const markers = [
    /öffnungszeiten[:\s]+(.{20,500}?)(?:kontakt|adresse|anfahrt|impressum|$)/i,
    /horaires[:\s]+(.{20,500}?)(?:contact|adresse|accès|mentions|$)/i,
    /opening hours[:\s]+(.{20,500}?)(?:contact|address|directions|imprint|$)/i,
    /orari[:\s]+(.{20,500}?)(?:contatti|indirizzo|come arrivare|$)/i,
  ]
  for (const re of markers) {
    const m = text.match(re)
    const snippet = m?.[1]?.trim()
    if (snippet && looksLikeOpeningHours(snippet)) {
      return snippet.replace(/\s+/g, ' ').slice(0, 500)
    }
  }
  return null
}

export type PlatzplanFromWebsiteResult = {
  candidates: PlatzplanCandidate[]
  pickedUrl: string | null
  begruendung: string
  quelle: 'regel' | 'ki' | 'hybrid'
}

export async function researchPlatzplanFromWebsite(
  name: string,
  website: string,
  opts: { apiKey?: string | null }
): Promise<PlatzplanFromWebsiteResult> {
  let { candidates, navHints } = await crawlPlatzplanCandidates(website)
  candidates = sortCandidates(candidates)

  if (opts.apiKey && candidates.length === 0) {
    const discovered = await discoverPlatzplanWithAi(opts.apiKey, name, website)
    const merged: PlatzplanCandidate[] = []
    for (const url of discovered.urls) {
      if (!aiUrlIsCrawlable(url, website)) continue
      if (isDirectFileUrl(url)) {
        const sc = scoreCandidate(url, filenameFromUrl(url))
        if (sc >= 4) {
          merged.push({
            url,
            anchor: filenameFromUrl(url),
            found_on: website,
            score: sc,
            title: filenameFromUrl(url),
          })
        }
        continue
      }
      const extra = await crawlPlatzplanCandidates(url)
      merged.push(...extra.candidates)
      navHints = [...navHints, ...extra.navHints]
      const pageScore = scoreCandidate(url, discovered.begruendung || filenameFromUrl(url))
      if (pageScore >= 4) {
        merged.push({
          url,
          anchor: discovered.begruendung || 'KI-Hinweis',
          found_on: website,
          score: pageScore,
          title: extra.candidates[0]?.title,
        })
      }
    }
    const uniq = new Map<string, PlatzplanCandidate>()
    for (const c of [...candidates, ...merged]) {
      const prev = uniq.get(c.url)
      if (!prev || c.score > prev.score) uniq.set(c.url, c)
    }
    candidates = sortCandidates(
      [...uniq.values()].filter((c) => !isRejectedPlatzplanCandidate(c.url, c.anchor))
    )
  }

  let picked: string | null = bestDirectPlanFile(candidates)?.url ?? candidates[0]?.url ?? null
  const pickedRow = candidates.find((c) => c.url === picked)
  let begruendung = picked
    ? isDirectFileUrl(picked)
      ? `Direktlink zum Platzplan (${pickedRow?.anchor || filenameFromUrl(picked)}).`
      : `Gefunden über Website-Suche (${pickedRow?.anchor || 'Link'}).`
    : 'Kein eindeutiger Platzplan-Link gefunden.'
  let quelle: 'regel' | 'ki' | 'hybrid' = 'regel'

  if (opts.apiKey) {
    const ai = await pickWithAi(opts.apiKey, name, candidates, navHints)
    const directFile = bestDirectPlanFile(candidates)
    const aiDirect = candidates.find(
      (c) => c.url === ai.url && isDirectFileUrl(c.url) && looksLikePlan(c.url, c.anchor)
    )
    if (aiDirect) {
      picked = aiDirect.url
      begruendung = ai.begruendung || begruendung
      quelle = 'hybrid'
    } else if (directFile) {
      picked = directFile.url
      begruendung = `Direktlink zum Platzplan (${directFile.anchor || filenameFromUrl(directFile.url)}).`
      quelle = ai.url ? 'hybrid' : 'regel'
    } else if (ai.url) {
      picked = ai.url
      begruendung = ai.begruendung || begruendung
      quelle = candidates.some((c) => c.url === ai.url) ? 'hybrid' : 'ki'
    } else if (!picked && ai.extraUrls[0] && !isRejectedPlatzplanUrl(ai.extraUrls[0])) {
      const extra = await crawlPlatzplanCandidates(ai.extraUrls[0])
      candidates = sortCandidates([...candidates, ...extra.candidates])
      const extraFile = bestDirectPlanFile(candidates)
      picked = extraFile?.url ?? extra.candidates[0]?.url ?? picked
      if (picked) {
        begruendung = extraFile
          ? `Direktlink zum Platzplan (${extraFile.anchor || filenameFromUrl(extraFile.url)}).`
          : 'Nach gezielter Unterseite gefunden.'
        quelle = 'hybrid'
      }
    }
  }

  if (picked && isRejectedPlatzplanUrl(picked)) {
    picked = candidates.find((c) => !isRejectedPlatzplanUrl(c.url))?.url ?? null
  }

  return { candidates, pickedUrl: picked, begruendung, quelle }
}

export type ResearchDraftInput = {
  name: string
  webseite?: string | null
  adresse?: string | null
  oeffnungszeiten?: string | null
  platzplan_url?: string | null
  platzplan_url_vorlage?: string | null
}

export type ResearchDraftResult = {
  webseite: string | null
  platzplan_url: string | null
  oeffnungszeiten: string | null
  candidates: PlatzplanCandidate[]
}

/** Recherche ohne gespeicherten Datensatz – füllt nur leere Felder. */
export async function researchDraftGaps(
  input: ResearchDraftInput,
  opts: { apiKey?: string | null }
): Promise<ResearchDraftResult> {
  const out: ResearchDraftResult = {
    webseite: null,
    platzplan_url: null,
    oeffnungszeiten: null,
    candidates: [],
  }

  let website = input.webseite?.trim() || ''
  if (!website && opts.apiKey && input.name.trim()) {
    const found = await discoverOfficialWebsiteWithAi(opts.apiKey, input.name.trim(), input.adresse)
    if (found) {
      website = found
      out.webseite = found
    }
  }

  if (website && !input.platzplan_url?.trim() && !input.platzplan_url_vorlage?.trim()) {
    const plan = await researchPlatzplanFromWebsite(input.name.trim() || website, website, opts)
    out.candidates = plan.candidates
    out.platzplan_url = plan.pickedUrl
  }

  if (website && !input.oeffnungszeiten?.trim()) {
    const html = await fetchHtml(website)
    if (html) out.oeffnungszeiten = extractOpeningHoursFromHtml(html)
  }

  return out
}

async function recordPlatzplanResearchMiss(db: D1Database, campingplatzId: string): Promise<void> {
  const fingerprint = `place_gap:${campingplatzId}:platzplan`
  const existing = await db
    .prepare(`SELECT id FROM smart_vorschlaege WHERE kind = 'place_gap' AND fingerprint = ?`)
    .bind(fingerprint)
    .first<{ id: string }>()
  if (existing?.id) {
    await db
      .prepare(
        `UPDATE smart_vorschlaege
         SET status = 'dismissed',
             begruendung = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind('Kein Platzplan gefunden – nicht in der Inbox.', existing.id)
      .run()
    return
  }
  await db
    .prepare(
      `INSERT INTO smart_vorschlaege
       (id, kind, status, titel, begruendung, payload_json, kontext_typ, kontext_id, quelle, fingerprint)
       VALUES (?, 'place_gap', 'dismissed', ?, ?, ?, 'campingplatz', ?, 'regel', ?)`
    )
    .bind(
      crypto.randomUUID(),
      'Platzplan-Suche ohne Treffer',
      'Kein Platzplan gefunden – nicht in der Inbox.',
      JSON.stringify({ campingplatz_id: campingplatzId }),
      campingplatzId,
      fingerprint
    )
    .run()
}

async function dismissPlaceGap(db: D1Database, campingplatzId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE smart_vorschlaege
       SET status = 'dismissed', updated_at = datetime('now')
       WHERE kind = 'place_gap' AND kontext_id = ?`
    )
    .bind(campingplatzId)
    .run()
}

/** Campingplätze ohne Platzplan, noch ohne offenen URL-Vorschlag. */
export async function listCampingplaetzeForPlatzplanResearch(
  db: D1Database,
  limit = 4
): Promise<string[]> {
  const today = todayInAppTimezone()
  const cap = Math.min(Math.max(limit, 1), 8)
  try {
    const res = await db
      .prepare(
        `SELECT c.id
         FROM campingplaetze c
         WHERE c.is_archived = 0
           AND c.webseite IS NOT NULL AND TRIM(c.webseite) != ''
           AND (c.platzplan_url IS NULL OR TRIM(c.platzplan_url) = '')
           AND (c.platzplan_url_vorlage IS NULL OR TRIM(c.platzplan_url_vorlage) = '')
           AND NOT EXISTS (
             SELECT 1 FROM smart_vorschlaege s
             WHERE s.kontext_id = c.id
               AND s.kind = 'platzplan'
               AND s.status IN ('pending', 'snoozed', 'accepted')
           )
         ORDER BY
           (SELECT MIN(u.startdatum)
            FROM urlaub_campingplaetze uc
            JOIN urlaube u ON u.id = uc.urlaub_id
            WHERE uc.campingplatz_id = c.id AND u.enddatum >= ?) IS NULL,
           (SELECT MIN(u.startdatum)
            FROM urlaub_campingplaetze uc
            JOIN urlaube u ON u.id = uc.urlaub_id
            WHERE uc.campingplatz_id = c.id AND u.enddatum >= ?),
           COALESCE(
             (SELECT MAX(s.updated_at) FROM smart_vorschlaege s
              WHERE s.kontext_id = c.id AND s.kind IN ('platzplan', 'place_gap')),
             '1970-01-01'
           )
         LIMIT ${cap}`
      )
      .bind(today, today)
      .all<{ id: string }>()
    return (res.results || []).map((r) => r.id)
  } catch (error) {
    console.error('listCampingplaetzeForPlatzplanResearch:', error)
    return []
  }
}

export async function researchPlatzplanForCampingplatz(
  db: D1Database,
  campingplatzId: string,
  opts: { apiKey?: string | null }
): Promise<{ suggestionId: string | null; candidates: PlatzplanCandidate[]; pickedUrl: string | null }> {
  const cp = await db
    .prepare(
      `SELECT id, name, webseite, platzplan_url, platzplan_url_vorlage FROM campingplaetze WHERE id = ?`
    )
    .bind(campingplatzId)
    .first<{
      id: string
      name: string
      webseite: string | null
      platzplan_url: string | null
      platzplan_url_vorlage: string | null
    }>()
  if (!cp?.webseite) return { suggestionId: null, candidates: [], pickedUrl: null }
  if (cp.platzplan_url || cp.platzplan_url_vorlage) {
    return { suggestionId: null, candidates: [], pickedUrl: null }
  }

  const { candidates, pickedUrl: picked, begruendung, quelle } = await researchPlatzplanFromWebsite(
    cp.name,
    cp.webseite,
    opts
  )

  if (!picked) {
    await recordPlatzplanResearchMiss(db, cp.id)
    return { suggestionId: null, candidates, pickedUrl: null }
  }

  await dismissPlaceGap(db, cp.id)
  const suggestion = await upsertSmartSuggestion(db, {
    kind: 'platzplan',
    fingerprint: `platzplan:${cp.id}`,
    titel: `Platzplan für ${cp.name}`,
    begruendung,
    payload: {
      campingplatz_id: cp.id,
      campingplatz_name: cp.name,
      url: picked,
      candidates: orderCandidatesForPayload(candidates, picked).slice(0, 8),
    },
    kontext_typ: 'campingplatz',
    kontext_id: cp.id,
    quelle,
  })
  return { suggestionId: suggestion?.id ?? null, candidates, pickedUrl: picked }
}
