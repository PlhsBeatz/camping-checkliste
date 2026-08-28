/**
 * Mehrstufige Platzplan-Suche auf der Campingplatz-Website.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { chatJson } from '@/lib/ai/openrouter-client'
import { upsertSmartSuggestion } from '@/lib/smart-suggestions'

const MAX_PAGES = 10
const MAX_DEPTH = 3
const MAX_HTML_BYTES = 400_000
const FETCH_MS = 8_000

export type PlatzplanCandidate = {
  url: string
  anchor: string
  found_on: string
  score: number
}

const PLAN_RE =
  /platzplan|lageplan|site[-_]?map|campingplan|plan[-_]?du[-_]?camping|pitch[-_]?map|emplacement|stellplatzplan|camping[-_]?map/i

const NAV_RE =
  /plan|anlage|platz|info|download|pdf|karte|map|pitch|emplacement|facilit|dokument|download/i

const SKIP_RE = /\.(jpg|jpeg|png|gif|webp|svg|css|js|woff2?|mp4|zip)(\?|$)/i

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

function extractLinks(html: string, pageUrl: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = []
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = m[1]
    const inner = m[2]
    if (!href) continue
    const abs = resolveUrl(href, pageUrl)
    if (!abs || SKIP_RE.test(abs)) continue
    const text = stripTags(inner ?? '').slice(0, 120)
    out.push({ href: abs, text })
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
      headers: { 'User-Agent': 'CampingPackliste/1.0 (Platzplan-Suche)' },
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

function scoreCandidate(url: string, text: string): number {
  let s = 0
  if (PLAN_RE.test(url) || PLAN_RE.test(text)) s += 8
  if (/\.pdf(\?|$)/i.test(url)) s += 4
  if (/map|plan|karte/i.test(url) || /map|plan|karte/i.test(text)) s += 2
  return s
}

function likelyNav(url: string, text: string): boolean {
  return NAV_RE.test(url) || NAV_RE.test(text)
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
  const candidates: PlatzplanCandidate[] = []
  const pages: string[] = []
  const navHints: Array<{ url: string; text: string }> = []

  const extraPaths = ['/platzplan', '/lageplan', '/plan', '/sitemap.xml']
  try {
    const origin = new URL(start).origin
    for (const p of extraPaths) queue.push({ url: origin + p, depth: 1 })
  } catch {
    /* ignore */
  }

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const next = queue.shift()
    if (!next) break
    if (visited.has(next.url)) continue
    if (!sameOrigin(start, next.url)) continue
    visited.add(next.url)

    const html = await fetchHtml(next.url)
    if (!html) continue
    pages.push(next.url)

    if (/sitemap/i.test(next.url) && html.includes('<loc>')) {
      const locs = [...html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
        .map((x) => x[1]?.trim())
        .filter((loc): loc is string => !!loc)
      for (const loc of locs) {
        if (PLAN_RE.test(loc)) {
          candidates.push({
            url: loc,
            anchor: 'sitemap',
            found_on: next.url,
            score: scoreCandidate(loc, 'sitemap'),
          })
        } else if (likelyNav(loc, '') && next.depth < MAX_DEPTH) {
          queue.push({ url: loc, depth: next.depth + 1 })
        }
      }
      continue
    }

    const links = extractLinks(html, next.url)
    for (const link of links) {
      const sc = scoreCandidate(link.href, link.text)
      if (sc >= 4) {
        candidates.push({
          url: link.href,
          anchor: link.text,
          found_on: next.url,
          score: sc,
        })
      } else if (likelyNav(link.href, link.text)) {
        navHints.push({ url: link.href, text: link.text })
        if (next.depth + 1 <= MAX_DEPTH) queue.push({ url: link.href, depth: next.depth + 1 })
      }
    }
  }

  const uniq = new Map<string, PlatzplanCandidate>()
  for (const c of candidates) {
    const prev = uniq.get(c.url)
    if (!prev || c.score > prev.score) uniq.set(c.url, c)
  }
  const sorted = [...uniq.values()].sort((a, b) => b.score - a.score).slice(0, 12)
  const uniqNav: Array<{ url: string; text: string }> = []
  const seenNav = new Set<string>()
  for (const n of navHints) {
    if (seenNav.has(n.url)) continue
    seenNav.add(n.url)
    uniqNav.push(n)
    if (uniqNav.length >= 20) break
  }
  return { candidates: sorted, pages, navHints: uniqNav }
}

const PICK_SYSTEM = `Du wählst die beste URL für einen Camping-Platzplan (Lageplan/Stellplatzplan).
JSON: {"url":"<eine URL aus der Liste oder null>","begruendung":"<kurz auf Deutsch>"}.
Nur eine URL aus der Liste. Wenn kein Platzplan erkennbar: url null.`

async function pickWithAi(
  apiKey: string,
  campingplatzName: string,
  candidates: PlatzplanCandidate[],
  navHints: Array<{ url: string; text: string }>
): Promise<{ url: string | null; begruendung: string; extraUrls: string[] }> {
  const candText =
    candidates.length > 0
      ? candidates.map((c, i) => `${i + 1}. ${c.url} (${c.anchor || 'link'} auf ${c.found_on})`).join('\n')
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
    .filter((n) => PLAN_RE.test(n.url) || PLAN_RE.test(n.text) || /pdf/i.test(n.url))
    .map((n) => n.url)
    .slice(0, 3)
  return {
    url: url && (candidates.some((c) => c.url === url) || navHints.some((n) => n.url === url)) ? url : null,
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

  let { candidates, navHints } = await crawlPlatzplanCandidates(cp.webseite)

  let picked: string | null = candidates[0]?.url ?? null
  let begruendung = picked
    ? `Gefunden über Website-Suche (${candidates[0]?.anchor || 'Link'}).`
    : 'Kein eindeutiger Platzplan-Link gefunden.'
  let quelle: 'regel' | 'ki' | 'hybrid' = 'regel'

  if (opts.apiKey) {
    const ai = await pickWithAi(opts.apiKey, cp.name, candidates, navHints)
    if (ai.url) {
      picked = ai.url
      begruendung = ai.begruendung || begruendung
      quelle = candidates.some((c) => c.url === ai.url) ? 'hybrid' : 'ki'
    } else if (!picked && ai.extraUrls[0]) {
      const extra = await crawlPlatzplanCandidates(ai.extraUrls[0])
      candidates = [...candidates, ...extra.candidates]
      picked = extra.candidates[0]?.url ?? picked
      if (picked) {
        begruendung = 'Nach gezielter Unterseite gefunden.'
        quelle = 'hybrid'
      }
    }
  }

  if (!picked) {
    const gap = await upsertSmartSuggestion(db, {
      kind: 'place_gap',
      fingerprint: `place_gap:${cp.id}:platzplan`,
      titel: `Platzplan für ${cp.name} fehlt`,
      begruendung: 'Auf der Website konnte kein klarer Platzplan gefunden werden.',
      payload: { campingplatz_id: cp.id },
      kontext_typ: 'campingplatz',
      kontext_id: cp.id,
      quelle: 'regel',
    })
    return { suggestionId: gap?.id ?? null, candidates, pickedUrl: null }
  }

  const suggestion = await upsertSmartSuggestion(db, {
    kind: 'platzplan',
    fingerprint: `platzplan:${cp.id}`,
    titel: `Platzplan für ${cp.name}`,
    begruendung,
    payload: {
      campingplatz_id: cp.id,
      url: picked,
      candidates: candidates.slice(0, 6),
    },
    kontext_typ: 'campingplatz',
    kontext_id: cp.id,
    quelle,
  })
  return { suggestionId: suggestion?.id ?? null, candidates, pickedUrl: picked }
}
