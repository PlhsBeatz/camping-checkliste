/**
 * Grundriss-Bilder: Dekodieren, weißen/hellen Rand beschneiden, WebP speichern.
 * Cloudflare-Workers-tauglich (pngjs / @jsquash / jpeg-js) – analog camping-photo-optimize.
 */
import { Buffer } from 'node:buffer'
import { PNG } from 'pngjs'
import jpegDecodeWasm from '@jsquash/jpeg/decode'
import { decode as decodeJpegJs } from 'jpeg-js'
import webpDecode from '@jsquash/webp/decode'
import webpEncode from '@jsquash/webp/encode'
import { optimizeCampingPhotoToWebp } from '@/lib/camping-photo-optimize'

const MAX_EDGE = 1600
const WEBP_QUALITY = 88
/** Pixel gilt als „Hintergrund“, wenn fast weiß/transparent */
const BG_LUMA_MIN = 245
const BG_ALPHA_MAX = 16
/** Zusätzlicher Innenabstand nach Bounding-Box (px) */
const CROP_PAD = 4
/** Ab dieser Megapixelzahl nach Decode nur noch skalieren (kein teurer Crop-Scan) */
const MAX_CROP_MEGAPIXELS = 6

export type GrundrissProcessResult =
  | {
      ok: true
      data: Uint8Array
      mime: 'image/webp' | 'image/jpeg' | 'image/png'
      cropped: boolean
      /** true = unverändert durchgereicht (z. B. WebP ohne WASM im Worker) */
      passthrough?: boolean
      crop: { left: number; top: number; right: number; bottom: number; srcW: number; srcH: number }
    }
  | { ok: false; reason: string }

function mimeForKind(kind: 'jpeg' | 'png' | 'webp'): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (kind === 'png') return 'image/png'
  if (kind === 'webp') return 'image/webp'
  return 'image/jpeg'
}

/** Wenn Decode/Encode (WASM) scheitert: Original als Erfolg durchreichen. */
function passthroughOriginal(
  input: Uint8Array,
  mimeHint?: string
): Extract<GrundrissProcessResult, { ok: true }> | null {
  const kind = detectKind(input, mimeHint)
  if (!kind) return null
  return {
    ok: true,
    data: input,
    mime: mimeForKind(kind),
    cropped: false,
    passthrough: true,
    crop: { left: 0, top: 0, right: 0, bottom: 0, srcW: 0, srcH: 0 },
  }
}

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

/** MozJPEG-WASM scheitert oft im Worker-Bundle → jpeg-js mit RGBA. */
async function decodeJpegToRgba(
  input: Uint8Array
): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> {
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
      rgba: new Uint8ClampedArray(img.data),
      w: img.width,
      h: img.height,
    }
  } catch (e) {
    wasmErr = e
  }
  try {
    const raw = decodeJpegJs(input, {
      useTArray: true,
      formatAsRGBA: true,
    })
    return {
      rgba: new Uint8ClampedArray(raw.data),
      w: raw.width,
      h: raw.height,
    }
  } catch (jsErr) {
    const w = wasmErr instanceof Error ? wasmErr.message : String(wasmErr)
    const j = jsErr instanceof Error ? jsErr.message : String(jsErr)
    throw new Error(`JPEG-Dekodierung: WASM („${w}“); Fallback jpeg-js („${j}“).`)
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
  // WebP-WASM fehlt im Worker oft komplett → Caller macht Passthrough
  try {
    const webpCopy = new Uint8Array(input.byteLength)
    webpCopy.set(input)
    const ab = webpCopy.buffer.slice(
      webpCopy.byteOffset,
      webpCopy.byteOffset + webpCopy.byteLength
    ) as ArrayBuffer
    const img = await webpDecode(ab)
    return { rgba: new Uint8ClampedArray(img.data), w: img.width, h: img.height }
  } catch {
    return null
  }
}

function isBackground(r: number, g: number, b: number, a: number): boolean {
  if (a <= BG_ALPHA_MAX) return true
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  return luma >= BG_LUMA_MIN && max - min <= 18
}

/** Bounding-Box des nicht-weißen Inhalts. */
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
 * Grundriss verarbeiten: zuerst skalieren (CPU), dann Rand abschneiden, WebP.
 * Bei Fehlern im Crop-Pfad: Fallback über die bewährte Campingfoto-Optimierung (ohne Crop).
 */
export async function processGrundrissImage(
  input: Uint8Array,
  mimeHint?: string
): Promise<GrundrissProcessResult> {
  const kind = detectKind(input, mimeHint)

  try {
    const decoded = await decodeToRgba(input, mimeHint)
    if (!decoded) {
      // WebP/JPEG-WASM oft ohne Binary im Worker – Original behalten statt Fehlerflut
      const pass = passthroughOriginal(input, mimeHint)
      if (pass) return pass
      const fallback = await optimizeCampingPhotoToWebp(input, mimeHint)
      if (fallback.ok) {
        return {
          ok: true,
          data: fallback.data,
          mime: 'image/webp',
          cropped: false,
          crop: { left: 0, top: 0, right: 0, bottom: 0, srcW: 0, srcH: 0 },
        }
      }
      return { ok: false, reason: `Unbekanntes Bildformat (${fallback.reason})` }
    }

    const { rgba: srcRgba, w: srcW, h: srcH } = decoded
    if (srcW < 8 || srcH < 8) {
      return { ok: false, reason: 'Bild zu klein' }
    }

    // Zuerst skalieren – Crop auf kleinerem Raster spart Worker-CPU
    let workRgba = srcRgba
    let tw = srcW
    let th = srcH
    const maxEdge = Math.max(tw, th)
    if (maxEdge > MAX_EDGE) {
      const s = MAX_EDGE / maxEdge
      const nw = Math.max(1, Math.round(tw * s))
      const nh = Math.max(1, Math.round(th * s))
      workRgba = bilinearResize(workRgba, tw, th, nw, nh)
      tw = nw
      th = nh
    }

    let cropped = false
    let cropMeta = { left: 0, top: 0, right: tw - 1, bottom: th - 1, srcW, srcH }
    const megapixels = (tw * th) / 1_000_000
    if (megapixels <= MAX_CROP_MEGAPIXELS) {
      const bounds = findContentBounds(workRgba, tw, th)
      if (bounds) {
        const contentW = bounds.right - bounds.left + 1
        const contentH = bounds.bottom - bounds.top + 1
        const areaRatio = (contentW * contentH) / (tw * th)
        if (areaRatio < 0.92) {
          const croppedImg = cropRgba(workRgba, tw, th, bounds)
          workRgba = croppedImg.rgba
          tw = croppedImg.w
          th = croppedImg.h
          cropped = true
          cropMeta = { ...bounds, srcW, srcH }
        }
      }
    }

    const expected = tw * th * 4
    if (workRgba.length < expected) {
      throw new Error(
        `RGBA-Puffer zu kurz (${workRgba.length} < ${expected}) – vermutlich RGB statt RGBA`
      )
    }

    try {
      const ab = await webpEncode(makeImageData(workRgba, tw, th), { quality: WEBP_QUALITY })
      return {
        ok: true,
        data: new Uint8Array(ab),
        mime: 'image/webp',
        cropped,
        crop: cropMeta,
      }
    } catch {
      // Encode-WASM fehlt: wenn schon WebP und kein Crop nötig → Original
      if (kind === 'webp' && !cropped) {
        const pass = passthroughOriginal(input, mimeHint)
        if (pass) return pass
      }
      // PNG als verlustfreier Fallback nach Crop/Skalierung
      const png = new PNG({ width: tw, height: th })
      png.data = Buffer.from(workRgba)
      const pngBuf = PNG.sync.write(png)
      return {
        ok: true,
        data: new Uint8Array(pngBuf),
        mime: 'image/png',
        cropped,
        crop: cropMeta,
      }
    }
  } catch (e) {
    try {
      const fallback = await optimizeCampingPhotoToWebp(input, mimeHint)
      if (fallback.ok) {
        return {
          ok: true,
          data: fallback.data,
          mime: 'image/webp',
          cropped: false,
          crop: { left: 0, top: 0, right: 0, bottom: 0, srcW: 0, srcH: 0 },
        }
      }
    } catch {
      /* ignore */
    }
    const pass = passthroughOriginal(input, mimeHint)
    if (pass) return pass
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, reason: msg }
  }
}
