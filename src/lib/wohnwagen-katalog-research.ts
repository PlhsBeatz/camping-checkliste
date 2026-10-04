/**
 * Wohnwagen-Maße + Grundriss-Bild per OpenRouter-Websuche ermitteln.
 * Vorrang: Hersteller-Webseite; Bild ohne Rand; Maßklarheit Gesamt vs. Aufbau/Deichsel.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { chatJson } from '@/lib/ai/openrouter-client'
import { processGrundrissImage } from '@/lib/grundriss-image-process'
import type { WohnwagenKatalogEntry } from '@/lib/db'
import {
  applyKatalogImageToTransport,
  upsertWohnwagenKatalogEntry,
} from '@/lib/wohnwagen-katalog-db'
import {
  herstellerDomainsFor,
  resolvePlacementLengthM,
  scoreSourceUrl,
} from '@/lib/wohnwagen-hersteller'

export type WohnwagenResearchInput = {
  hersteller: string
  modell: string
  baujahr?: number | null
  apiKey: string
  db: D1Database
  bucket: R2Bucket | null
  applyToTransportId?: string | null
}

export type WohnwagenResearchResult = {
  entry: WohnwagenKatalogEntry
  imageApplied: boolean
  imageWarning?: string | null
  sourceNotes?: string | null
  massKlarheit?: string | null
}

const SYSTEM = `Du recherchierst technische Daten und den Grundriss zu einem Wohnwagen/Caravan (Europa).
PRIORITÄT 1: Offizielle Hersteller-Website / PDF-Katalog / technische Daten.
PRIORITÄT 2: Nur wenn Hersteller nichts liefert – Vergleichsportale.

Antworte NUR als JSON:
{
  "hersteller": string,
  "modell": string,
  "baujahr_von": number|null,
  "baujahr_bis": number|null,
  "laenge_gesamt_m": number|null,
  "laenge_aufbau_m": number|null,
  "breite_m": number|null,
  "laenge_hinweis": string|null,
  "deichsel_im_grundriss": boolean|null,
  "grundriss_bild_url": string|null,
  "source_url": string|null,
  "manufacturer_url": string|null,
  "notes": string|null,
  "confidence": number
}

Maß-Regeln (sehr wichtig):
- laenge_gesamt_m = Gesamtlänge inkl. Deichsel (z. B. LMC „Gesamtlänge“).
- laenge_aufbau_m = Aufbaulänge außen / Karosserie OHNE Deichsel (z. B. LMC „Aufbaulänge außen“).
- Wenn nur eine Länge bekannt: in das passende Feld legen und im laenge_hinweis klar sagen welches.
- breite_m = Außenbreite.
- Alle Längen in Metern (z. B. 812 cm → 8.12).

Bild-Regeln:
- grundriss_bild_url: DIREKTE Bild-URL (.jpg/.png/.webp) des Grundrisses/Plattegronds vom Hersteller, wenn möglich.
- Keine Außen-/Innenfotos. Kein HTML, wenn Direktbild bekannt.
- deichsel_im_grundriss: true wenn die Deichsel im Grundriss mitgezeichnet ist, false wenn nur der Aufbau, null wenn unklar.
- source_url / manufacturer_url: Seiten der Quellen.`

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const FLOORPLAN_RE =
  /plattegrond|floorplan|floor[_-]?plan|grundriss|lageplan|layout|indeling|floor_plan/i

function asNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function asStr(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t || null
}

function asBool01(v: unknown): number | null {
  if (v === true || v === 1 || v === '1' || v === 'true') return 1
  if (v === false || v === 0 || v === '0' || v === 'false') return 0
  return null
}

function slugId(hersteller: string, modell: string, baujahr?: number | null): string {
  const base = `${hersteller}-${modell}-${baujahr ?? 'x'}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `wwk-net-${base || 'entry'}`
}

function looksLikeImageUrl(url: string): boolean {
  try {
    return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

function absolutizeUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

function scoreImageCandidate(url: string, modelHint: string, hersteller: string): number {
  let score = scoreSourceUrl(url, hersteller)
  const lower = url.toLowerCase()
  if (FLOORPLAN_RE.test(lower)) score += 80
  if (/\.(webp|png)$/i.test(lower)) score += 5
  for (const t of modelHint.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 2)) {
    if (lower.includes(t)) score += 8
  }
  if (/buiten|exterior|interieur|binnen|innen|foto/i.test(lower) && !FLOORPLAN_RE.test(lower)) {
    score -= 50
  }
  return score
}

type FetchResult =
  | { kind: 'image'; bytes: Uint8Array; mime: string; finalUrl: string }
  | { kind: 'html'; text: string; finalUrl: string }
  | { kind: 'error'; detail: string }

async function fetchUrl(
  url: string,
  opts?: { referer?: string | null }
): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': BROWSER_UA,
        ...(opts?.referer ? { Referer: opts.referer } : {}),
      },
    })
    if (!res.ok) return { kind: 'error', detail: `HTTP ${res.status} für ${url}` }
    const mime = (res.headers.get('content-type') || '').split(';')[0]?.trim().toLowerCase() || ''
    const finalUrl = res.url || url
    if (mime.startsWith('text/html') || mime.includes('xhtml')) {
      return { kind: 'html', text: await res.text(), finalUrl }
    }
    if (mime.startsWith('image/') || mime.includes('octet-stream') || looksLikeImageUrl(finalUrl)) {
      const buf = new Uint8Array(await res.arrayBuffer())
      if (buf.byteLength < 400) return { kind: 'error', detail: `Bild zu klein (${buf.byteLength} B)` }
      if (buf.byteLength > 8_000_000) return { kind: 'error', detail: 'Bild zu groß (>8 MB)' }
      const head = new TextDecoder().decode(buf.slice(0, 64)).trim().toLowerCase()
      if (head.startsWith('<!doctype') || head.startsWith('<html')) {
        return { kind: 'html', text: new TextDecoder().decode(buf), finalUrl }
      }
      const outMime = mime.startsWith('image/')
        ? mime
        : finalUrl.toLowerCase().includes('.png')
          ? 'image/png'
          : finalUrl.toLowerCase().includes('.webp')
            ? 'image/webp'
            : 'image/jpeg'
      return { kind: 'image', bytes: buf, mime: outMime, finalUrl }
    }
    return { kind: 'error', detail: `Unerwarteter Content-Type: ${mime || 'unbekannt'}` }
  } catch (e) {
    return { kind: 'error', detail: e instanceof Error ? e.message : String(e) }
  }
}

function extractImageUrlsFromHtml(html: string, baseUrl: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi,
    /(?:href)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi,
  ]
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const raw = m[1]
      if (!raw || raw.startsWith('data:')) continue
      const abs = absolutizeUrl(raw, baseUrl)
      if (abs && looksLikeImageUrl(abs)) found.add(abs)
    }
  }
  return [...found]
}

async function discoverViaWordpressMedia(
  sourceUrl: string,
  hersteller: string,
  modell: string
): Promise<string[]> {
  try {
    const origin = new URL(sourceUrl).origin
    const q = `${hersteller} ${modell}`.trim()
    const api = `${origin}/wp-json/wp/v2/media?search=${encodeURIComponent(q)}&per_page=20`
    const res = await fetch(api, {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
    })
    if (!res.ok) return []
    const data = (await res.json()) as Array<{
      source_url?: string
      alt_text?: string
      title?: { rendered?: string }
    }>
    if (!Array.isArray(data)) return []
    return data
      .map((item) => {
        const url = item.source_url?.trim()
        if (!url) return null
        const label = `${item.alt_text ?? ''} ${item.title?.rendered ?? ''} ${url}`
        return {
          url,
          score: scoreImageCandidate(label, `${hersteller} ${modell}`, hersteller),
        }
      })
      .filter((x): x is { url: string; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
      .filter((s) => s.score >= 40)
      .map((s) => s.url)
  } catch {
    return []
  }
}

async function resolveFloorplanImage(opts: {
  imageUrl: string | null
  sourceUrl: string | null
  manufacturerUrl: string | null
  hersteller: string
  modell: string
}): Promise<{ image: { bytes: Uint8Array; mime: string; usedUrl: string } | null; detail: string }> {
  const modelHint = `${opts.hersteller} ${opts.modell}`
  const tried: string[] = []
  const candidates: string[] = []

  // Hersteller zuerst
  const prefer = [opts.manufacturerUrl, opts.imageUrl, opts.sourceUrl].filter(
    (u): u is string => !!u
  )
  prefer.sort((a, b) => scoreSourceUrl(b, opts.hersteller) - scoreSourceUrl(a, opts.hersteller))
  for (const u of prefer) {
    if (!candidates.includes(u)) candidates.push(u)
  }

  for (const page of [opts.manufacturerUrl, opts.sourceUrl].filter((u): u is string => !!u)) {
    const media = await discoverViaWordpressMedia(page, opts.hersteller, opts.modell)
    for (const u of media) {
      if (!candidates.includes(u)) candidates.push(u)
    }
  }

  // Hersteller-Domains zusätzlich als Startseiten-Hints (nur wenn noch nichts)
  if (candidates.length === 0) {
    for (const d of herstellerDomainsFor(opts.hersteller)) {
      candidates.push(`https://www.${d}/`)
    }
  }

  const errors: string[] = []
  let bestWeak: { bytes: Uint8Array; mime: string; usedUrl: string; score: number } | null = null

  const ranked = [...candidates].sort(
    (a, b) =>
      scoreImageCandidate(b, modelHint, opts.hersteller) -
      scoreImageCandidate(a, modelHint, opts.hersteller)
  )

  for (const candidate of ranked.slice(0, 14)) {
    if (tried.includes(candidate)) continue
    tried.push(candidate)
    const referer = opts.manufacturerUrl || opts.sourceUrl || undefined
    const fetched = await fetchUrl(candidate, { referer })

    if (fetched.kind === 'image') {
      const score = scoreImageCandidate(fetched.finalUrl, modelHint, opts.hersteller)
      if (score >= 60 || FLOORPLAN_RE.test(fetched.finalUrl)) {
        return {
          image: { bytes: fetched.bytes, mime: fetched.mime, usedUrl: fetched.finalUrl },
          detail: `Bild geladen (${fetched.mime})`,
        }
      }
      if (!bestWeak || score > bestWeak.score) {
        bestWeak = {
          bytes: fetched.bytes,
          mime: fetched.mime,
          usedUrl: fetched.finalUrl,
          score,
        }
      }
      errors.push(`Bild verworfen (Score ${score}, kein klarer Grundriss): ${fetched.finalUrl}`)
      continue
    }

    if (fetched.kind === 'html') {
      const fromHtml = extractImageUrlsFromHtml(fetched.text, fetched.finalUrl)
        .map((url) => ({
          url,
          score: scoreImageCandidate(url, modelHint, opts.hersteller),
        }))
        .sort((a, b) => b.score - a.score)
      for (const hit of fromHtml.slice(0, 10)) {
        if (hit.score < 50) continue
        if (tried.includes(hit.url)) continue
        tried.push(hit.url)
        const img = await fetchUrl(hit.url, { referer: fetched.finalUrl })
        if (img.kind === 'image') {
          return {
            image: { bytes: img.bytes, mime: img.mime, usedUrl: img.finalUrl },
            detail: 'Bild aus Hersteller-/Quell-HTML',
          }
        }
        if (img.kind === 'error') errors.push(img.detail)
      }
      errors.push(`HTML ohne brauchbaren Grundriss: ${candidate}`)
      continue
    }

    if (fetched.kind === 'error') errors.push(fetched.detail)
  }

  if (bestWeak && bestWeak.score >= 30) {
    return {
      image: {
        bytes: bestWeak.bytes,
        mime: bestWeak.mime,
        usedUrl: bestWeak.usedUrl,
      },
      detail: `Bild mit unsicherem Score (${bestWeak.score}) – bitte prüfen`,
    }
  }

  return {
    image: null,
    detail:
      errors.slice(0, 3).join(' · ') ||
      'Kein herunterladbares Hersteller-Grundrissbild gefunden',
  }
}

export function buildWohnwagenKatalogImageKey(katalogId: string, contentType: string): string {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  return `wwk/${katalogId}/grundriss.${ext}`
}

function buildMassKlarheit(opts: {
  gesamt: number | null
  aufbau: number | null
  breite: number
  deichsel: number | null
  hinweis: string | null
}): string {
  const parts: string[] = []
  if (opts.gesamt != null) parts.push(`Gesamt (mit Deichsel): ${opts.gesamt} m`)
  if (opts.aufbau != null) parts.push(`Aufbau (ohne Deichsel): ${opts.aufbau} m`)
  parts.push(`Breite: ${opts.breite} m`)
  if (opts.deichsel === 1) parts.push('Deichsel im Grundriss-Bild: ja')
  else if (opts.deichsel === 0) parts.push('Deichsel im Grundriss-Bild: nein')
  else parts.push('Deichsel im Bild: unklar')
  if (opts.hinweis) parts.push(opts.hinweis)
  const place = resolvePlacementLengthM({
    laenge_aufbau_m: opts.aufbau,
    laenge_gesamt_m: opts.gesamt,
    laenge_m: opts.aufbau ?? opts.gesamt,
  })
  if (place.basis === 'aufbau') {
    parts.push('Platzierung nutzt Aufbaulänge (Karosserie).')
  } else if (place.basis === 'gesamt') {
    parts.push('Platzierung nutzt Gesamtlänge – Aufbaulänge fehlt, Skalierung prüfen.')
  }
  return parts.join(' · ')
}

export async function researchAndUpsertWohnwagenKatalog(
  input: WohnwagenResearchInput
): Promise<WohnwagenResearchResult> {
  const hersteller = input.hersteller.trim()
  const modell = input.modell.trim()
  if (!hersteller || !modell) {
    throw new Error('Hersteller und Modell sind erforderlich')
  }

  const yearHint =
    input.baujahr != null && Number.isFinite(input.baujahr)
      ? ` Baujahr ${Math.round(input.baujahr)}`
      : ''
  const domains = herstellerDomainsFor(hersteller)
  const domainHint =
    domains.length > 0
      ? ` Hersteller-Domains bevorzugen: ${domains.join(', ')}.`
      : ' Offizielle Hersteller-Website bevorzugen.'

  const ai = await chatJson({
    apiKey: input.apiKey,
    system: SYSTEM,
    user: `Finde Maße (Gesamtlänge MIT Deichsel UND Aufbaulänge OHNE Deichsel, Breite) und ein Grundriss-Bild für: ${hersteller} ${modell}${yearHint}.${domainHint}
Beispiel LMC Vivo 522 K: Gesamtlänge 8,12 m, Aufbaulänge außen 6,79 m, Breite 2,52 m – bitte analog für dieses Modell belegen.
Liefere wenn möglich eine direkte Bild-URL vom Hersteller (grundriss/plattegrond), nicht nur Vergleichsportale.`,
    plugins: [{ id: 'web' }],
    trigger: 'explicit',
    title: 'Camping Packliste Wohnwagen-Katalog',
    temperature: 0.1,
  })

  const j = ai.json
  const laengeGesamt = asNum(j.laenge_gesamt_m)
  const laengeAufbau = asNum(j.laenge_aufbau_m)
  // Legacy-Feld aus älteren Prompts
  const laengeLegacy = asNum(j.laenge_m)
  const breite = asNum(j.breite_m)
  const deichsel = asBool01(j.deichsel_im_grundriss)

  let gesamt = laengeGesamt
  let aufbau = laengeAufbau
  if (gesamt == null && aufbau == null && laengeLegacy != null) {
    // Unklar – als Gesamt speichern und kennzeichnen
    gesamt = laengeLegacy
  }

  const placement = resolvePlacementLengthM({
    laenge_aufbau_m: aufbau,
    laenge_gesamt_m: gesamt,
    laenge_m: laengeLegacy,
  })
  const laengeM = placement.lengthM
  if (laengeM == null || breite == null || laengeM <= 0 || breite <= 0 || laengeM > 15 || breite > 15) {
    throw new Error(
      asStr(j.notes) ||
        'Keine plausiblen Maße im Netz gefunden. Bitte Länge/Breite manuell eintragen.'
    )
  }

  // Plausibilität: Gesamt sollte >= Aufbau sein
  if (gesamt != null && aufbau != null && gesamt + 0.05 < aufbau) {
    // vertauscht?
    const tmp = gesamt
    gesamt = aufbau
    aufbau = tmp
  }

  const massHinweisParts = [
    asStr(j.laenge_hinweis),
    asStr(j.notes),
    gesamt != null && aufbau != null
      ? `Deichsel-Anteil ca. ${(gesamt - aufbau).toFixed(2)} m`
      : null,
    placement.basis === 'gesamt' && aufbau == null
      ? 'Nur Gesamtlänge gefunden – Skalierung des Grundrisses ggf. mit Deichsel'
      : null,
    placement.basis === 'aufbau' && gesamt == null
      ? 'Nur Aufbaulänge gefunden – Gesamtlänge mit Deichsel fehlt'
      : null,
  ].filter(Boolean)

  const massKlarheit = buildMassKlarheit({
    gesamt,
    aufbau,
    breite: Math.round(breite * 1000) / 1000,
    deichsel,
    hinweis: massHinweisParts.join(' · ') || null,
  })

  const katalogId = slugId(
    asStr(j.hersteller) || hersteller,
    asStr(j.modell) || modell,
    input.baujahr ?? asNum(j.baujahr_von)
  )

  let r2Key: string | null = null
  let contentType: string | null = null
  let imageWarning: string | null = null
  let storedImageUrl = asStr(j.grundriss_bild_url)
  const sourceUrl = asStr(j.source_url)
  const manufacturerUrl = asStr(j.manufacturer_url)

  if (input.bucket) {
    const resolved = await resolveFloorplanImage({
      imageUrl: storedImageUrl,
      sourceUrl,
      manufacturerUrl,
      hersteller: asStr(j.hersteller) || hersteller,
      modell: asStr(j.modell) || modell,
    })
    if (!resolved.image) {
      imageWarning = `Grundriss-Bild konnte nicht gespeichert werden: ${resolved.detail}`
    } else {
      const processed = await processGrundrissImage(resolved.image.bytes, resolved.image.mime)
      if (processed.ok) {
        r2Key = buildWohnwagenKatalogImageKey(katalogId, processed.mime)
        await input.bucket.put(r2Key, processed.data, {
          httpMetadata: { contentType: processed.mime },
        })
        contentType = processed.mime
        storedImageUrl = resolved.image.usedUrl
        imageWarning = processed.cropped
          ? 'Grundriss-Bild gespeichert (weißer Rand automatisch beschnitten).'
          : null
      } else {
        // Original speichern statt Bild komplett zu verwerfen (Workers-CPU/Codec-Fehler)
        const origMime = resolved.image.mime || 'image/jpeg'
        r2Key = buildWohnwagenKatalogImageKey(katalogId, origMime)
        await input.bucket.put(r2Key, resolved.image.bytes, {
          httpMetadata: { contentType: origMime },
        })
        contentType = origMime
        storedImageUrl = resolved.image.usedUrl
        imageWarning = `Bild als Original gespeichert (Verarbeitung: ${processed.reason})`
      }
      if (resolved.detail.includes('unsicher')) {
        imageWarning = (imageWarning ? `${imageWarning} ` : '') + resolved.detail
      }
    }
  } else if (storedImageUrl || sourceUrl || manufacturerUrl) {
    imageWarning = 'Grundriss-Bild gefunden, aber R2 nicht verfügbar (lokal?)'
  } else {
    imageWarning = 'Kein Grundriss-Bild in der Recherche gefunden'
  }

  const confidence = asNum(j.confidence)
  const preferredSource =
    manufacturerUrl && scoreSourceUrl(manufacturerUrl, hersteller) >
      scoreSourceUrl(sourceUrl ?? '', hersteller)
      ? manufacturerUrl
      : sourceUrl ?? manufacturerUrl

  const entry = await upsertWohnwagenKatalogEntry(input.db, {
    id: katalogId,
    hersteller: asStr(j.hersteller) || hersteller,
    modell: asStr(j.modell) || modell,
    baujahr_von: asNum(j.baujahr_von) ?? (input.baujahr != null ? Math.round(input.baujahr) : null),
    baujahr_bis: asNum(j.baujahr_bis) ?? (input.baujahr != null ? Math.round(input.baujahr) : null),
    laenge_m: Math.round(laengeM * 1000) / 1000,
    breite_m: Math.round(breite * 1000) / 1000,
    laenge_gesamt_m: gesamt != null ? Math.round(gesamt * 1000) / 1000 : null,
    laenge_aufbau_m: aufbau != null ? Math.round(aufbau * 1000) / 1000 : null,
    deichsel_im_bild: deichsel,
    mass_hinweis: massKlarheit,
    grundriss_json: null,
    source_url: preferredSource,
    grundriss_bild_url: storedImageUrl,
    r2_object_key: r2Key,
    content_type: contentType,
    notes:
      [
        massKlarheit,
        confidence != null ? `confidence=${confidence}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
  })

  let imageApplied = false
  if (input.applyToTransportId) {
    await applyKatalogImageToTransport(input.db, input.applyToTransportId, entry)
    imageApplied = !!entry.r2_object_key
  }

  return {
    entry,
    imageApplied,
    imageWarning,
    sourceNotes: entry.notes ?? null,
    massKlarheit,
  }
}
