/**
 * Gemeinsame Farbpalette für Mitreisende und Tags
 */

export const USER_COLORS = [
  { id: 'forest', label: 'Forest', bg: 'hsl(103, 45%, 21%)', fg: '#ffffff' },
  { id: 'fern', label: 'Fern', bg: 'hsl(103, 38%, 38%)', fg: '#ffffff' },
  { id: 'sage', label: 'Sage', bg: 'hsl(103, 30%, 55%)', fg: '#ffffff' },
  { id: 'teal', label: 'Teal', bg: 'hsl(180, 60%, 32%)', fg: '#ffffff' },
  { id: 'slate', label: 'Slate', bg: 'hsl(210, 25%, 38%)', fg: '#ffffff' },
  { id: 'denim', label: 'Denim', bg: 'hsl(220, 55%, 42%)', fg: '#ffffff' },
  { id: 'amber', label: 'Amber', bg: 'hsl(28, 80%, 52%)', fg: '#ffffff' },
  { id: 'sienna', label: 'Sienna', bg: 'hsl(15, 60%, 42%)', fg: '#ffffff' },
  { id: 'plum', label: 'Plum', bg: 'hsl(280, 35%, 38%)', fg: '#ffffff' },
  { id: 'crimson', label: 'Crimson', bg: 'hsl(348, 65%, 40%)', fg: '#ffffff' },
  { id: 'rose', label: 'Rose', bg: 'hsl(340, 55%, 52%)', fg: '#ffffff' },
  { id: 'coral', label: 'Coral', bg: 'hsl(12, 75%, 55%)', fg: '#ffffff' },
  { id: 'gold', label: 'Gold', bg: 'hsl(42, 80%, 45%)', fg: '#ffffff' },
  { id: 'olive', label: 'Olive', bg: 'hsl(68, 50%, 32%)', fg: '#ffffff' },
  { id: 'sky', label: 'Sky', bg: 'hsl(200, 70%, 40%)', fg: '#ffffff' },
  { id: 'violet', label: 'Violet', bg: 'hsl(265, 50%, 48%)', fg: '#ffffff' },
  { id: 'mauve', label: 'Mauve', bg: 'hsl(300, 30%, 42%)', fg: '#ffffff' },
  { id: 'graphite', label: 'Graphite', bg: 'hsl(210, 12%, 32%)', fg: '#ffffff' },
] as const

/** Standard-Hintergrundfarbe (erster Eintrag) */
export const DEFAULT_USER_COLOR_BG: string = USER_COLORS[0]!.bg

/**
 * Konvertiert HSL-String "hsl(h, s%, l%)" zu Hex #rrggbb (für input[type=color])
 */
function hslToHex(hsl: string): string {
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!m) return '#2d4a1a'
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Gibt für input[type=color] verwendbare Hex-Werte für alle Presets zurück */
export function getPresetHexValues(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of USER_COLORS) {
    out[c.bg] = hslToHex(c.bg)
  }
  return out
}

/** Prüft ob ein Wert einer Preset-Farbe entspricht */
export function isPresetColor(value: string | null | undefined): boolean {
  if (!value) return false
  return USER_COLORS.some((c) => c.bg === value)
}

function normalizeColorKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** CSS-Hintergrundfarbe für Mitreisenden-Avatar/Fortschrittsbalken */
export function resolveMitreisenderColor(value: string | null | undefined): string {
  if (!value) return DEFAULT_USER_COLOR_BG
  const trimmed = normalizeColorKey(value)
  if (trimmed.startsWith('#')) return trimmed
  if (trimmed.startsWith('rgb')) return trimmed
  if (trimmed.startsWith('hsl')) return trimmed
  const byBg = USER_COLORS.find((c) => normalizeColorKey(c.bg) === trimmed)
  if (byBg) return byBg.bg
  const byId = USER_COLORS.find(
    (c) => c.id === trimmed || c.id === trimmed.toLowerCase()
  )
  if (byId) return byId.bg
  const byLabel = USER_COLORS.find(
    (c) => c.label.toLowerCase() === trimmed.toLowerCase()
  )
  if (byLabel) return byLabel.bg
  return trimmed
}

/** Hintergrundfarbe inkl. Index-Fallback (wie Avatare in der Packprofil-Sidebar). */
export function getMitreisenderBackgroundColor(
  person: { farbe?: string | null } | null | undefined,
  index = 0
): string {
  if (person?.farbe) return resolveMitreisenderColor(person.farbe)
  return USER_COLORS[((index % USER_COLORS.length) + USER_COLORS.length) % USER_COLORS.length]!.bg
}

export function getMitreisenderForegroundColor(backgroundColor: string): string {
  const preset = USER_COLORS.find(
    (c) => normalizeColorKey(c.bg) === normalizeColorKey(backgroundColor)
  )
  return preset?.fg ?? '#ffffff'
}

export function getMitreisenderAvatarStyle(
  person: { farbe?: string | null } | null | undefined,
  index = 0
): { backgroundColor: string; color: string } {
  const backgroundColor = getMitreisenderBackgroundColor(person, index)
  return {
    backgroundColor,
    color: getMitreisenderForegroundColor(backgroundColor),
  }
}

/** Gibt Hex für Color-Input zurück: Preset → konvertiert, sonst unverändert (falls schon Hex) */
export function toColorInputValue(value: string | null | undefined): string {
  if (!value) return hslToHex(DEFAULT_USER_COLOR_BG)
  if (value.startsWith('#')) return value
  if (isPresetColor(value)) return hslToHex(value)
  return value
}
