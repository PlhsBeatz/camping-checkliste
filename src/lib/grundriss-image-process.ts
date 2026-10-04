/**
 * Grundriss-Bilder: Dekodieren, weißen/hellen Rand automatisch beschneiden, WebP speichern.
 * Ziel: nur die tatsächliche Grundriss-Silhouette ohne Katalog-Rand/Weißraum.
 */
import { PNG } from 'pngjs'
import jpegDecodeWasm from '@jsquash/jpeg/decode'
import { decode as decodeJpegJs } from 'jpeg-js'
import webpDecode from '@jsquash/webp/decode'
import webpEncode from '@jsquash/webp/encode'

const MAX_EDGE = 1600
const WEBP_QUALITY = 88
/** Pixel gilt als „Hintergrund“, wenn fast weiß/transparent */
const BG_LUMA_MIN = 245
const BG_ALPHA_MAX = 16
/** Zusätzlicher Innenabstand nach Bounding-Box (px), damit Linien nicht abschneiden */
const CROP_PAD = 4

export type GrundrissProcessResult =
  | {
      ok: true
      data: Uint8Array
      mime: 'image/webp'
      cropped: boolean
      crop: { left: number; top: number; right: number; bottom: number; srcW: number; srcH: number }
    }
  | { ok: false; reason: string }

function detectKind(buf: Uint8Array, mimeHint?: string): 'jpeg' | 'png' | 'webp' | null {
  if (buf.byteLength >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (
    buf.byteLength >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'png'
  }
  if (
    buf.byteLength >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp'
  }
  const m = (mimeHint || '').toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpeg'
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  return null
}

async function decodeJpegToRgba(
  input: Uint8Array
): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> {
  try {
    const copy = new Uint8Array(input.byteLength)
    copy.set(input)
    const ab = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength)
    const img = await jpegDecodeWasm(ab)
    return { rgba: new Uint8ClampedArray(img.data), w: img.width, h: img.height }
  } catch {
    const decoded = decodeJpegJs(input, { useTArray: true })
    return {
      rgba: new Uint8ClampedArray(decoded.data),
      w: decoded.width,
      h: decoded.height,
    }
  }
}

async function decodeToRgba(
  input: Uint8Array,
  mimeHint?: string
): Promise<{ rgba: Uint8ClampedArray; w: number; h: number } | null> {
  const kind = detectKind(input, mimeHint)
  if (!kind) return null
  if (kind === 'jpeg') return decodeJpegToRgba(input)
  if (kind === 'png') {
    const png = PNG.sync.read(Buffer.from(input))
    return { rgba: new Uint8ClampedArray(png.data), w: png.width, h: png.height }
  }
  const webpCopy = new Uint8Array(input.byteLength)
  webpCopy.set(input)
  const ab = webpCopy.buffer.slice(webpCopy.byteOffset, webpCopy.byteOffset + webpCopy.byteLength)
  const img = await webpDecode(ab)
  return { rgba: new Uint8ClampedArray(img.data), w: img.width, h: img.height }
}

function isBackground(r: number, g: number, b: number, a: number): boolean {
  if (a <= BG_ALPHA_MAX) return true
  // Helligkeit + geringe Sättigung (weiße/graue Katalogränder)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  return luma >= BG_LUMA_MIN && max - min <= 18
}

/** Bounding-Box des nicht-weißen Inhalts (Grundriss-Linien/Flächen). */
export function findContentBounds(
  rgba: Uint8ClampedArray,
  w: number,
  h: number
): { left: number; top: number; right: number; bottom: number } | null {
  let left = w
  let top = h
  let right = -1
  let bottom = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = rgba[i]!
      const g = rgba[i + 1]!
      const b = rgba[i + 2]!
      const a = rgba[i + 3]!
      if (isBackground(r, g, b, a)) continue
      if (x < left) left = x
      if (y < top) top = y
      if (x > right) right = x
      if (y > bottom) bottom = y
    }
  }
  if (right < left || bottom < top) return null
  return { left, top, right, bottom }
}

function cropRgba(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  box: { left: number; top: number; right: number; bottom: number }
): { rgba: Uint8ClampedArray; w: number; h: number } {
  const left = Math.max(0, box.left - CROP_PAD)
  const top = Math.max(0, box.top - CROP_PAD)
  const right = Math.min(w - 1, box.right + CROP_PAD)
  const bottom = Math.min(h - 1, box.bottom + CROP_PAD)
  const nw = right - left + 1
  const nh = bottom - top + 1
  const out = new Uint8ClampedArray(nw * nh * 4)
  for (let y = 0; y < nh; y++) {
    const srcRow = ((top + y) * w + left) * 4
    const dstRow = y * nw * 4
    out.set(rgba.subarray(srcRow, srcRow + nw * 4), dstRow)
  }
  return { rgba: out, w: nw, h: nh }
}

function bilinearResize(
  src: Uint8ClampedArray,
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

function makeImageData(rgba: Uint8ClampedArray, width: number, height: number): ImageData {
  const copy = new Uint8ClampedArray(rgba.length)
  copy.set(rgba)
  const ID = (globalThis as unknown as { ImageData?: typeof ImageData }).ImageData
  if (typeof ID === 'function') return new ID(copy, width, height)
  return { data: copy, width, height } as ImageData
}

/**
 * Grundriss verarbeiten: Rand abschneiden (wenn sinnvoll), auf max. Kante skalieren, WebP.
 */
export async function processGrundrissImage(
  input: Uint8Array,
  mimeHint?: string
): Promise<GrundrissProcessResult> {
  try {
    const decoded = await decodeToRgba(input, mimeHint)
    if (!decoded) {
      return { ok: false, reason: 'Unbekanntes Bildformat' }
    }
    const { rgba, w: srcW, h: srcH } = decoded
    if (srcW < 8 || srcH < 8) {
      return { ok: false, reason: 'Bild zu klein' }
    }

    const bounds = findContentBounds(rgba, srcW, srcH)
    let work = { rgba, w: srcW, h: srcH }
    let cropped = false
    let cropMeta = { left: 0, top: 0, right: srcW - 1, bottom: srcH - 1, srcW, srcH }

    if (bounds) {
      const contentW = bounds.right - bounds.left + 1
      const contentH = bounds.bottom - bounds.top + 1
      const areaRatio = (contentW * contentH) / (srcW * srcH)
      // Nur croppen, wenn spürbarer Rand (Inhalt < ~92 % der Fläche)
      if (areaRatio < 0.92) {
        work = cropRgba(rgba, srcW, srcH, bounds)
        cropped = true
        cropMeta = { ...bounds, srcW, srcH }
      }
    }

    let { rgba: pixels, w: tw, h: th } = work
    const maxEdge = Math.max(tw, th)
    if (maxEdge > MAX_EDGE) {
      const s = MAX_EDGE / maxEdge
      const nw = Math.max(1, Math.round(tw * s))
      const nh = Math.max(1, Math.round(th * s))
      pixels = bilinearResize(pixels, tw, th, nw, nh)
      tw = nw
      th = nh
    }

    const ab = await webpEncode(makeImageData(pixels, tw, th), { quality: WEBP_QUALITY })
    return {
      ok: true,
      data: new Uint8Array(ab),
      mime: 'image/webp',
      cropped,
      crop: cropMeta,
    }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}
