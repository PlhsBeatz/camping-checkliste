/**
 * Campingplatz-Fotos: serverseitig auf WebP (lange Kante max. 1600 px, Qualität 85) optimieren.
 * Läuft ohne native Bindings (jpeg-js, pngjs, @jsquash/webp) — kompatibel mit Cloudflare Workers.
 */
import { decode as decodeJpeg } from 'jpeg-js'
import { PNG } from 'pngjs'
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
  const m = (mimeHint || '').toLowerCase()
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpeg'
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
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
  return null
}

function toClampRgba(data: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  if (data instanceof Uint8ClampedArray && data.byteLength === w * h * 4) return data
  return new Uint8ClampedArray(data.buffer, data.byteOffset, w * h * 4)
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
 * @returns `null`, wenn keine sinnvolle Optimierung möglich ist — Aufrufer speichert dann die Originalbytes.
 */
export async function optimizeCampingPhotoToWebp(
  input: Uint8Array,
  mimeHint?: string,
  opts?: { maxEdge?: number; webpQuality?: number }
): Promise<{ data: Uint8Array } | null> {
  const kind = detectKind(input, mimeHint)
  if (!kind) return null

  const maxEdge = opts?.maxEdge ?? MAX_EDGE
  const webpQuality = opts?.webpQuality ?? WEBP_QUALITY

  let rgba: Uint8ClampedArray
  let sw: number
  let sh: number

  try {
    if (kind === 'jpeg') {
      const raw = decodeJpeg(input, {
        useTArray: true,
        formatAsRGBA: true,
      })
      sw = raw.width
      sh = raw.height
      rgba = toClampRgba(raw.data, sw, sh)
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
  } catch {
    return null
  }

  if (sw < 1 || sh < 1) return null

  const { w: tw, h: th } = containSize(sw, sh, maxEdge)
  let pixels = rgba
  if (tw !== sw || th !== sh) {
    pixels = bilinearResize(rgba, sw, sh, tw, th)
  }

  const ab = await webpEncode(makeImageData(pixels, tw, th), { quality: webpQuality })
  return { data: new Uint8Array(ab) }
}

export const CAMPING_PHOTO_MAX_EDGE = MAX_EDGE
export const CAMPING_PHOTO_WEBP_QUALITY = WEBP_QUALITY
