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
  /** Bis zu 8 Kandidaten – User wählt in der UI */
  imageCandidates: FloorplanCandidate[]
  /** Bereits vorhandenes Katalog-/Fahrzeugbild (URL relativ zur App) */
  existingImageUrl: string | null
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

Bild-Regeln (sehr strikt):
- grundriss_bild_url: NUR direkte URL eines 2D-Grundrisses/Plattegronds (Draufsicht mit Möbeln/Räumen als Linienzeichnung oder Plan).
- NIEMALS: Innenraumfotos, Außenfotos, Hero-/Lifestyle-Bilder, Galerie, Thumbnails von Fotos.
- URL/Dateiname sollte Begriffe wie grundriss, plattegrond, floorplan, layout, indeling enthalten – sonst null.
- Kein HTML als Bild-URL. Lieber null als falsches Foto.
- deichsel_im_grundriss: true wenn die Deichsel im Grundriss mitgezeichnet ist, false wenn nur der Aufbau, null wenn unklar.
- source_url / manufacturer_url: Seiten der Quellen.`

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** Positive Signale für echten Grundriss/Plattegrond in URL/Text. */
const FLOORPLAN_RE =
  /plattegrond|floor[_-]?plan|floorplan|grundriss|grundrissplan|lageplan|indeling|wohnraumplan|aufteilung|floor_plan|site[_-]?plan|layout[_-]?(plan|ww|caravan|wagen)|plan[_-]?(layout|floor)/i

/** Klare Foto-/Galerie-Signale – ohne Floorplan-Keyword ablehnen. */
const PHOTO_REJECT_RE =
  /interieur|interior|binnen(?:kant|kijker)?|innen(?:raum|ansicht|foto)?|außen|aussen|exterior|buiten|outdoor|lifestyle|gallery|galerie|hero|slider|carousel|mood|detailfoto|close[_-]?up|wohnraumfoto|schla[^/]*foto|badfoto|kueche|küche|kitchen|bedroom|bathroom|living|sitzgruppe|dinette|panorama|360|video|thumb(?!.*(?:grundriss|plattegrond|floor))/i

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

function hasFloorplanSignal(text: string): boolean {
  return FLOORPLAN_RE.test(text)
}

function hasPhotoRejectSignal(text: string): boolean {
  return PHOTO_REJECT_RE.test(text)
}

function scoreImageCandidate(url: string, modelHint: string, hersteller: string): number {
  const lower = url.toLowerCase()
  const floor = hasFloorplanSignal(lower)
  const photo = hasPhotoRejectSignal(lower)

  // Foto ohne Grundriss-Signal: hart verwerfen
  if (photo && !floor) return -200

  let score = scoreSourceUrl(url, hersteller)
  if (floor) score += 120
  else score -= 40 // ohne Keyword deutlich abwerten
  if (/\.(webp|png)$/i.test(lower)) score += 5
  for (const t of modelHint.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 2)) {
    if (lower.includes(t)) score += 6
  }
  // „foto“ allein oft Galerie – nur ohne Floorplan bestrafen
  if (/\bfoto\b|\bphoto\b|\bimage\b/i.test(lower) && !floor) score -= 40
  return score
}

/**
 * Grobe Raster-Heuristik: Grundrisse sind meist hell/weiß mit Linien, Innenfotos bunt.
 * Liefert 0…1; <0.45 = eher Foto.
 */
async function estimateFloorplanLikelihood(
  bytes: Uint8Array,
  mime: string
): Promise<number> {
  try {
    const { PNG } = await import('pngjs')
    const { Buffer } = await import('node:buffer')
    const jpegDecodeWasm = (await import('@jsquash/jpeg/decode')).default
    const { decode: decodeJpegJs } = await import('jpeg-js')
    const webpDecode = (await import('@jsquash/webp/decode')).default

    let rgba: Uint8ClampedArray
    let w: number
    let h: number
    const isJpegMagic = bytes[0] === 0xff && bytes[1] === 0xd8
    const isPngMagic =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    const isWebpMagic =
      bytes.byteLength >= 12 &&
      bytes[0] === 0x52 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    const kind = isPngMagic
      ? 'png'
      : isWebpMagic
        ? 'webp'
        : isJpegMagic || mime.includes('jpeg') || mime.includes('jpg')
          ? 'jpeg'
          : mime.includes('png')
            ? 'png'
            : mime.includes('webp')
              ? 'webp'
              : null
    if (!kind) return 0.3

    if (kind === 'png') {
      const png = PNG.sync.read(Buffer.from(bytes))
      rgba = new Uint8ClampedArray(png.data)
      w = png.width
      h = png.height
    } else if (kind === 'webp') {
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)
      const ab = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer
      const img = await webpDecode(ab)
      rgba = new Uint8ClampedArray(img.data)
      w = img.width
      h = img.height
    } else {
      try {
        const copy = new Uint8Array(bytes.byteLength)
        copy.set(bytes)
        const ab = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer
        const img = await jpegDecodeWasm(ab)
        rgba = new Uint8ClampedArray(img.data)
        w = img.width
        h = img.height
      } catch {
        const raw = decodeJpegJs(bytes, { useTArray: true, formatAsRGBA: true })
        rgba = new Uint8ClampedArray(raw.data)
        w = raw.width
        h = raw.height
      }
    }

    if (w < 40 || h < 40) return 0.2
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 2500)))
    let light = 0
    let dark = 0
    let colorful = 0
    let n = 0
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4
        const r = rgba[i]!
        const g = rgba[i + 1]!
        const b = rgba[i + 2]!
        const a = rgba[i + 3]!
        if (a < 20) {
          light++
          n++
          continue
        }
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b
        const sat = max - min
        n++
        if (luma >= 230 && sat <= 28) light++
        else if (luma <= 70) dark++
        if (sat > 45 && luma > 35 && luma < 220) colorful++
      }
    }
    if (n < 50) return 0.3
    const lightR = light / n
    const darkR = dark / n
    const colorR = colorful / n
    if (colorR > 0.32) return Math.max(0, 0.25 - (colorR - 0.32))
    if (lightR < 0.32) return 0.15 + lightR * 0.4
    return Math.min(1, lightR * 0.75 + Math.min(darkR, 0.15) * 1.5 + (1 - colorR) * 0.2)
  } catch {
    return 0.35
  }
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
        if (hasPhotoRejectSignal(label) && !hasFloorplanSignal(label)) return null
        // WP-Medien ohne Grundriss-Hinweis in Titel/Alt/URL überspringen
        if (!hasFloorplanSignal(label)) return null
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

export type FloorplanCandidate = {
  url: string
  score: number
  /** Kurzhinweis für die UI */
  hint: string
}

const MAX_FLOORPLAN_CANDIDATES = 8

/** Sammelt bis zu 8 Bild-Kandidaten zur manuellen Auswahl (nicht automatisch speichern). */
export async function collectFloorplanCandidates(opts: {
  imageUrl: string | null
  sourceUrl: string | null
  manufacturerUrl: string | null
  hersteller: string
  modell: string
}): Promise<{ candidates: FloorplanCandidate[]; detail: string }> {
  const modelHint = `${opts.hersteller} ${opts.modell}`
  const tried: string[] = []
  const seedUrls: string[] = []
  const found: FloorplanCandidate[] = []
  const seenFinal = new Set<string>()

  const prefer = [opts.imageUrl, opts.manufacturerUrl, opts.sourceUrl].filter(
    (u): u is string => !!u
  )
  prefer.sort((a, b) => scoreSourceUrl(b, opts.hersteller) - scoreSourceUrl(a, opts.hersteller))
  for (const u of prefer) {
    if (!seedUrls.includes(u)) seedUrls.push(u)
  }

  for (const page of [opts.manufacturerUrl, opts.sourceUrl].filter((u): u is string => !!u)) {
    const media = await discoverViaWordpressMedia(page, opts.hersteller, opts.modell)
    for (const u of media) {
      if (!seedUrls.includes(u)) seedUrls.push(u)
    }
  }

  if (seedUrls.length === 0) {
    for (const d of herstellerDomainsFor(opts.hersteller)) {
      seedUrls.push(`https://www.${d}/`)
    }
  }

  const errors: string[] = []
  const ranked = [...seedUrls].sort(
    (a, b) =>
      scoreImageCandidate(b, modelHint, opts.hersteller) -
      scoreImageCandidate(a, modelHint, opts.hersteller)
  )

  const pushCandidate = (url: string, score: number, hint: string) => {
    const key = url.split('?')[0] ?? url
    if (seenFinal.has(key)) return
    if (hasPhotoRejectSignal(url) && !hasFloorplanSignal(url)) return
    if (score < -50) return
    seenFinal.add(key)
    found.push({ url, score, hint })
  }

  for (const candidate of ranked.slice(0, 20)) {
    if (found.length >= MAX_FLOORPLAN_CANDIDATES) break
    if (tried.includes(candidate)) continue
    tried.push(candidate)
    if (hasPhotoRejectSignal(candidate) && !hasFloorplanSignal(candidate)) {
      errors.push(`URL als Foto übersprungen: ${candidate}`)
      continue
    }
    const referer = opts.manufacturerUrl || opts.sourceUrl || undefined
    const fetched = await fetchUrl(candidate, { referer })

    if (fetched.kind === 'image') {
      const score = scoreImageCandidate(fetched.finalUrl, modelHint, opts.hersteller)
      const likelihood = await estimateFloorplanLikelihood(fetched.bytes, fetched.mime)
      const floor = hasFloorplanSignal(fetched.finalUrl)
      // Für manuelle Auswahl: großzügiger – User entscheidet
      if (floor || likelihood >= 0.4 || score >= 80) {
        pushCandidate(
          fetched.finalUrl,
          score + Math.round(likelihood * 40),
          floor
            ? `Grundriss-URL · Raster ${likelihood.toFixed(2)}`
            : likelihood >= 0.4
              ? `Möglicher Plan · Raster ${likelihood.toFixed(2)}`
              : `Kandidat · Score ${score}`
        )
      } else {
        errors.push(`Bild unwahrscheinlich: ${fetched.finalUrl}`)
      }
      continue
    }

    if (fetched.kind === 'html') {
      const fromHtml = extractImageUrlsFromHtml(fetched.text, fetched.finalUrl)
        .map((url) => ({
          url,
          score: scoreImageCandidate(url, modelHint, opts.hersteller),
        }))
        .sort((a, b) => b.score - a.score)
      const preferred = fromHtml.filter((h) => hasFloorplanSignal(h.url))
      const soft = fromHtml.filter(
        (h) => !hasFloorplanSignal(h.url) && !hasPhotoRejectSignal(h.url) && h.score >= 60
      )
      for (const hit of [...preferred, ...soft].slice(0, 14)) {
        if (found.length >= MAX_FLOORPLAN_CANDIDATES) break
        if (tried.includes(hit.url)) continue
        tried.push(hit.url)
        const img = await fetchUrl(hit.url, { referer: fetched.finalUrl })
        if (img.kind !== 'image') {
          if (img.kind === 'error') errors.push(img.detail)
          continue
        }
        const likelihood = await estimateFloorplanLikelihood(img.bytes, img.mime)
        const floor = hasFloorplanSignal(img.finalUrl)
        if (floor || likelihood >= 0.35 || hit.score >= 90) {
          pushCandidate(
            img.finalUrl,
            hit.score + Math.round(likelihood * 40),
            floor
              ? `Aus Seite · Grundriss-URL`
              : `Aus Seite · Raster ${likelihood.toFixed(2)}`
          )
        }
      }
      continue
    }

    if (fetched.kind === 'error') errors.push(fetched.detail)
  }

  found.sort((a, b) => b.score - a.score)
  const top = found.slice(0, MAX_FLOORPLAN_CANDIDATES)
  return {
    candidates: top,
    detail:
      top.length > 0
        ? `${top.length} Bildkandidat(en) zur Auswahl`
        : errors.slice(0, 3).join(' · ') ||
          'Keine Bildkandidaten gefunden – bitte manuell prüfen oder später erneut suchen',
  }
}

/** Ein gewähltes Bild laden, verarbeiten und in R2 legen. */
export async function fetchProcessAndStoreFloorplan(opts: {
  imageUrl: string
  katalogId: string
  bucket: R2Bucket
  referer?: string | null
}): Promise<{
  r2Key: string
  contentType: string
  sourceUrl: string
  warning: string | null
}> {
  const fetched = await fetchUrl(opts.imageUrl, { referer: opts.referer })
  if (fetched.kind !== 'image') {
    throw new Error(
      fetched.kind === 'error'
        ? fetched.detail
        : 'URL lieferte kein Bild (HTML?). Bitte direkte Bild-URL wählen.'
    )
  }
  const processed = await processGrundrissImage(fetched.bytes, fetched.mime)
  if (processed.ok) {
    const r2Key = buildWohnwagenKatalogImageKey(opts.katalogId, processed.mime)
    await opts.bucket.put(r2Key, processed.data, {
      httpMetadata: { contentType: processed.mime },
    })
    return {
      r2Key,
      contentType: processed.mime,
      sourceUrl: fetched.finalUrl,
      warning: processed.cropped
        ? 'Weißer Rand automatisch beschnitten.'
        : null,
    }
  }
  const origMime = fetched.mime || 'image/jpeg'
  const r2Key = buildWohnwagenKatalogImageKey(opts.katalogId, origMime)
  await opts.bucket.put(r2Key, fetched.bytes, {
    httpMetadata: { contentType: origMime },
  })
  return {
    r2Key,
    contentType: origMime,
    sourceUrl: fetched.finalUrl,
    warning: `Als Original gespeichert (${processed.reason})`,
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
grundriss_bild_url: nur 2D-Plattegrond/Grundriss (Draufsicht), nie Innenraum- oder Außenfoto. Dateiname/URL möglichst mit grundriss|plattegrond|floorplan. Wenn unsicher → null.`,
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

  const aiImageUrl = asStr(j.grundriss_bild_url)
  const sourceUrl = asStr(j.source_url)
  const manufacturerUrl = asStr(j.manufacturer_url)

  // Bestehenden Katalogeintrag lesen (Bild nicht überschreiben, bis User wählt)
  const { getWohnwagenKatalogById } = await import('@/lib/wohnwagen-katalog-db')
  const previous = await getWohnwagenKatalogById(input.db, katalogId)

  let imageCandidates: FloorplanCandidate[] = []
  let imageWarning: string | null = null
  const collected = await collectFloorplanCandidates({
    imageUrl: aiImageUrl,
    sourceUrl,
    manufacturerUrl,
    hersteller: asStr(j.hersteller) || hersteller,
    modell: asStr(j.modell) || modell,
  })
  imageCandidates = collected.candidates
  imageWarning = collected.detail

  const confidence = asNum(j.confidence)
  const preferredSource =
    manufacturerUrl && scoreSourceUrl(manufacturerUrl, hersteller) >
      scoreSourceUrl(sourceUrl ?? '', hersteller)
      ? manufacturerUrl
      : sourceUrl ?? manufacturerUrl

  // Maße speichern – vorhandenes R2-Bild beibehalten (COALESCE im Upsert)
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
    grundriss_bild_url: previous?.grundriss_bild_url ?? aiImageUrl,
    r2_object_key: null, // nicht löschen – COALESCE behält Altbestand
    content_type: null,
    notes:
      [
        massKlarheit,
        confidence != null ? `confidence=${confidence}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
  })

  // Maße am Fahrzeug übernehmen, Bild unverändert (User wählt separat)
  let transportExistingImageUrl: string | null = null
  if (input.applyToTransportId) {
    await applyKatalogImageToTransport(input.db, input.applyToTransportId, {
      ...entry,
      r2_object_key: null,
      content_type: null,
    })
    const { getTransportVehicleById } = await import('@/lib/db')
    const vehicle = await getTransportVehicleById(input.db, input.applyToTransportId)
    if (vehicle?.grundriss_bild_r2_key) {
      transportExistingImageUrl = `/api/transport-vehicles/${encodeURIComponent(input.applyToTransportId)}/grundriss-image`
    }
  }

  return {
    entry,
    imageApplied: false,
    imageWarning,
    sourceNotes: entry.notes ?? null,
    massKlarheit,
    imageCandidates,
    existingImageUrl: entry.r2_object_key
      ? `/api/transport-vehicles/katalog/${encodeURIComponent(entry.id)}/image`
      : transportExistingImageUrl,
  }
}
