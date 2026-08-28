/**
 * Inhaltliche Verwandtschaft für Entweder-oder-Vorschläge.
 * Anti-Korrelation auf Packlisten reicht nicht: Teppich und Gasflasche
 * stehen selten zusammen, ersetzen sich aber nicht.
 */

const STOP = new Set([
  'fuer',
  'und',
  'oder',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'ein',
  'eine',
  'mit',
  'vom',
  'von',
  'aufbl',
  'aufblasbar',
  'aufblasbare',
  'aufblasbaren',
  'set',
  'pro',
  'mini',
  'max',
  'classic',
  'pack',
  'er',
  'kg',
  'liter',
])

/**
 * Enge Ersatz-Familien (gleiche Funktion), keine Oberbegriffe wie „Licht“ oder „Getränk“.
 * Stämme nach Normalisierung (ohne Umlaute, ß→ss).
 */
const SUBSTITUTE_FAMILIES: string[][] = [
  [
    'relaxsessel',
    'relaxstuhl',
    'sessel',
    'sofa',
    'campingsessel',
    'klappstuhl',
    'campingstuhl',
    'stuhl',
    'hocker',
    'liegestuhl',
    'liege',
  ],
  ['kuehlbox', 'kuhlbox', 'kuehlschrank', 'kuhlschrank', 'kompressorkuehlbox', 'kompressorkuhlbox'],
  ['isomatte', 'luftmatratze', 'luftbett', 'matratze', 'klappbett', 'feldbett'],
  ['sonnensegel', 'sonnenschirm', 'pavillon', 'markise'],
  ['teppich', 'vorzeltteppich', 'groundcover', 'bodenplane', 'vorzeltboden'],
  ['gaskocher', 'benzinokocher', 'spirituskocher', 'kartuschenkocher', 'campingkocher'],
  ['powerstation', 'aggregat', 'generator', 'notstromaggregat'],
  ['campingtoilette', 'cassettentoilette', 'chemietoilette'],
  ['zwischenstecker', 'mehrfachstecker', 'adapterstecker'],
]

export function normalizeXorName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function xorContentTokens(name: string): string[] {
  return normalizeXorName(name)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t))
}

function compact(name: string): string {
  return normalizeXorName(name).replace(/ /g, '')
}

function namesShareContentToken(a: string, b: string): boolean {
  const ta = xorContentTokens(a)
  const tb = xorContentTokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const setB = new Set(tb)
  for (const t of ta) {
    if (t.length >= 4 && setB.has(t)) return true
  }
  const ca = compact(a)
  const cb = compact(b)
  for (const t of ta) {
    if (t.length >= 5 && cb.includes(t) && ca !== cb) return true
  }
  for (const t of tb) {
    if (t.length >= 5 && ca.includes(t) && ca !== cb) return true
  }
  return false
}

function nameHitsFamily(name: string, family: string[]): boolean {
  const h = compact(name)
  return family.some((stem) => h.includes(stem))
}

export function namesShareSubstituteFamily(a: string, b: string): boolean {
  return SUBSTITUTE_FAMILIES.some((family) => nameHitsFamily(a, family) && nameHitsFamily(b, family))
}

export type XorRelatednessInput = {
  was: string
  tags?: string[]
}

/**
 * Hartfilter: erkennbarer Ersatz-Zusammenhang, nicht nur dieselbe Kategorie.
 * Gemeinsame Tags allein reichen nicht (zu grob, z. B. „Getränke“).
 */
export function xorItemsRelated(a: XorRelatednessInput, b: XorRelatednessInput): boolean {
  if (namesShareContentToken(a.was, b.was)) return true
  if (namesShareSubstituteFamily(a.was, b.was)) return true
  return false
}

/** Eine Option (ggf. mehrere Teile) ist verwandt mit der anderen, wenn mind. ein Paar passt. */
export function xorOptionsRelated(
  left: XorRelatednessInput[],
  right: XorRelatednessInput[]
): boolean {
  for (const a of left) {
    for (const b of right) {
      if (xorItemsRelated(a, b)) return true
    }
  }
  return false
}

function namesFromOption(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const rec = raw as { names?: unknown }
  return Array.isArray(rec.names) ? rec.names.map(String).filter((n) => n.trim()) : []
}

/** Für bereits gespeicherte Inbox-Karten: unpassende XOR-Vorschläge ausblenden. */
export function xorSuggestionContentRelated(
  payload: Record<string, unknown>,
  titel?: string
): boolean {
  const rawOptions = payload.options
  if (Array.isArray(rawOptions) && rawOptions.length >= 2) {
    const left = namesFromOption(rawOptions[0]).map((was) => ({ was }))
    const right = namesFromOption(rawOptions[1]).map((was) => ({ was }))
    if (left.length > 0 && right.length > 0) return xorOptionsRelated(left, right)
  }
  const names = Array.isArray(payload.names) ? payload.names.map(String) : []
  if (names.length >= 2) {
    return xorItemsRelated({ was: names[0] ?? '' }, { was: names[1] ?? '' })
  }
  const m = String(titel ?? '').match(/^Entweder (.+) oder (.+)$/i)
  if (m?.[1] && m[2]) {
    return xorItemsRelated({ was: m[1] }, { was: m[2] })
  }
  return false
}
