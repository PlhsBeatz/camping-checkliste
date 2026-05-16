/**
 * Campingplatz-Fotos: serverseitig auf WebP (lange Kante max. 1600 px, Qualität 85) optimieren.
 * Läuft ohne native Bindings (pngjs, @jsquash/jpeg, @jsquash/webp) — kompatibel mit Cloudflare Workers.
 */
import { PNG } from 'pngjs'
import jpegDecodeWasm from '@jsquash/jpeg/decode'
import { decode as decodeJpegJs } from 'jpeg-js'
import webpDecode from '@jsquash/webp/decode'
import webpEncode from '@jsquash/webp/encode'

const MAX_EDGE = 1600
const WEBP_QUALITY = 85

function isRiffWebp(buf: Uint8Array): boolean {
  return (
    buf.byteLength >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
}

function detectKind(buf: Uint8Array, mimeHint?: string): 'jpeg' | 'png' | 'webp' | null {
  // Magic Bytes haben Vorrang: R2-Metadaten können vom echten Format abweichen (z. B. WebP unter .jpg-Key).
  if (buf.byteLength >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (
    buf.byteLength >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return 'png'
  if (isRiffWebp(buf)) return 'webp'

  const m = (mimeHint || '').toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpeg'
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'

  return null
}

/** Für Admin-/Diagnose‑APIs (z. B. Nachkomprimieren). */
export function detectCampingPhotoKind(buf: Uint8Array, mimeHint?: string): 'jpeg' | 'png' | 'webp' | null {
  return detectKind(buf, mimeHint)
}

/** Schnelle JPEG-SOF-Parse ohne Volldekodierung (hilft beim CPU-Budget unter Workers Free). */
function peekJpegDimensions(buf: Uint8Array): { w: number; h: number } | null {
  const n = buf.length
  if (n < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let p = 2
  while (p < n - 9) {
    if (buf[p] !== 0xff) {
      p++
      continue
    }
    p++
    while (p < n && buf[p] === 0xff) p++
    if (p >= n) return null
    const marker = buf[p]!
    p++

    if (marker >= 0xd0 && marker <= 0xd7) continue
    if (marker === 0xd9) break

    if (marker === 0x01 || marker === 0xd8) continue

    if (p + 2 > n) return null
    const Ls = (buf[p++]! << 8) | buf[p++]!
    if (Ls < 2 || p + (Ls - 2) > n) return null

    const isSOF =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xcf

    if (isSOF && Ls >= 8 && p + 5 <= n) {
      const hh = buf[p + 1]! * 256 + buf[p + 2]!
      const ww = buf[p + 3]! * 256 + buf[p + 4]!
      if (ww > 0 && hh > 0 && ww <= 65535 && hh <= 65535) return { w: ww, h: hh }
    }

    p += Ls - 2
  }
  return null
}

/** PNG‑IHDR, wenn erste Chunk ihr Standard-IHDR bleibt. */
function peekPngIhdrDimensions(buf: Uint8Array): { w: number; h: number } | null {
  if (buf.length < 24) return null
  if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) return null
  if (buf[12] !== 0x49 || buf[13] !== 0x48 || buf[14] !== 0x44 || buf[15] !== 0x52) return null
  const readU32BE = (o: number): number =>
    buf[o]! * (1 << 24) +
    buf[o + 1]! * (1 << 16) +
    buf[o + 2]! * (1 << 8) +
    buf[o + 3]!
  const w = readU32BE(16)
  const h = readU32BE(20)
  if (w <= 0 || h <= 0) return null
  return { w, h }
}

/** Megapixelzahl (Breite × Höhe / 10⁶) vor dem Dekodieren; `null` bei unbekanntem Format ohne Headerpeek (z. B. WebP). */
export function peekRasterMegapixels(buf: Uint8Array, mimeHint?: string): number | null {
  const kind = detectKind(buf, mimeHint)
  if (!kind) return null
  if (kind === 'jpeg') {
    const d = peekJpegDimensions(buf)
    return d ? (d.w * d.h) / 1_000_000 : null
  }
  if (kind === 'png') {
    const d = peekPngIhdrDimensions(buf)
    return d ? (d.w * d.h) / 1_000_000 : null
  }
  return null
}

export type CampingPhotoOptimizeOptions = {
  maxEdge?: number
  webpQuality?: number
  /** Vor Volldekodierung überspringen (JPEG/PNG), wenn geschätzte Megapixel höher sind (Workers Free‑CPU). */
  maxDecodeMegapixels?: number
}

/** Erfolg oder lesbare Ursache — vermeidet stilles Ausweichen wie bei `?.data ?? original`. */
export type CampingPhotoOptimizeResult =
  | { ok: true; data: Uint8Array }
  | { ok: false; reason: string }

/** MozJPEG-WASM schlägt in manchen gebündelten Workers fehl (`Decoding error`); jpeg-js stabilisiert den JPEG-Pfad (CPU höher bei großen Dateien – daher weiter Megapixel‑Limit beim Bulk-Nachlauf). */
async function decodeJpegToRgba(input: Uint8Array): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> {
  const wasmIn = new Uint8Array(input.byteLength)
  wasmIn.set(input)
  const wasmAb = wasmIn.buffer.slice(
    wasmIn.byteOffset,
    wasmIn.byteOffset + wasmIn.byteLength
  ) as ArrayBuffer
  let wasmErr: unknown
  try {
    const img = await jpegDecodeWasm(wasmAb)
    return {
      w: img.width,
      h: img.height,
      rgba: new Uint8ClampedArray(img.data),
    }
  } catch (e) {
    wasmErr = e
  }
  try {
    const raw = decodeJpegJs(input, {
      useTArray: true,
      formatAsRGBA: true,
    })
    const rgba = new Uint8ClampedArray(raw.data)
    return {
      w: raw.width,
      h: raw.height,
      rgba,
    }
  } catch (jsErr) {
    const w = wasmErr instanceof Error ? wasmErr.message : String(wasmErr)
    const j = jsErr instanceof Error ? jsErr.message : String(jsErr)
    throw new Error(`JPEG-Dekodierung: WASM („${w}“); Fallback jpeg-js („${j}“).`)
  }
}

function bilinearResize(
  src: Uint8Array | Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4)
  const xScale = sw / dw
  const yScale = sh / dh
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) * yScale - 0.5
    const y0 = Math.max(0, Math.floor(sy))
    const y1 = Math.min(sh - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * xScale - 0.5
      const x0 = Math.max(0, Math.floor(sx))
      const x1 = Math.min(sw - 1, x0 + 1)
      const fx = sx - x0
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4
      const o = (y * dw + x) * 4
      for (let c = 0; c < 4; c++) {
        const v =
          src[i00 + c]! * (1 - fx) * (1 - fy) +
          src[i10 + c]! * fx * (1 - fy) +
          src[i01 + c]! * (1 - fx) * fy +
          src[i11 + c]! * fx * fy
        out[o + c] = Math.round(v)
      }
    }
  }
  return out
}

function containSize(sw: number, sh: number, maxEdge: number): { w: number; h: number } {
  const m = Math.max(sw, sh)
  if (m <= maxEdge) return { w: sw, h: sh }
  const s = maxEdge / m
  return { w: Math.max(1, Math.round(sw * s)), h: Math.max(1, Math.round(sh * s)) }
}

function makeImageData(rgba: Uint8ClampedArray, width: number, height: number): ImageData {
  const copy = new Uint8ClampedArray(rgba.length)
  copy.set(rgba)
  const ID = (globalThis as unknown as { ImageData?: typeof ImageData }).ImageData
  if (typeof ID === 'function') {
    return new ID(copy, width, height)
  }
  return { data: copy, width, height } as ImageData
}

/**
 * Dekodiert gängige Rasterformate zu RGBA, skaliert auf maxEdge, kodiert WebP mit quality.
 * Upload-Routen: bei `ok: false` typischerweise Originalbytes speichern; Admin-Nachkomprimieren: Hinweis anzeigen.
 */
export async function optimizeCampingPhotoToWebp(
  input: Uint8Array,
  mimeHint?: string,
  opts?: CampingPhotoOptimizeOptions
): Promise<CampingPhotoOptimizeResult> {
  const kind = detectKind(input, mimeHint)
  if (!kind) {
    return {
      ok: false,
      reason: 'Unbekanntes Bildformat (Magic Bytes oder MIME passen nicht zu JPEG/PNG/WebP).',
    }
  }

  const maxEdge = opts?.maxEdge ?? MAX_EDGE
  const webpQuality = opts?.webpQuality ?? WEBP_QUALITY
  const decodeMpLim = opts?.maxDecodeMegapixels
  if (
    decodeMpLim != null &&
    decodeMpLim > 0 &&
    (kind === 'jpeg' || kind === 'png')
  ) {
    const guessed = peekRasterMegapixels(input, mimeHint)
    if (guessed != null && guessed > decodeMpLim) {
      return {
        ok: false,
        reason: `Zu viele Pixel zur Dekodierung (~${guessed.toFixed(1)} MP, Limit ${decodeMpLim} MP; schützt Workers‑CPU).`,
      }
    }
  }

  try {
    let rgba: Uint8ClampedArray
    let sw: number
    let sh: number

    if (kind === 'jpeg') {
      const decoded = await decodeJpegToRgba(input)
      sw = decoded.w
      sh = decoded.h
      rgba = decoded.rgba
    } else if (kind === 'png') {
      const png = PNG.sync.read(Buffer.from(input))
      sw = png.width
      sh = png.height
      rgba = new Uint8ClampedArray(png.data)
    } else {
      const webpCopy = new Uint8Array(input.byteLength)
      webpCopy.set(input)
      const ab = webpCopy.buffer.slice(webpCopy.byteOffset, webpCopy.byteOffset + webpCopy.byteLength)
      const img = await webpDecode(ab)
      sw = img.width
      sh = img.height
      rgba = new Uint8ClampedArray(img.data)
    }

    if (sw < 1 || sh < 1) {
      return { ok: false, reason: 'Ungültige Bildmaße nach Dekodierung.' }
    }

    const { w: tw, h: th } = containSize(sw, sh, maxEdge)
    let pixels = rgba
    if (tw !== sw || th !== sh) {
      pixels = bilinearResize(rgba, sw, sh, tw, th)
    }

    const ab = await webpEncode(makeImageData(pixels, tw, th), { quality: webpQuality })
    return { ok: true, data: new Uint8Array(ab) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, reason: msg }
  }
}

export const CAMPING_PHOTO_MAX_EDGE = MAX_EDGE
export const CAMPING_PHOTO_WEBP_QUALITY = WEBP_QUALITY
