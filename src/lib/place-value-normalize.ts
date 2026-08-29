/**
 * Gleicht Google-/Website-Werte an die gespeicherte deutsche Schreibweise an
 * und filtert unplausible Änderungsvorschläge (z. B. Germany vs. Deutschland).
 */
import { countryIso2ForLandName } from '@/lib/country-flag-emoji'
import {
  PLACE_CHANGE_LABELS,
  normalizePlaceText,
  type PlaceChangeField,
  type PlaceFieldChange,
} from '@/lib/place-field-changes'

const CC_TO_DE: Record<string, string> = {
  DE: 'Deutschland',
  AT: 'Österreich',
  CH: 'Schweiz',
  IT: 'Italien',
  FR: 'Frankreich',
  ES: 'Spanien',
  PT: 'Portugal',
  NL: 'Niederlande',
  BE: 'Belgien',
  LU: 'Luxemburg',
  DK: 'Dänemark',
  SE: 'Schweden',
  NO: 'Norwegen',
  FI: 'Finnland',
  IS: 'Island',
  IE: 'Irland',
  GB: 'Vereinigtes Königreich',
  PL: 'Polen',
  CZ: 'Tschechien',
  SK: 'Slowakei',
  HU: 'Ungarn',
  RO: 'Rumänien',
  BG: 'Bulgarien',
  GR: 'Griechenland',
  CY: 'Zypern',
  MT: 'Malta',
  HR: 'Kroatien',
  SI: 'Slowenien',
  RS: 'Serbien',
  BA: 'Bosnien und Herzegowina',
  ME: 'Montenegro',
  MK: 'Nordmazedonien',
  AL: 'Albanien',
  XK: 'Kosovo',
  TR: 'Türkei',
  TN: 'Tunesien',
  MA: 'Marokko',
  EG: 'Ägypten',
  LI: 'Liechtenstein',
  AD: 'Andorra',
  MC: 'Monaco',
  SM: 'San Marino',
  VA: 'Vatikanstadt',
  LV: 'Lettland',
  LT: 'Litauen',
  EE: 'Estland',
  UA: 'Ukraine',
  US: 'USA',
  CA: 'Kanada',
}

/** Häufige englische Regionsnamen → deutsch (Campingländer). */
const REGION_TO_DE: Record<string, string> = {
  bavaria: 'Bayern',
  hesse: 'Hessen',
  'lower saxony': 'Niedersachsen',
  'north rhine-westphalia': 'Nordrhein-Westfalen',
  'north rhine westphalia': 'Nordrhein-Westfalen',
  'rhineland-palatinate': 'Rheinland-Pfalz',
  'rhineland palatinate': 'Rheinland-Pfalz',
  saxony: 'Sachsen',
  'saxony-anhalt': 'Sachsen-Anhalt',
  'saxony anhalt': 'Sachsen-Anhalt',
  'mecklenburg-western pomerania': 'Mecklenburg-Vorpommern',
  'mecklenburg western pomerania': 'Mecklenburg-Vorpommern',
  thuringia: 'Thüringen',
  'baden-wurttemberg': 'Baden-Württemberg',
  'baden-wuerttemberg': 'Baden-Württemberg',
  carinthia: 'Kärnten',
  styria: 'Steiermark',
  tyrol: 'Tirol',
  vienna: 'Wien',
  'upper austria': 'Oberösterreich',
  'lower austria': 'Niederösterreich',
  tuscany: 'Toskana',
  lombardy: 'Lombardei',
  sicily: 'Sizilien',
  sardinia: 'Sardinien',
  piedmont: 'Piemont',
  veneto: 'Venetien',
  catalonia: 'Katalonien',
  andalusia: 'Andalusien',
  valencia: 'Valencia',
  'south holland': 'Südholland',
  'north holland': 'Nordholland',
  'gelderland': 'Gelderland',
  'north brabant': 'Nordbrabant',
  'noord-brabant': 'Nordbrabant',
}

function foldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
}

export function germanLandName(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  const cc = countryIso2ForLandName(t)
  if (cc && CC_TO_DE[cc]) return CC_TO_DE[cc]
  return t
}

export function germanRegionName(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  return REGION_TO_DE[foldKey(t)] ?? t
}

const COUNTRY_SUFFIX_RE: RegExp = (() => {
  const names = new Set<string>()
  for (const [cc, de] of Object.entries(CC_TO_DE)) {
    names.add(cc)
    names.add(de)
  }
  for (const extra of [
    'Germany',
    'Italy',
    'Spain',
    'France',
    'Netherlands',
    'Austria',
    'Switzerland',
    'Denmark',
    'Sweden',
    'Norway',
    'Finland',
    'Poland',
    'Czechia',
    'Czech Republic',
    'Hungary',
    'Greece',
    'Croatia',
    'Slovenia',
    'Portugal',
    'Belgium',
    'Luxembourg',
    'Ireland',
    'United Kingdom',
    'Great Britain',
    'England',
    'Allemagne',
    'Italia',
    'España',
    'Espagne',
    'Pays-Bas',
    'Autriche',
    'Suisse',
    'Svizzera',
    'Germania',
    'Alemania',
  ]) {
    names.add(extra)
  }
  const escaped = [...names]
    .filter((n) => n.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`[,\\s]+(?:${escaped.join('|')})\\s*$`, 'i')
})()

/** Adresse ohne angehängtes Land – das steht im Feld Land. */
export function stripTrailingCountryFromAddress(raw: string | null | undefined): string {
  let s = decodeHtmlEntities(normalizePlaceText(raw))
  if (!s) return ''
  s = s.replace(COUNTRY_SUFFIX_RE, '').trim()
  return s.replace(/[.,;\s]+$/g, '').trim()
}

export function formatStoredAddress(raw: string | null | undefined): string | null {
  const s = stripTrailingCountryFromAddress(raw)
  return s || null
}

function websitesEquivalent(a: string, b: string): boolean {
  const norm = (raw: string) => {
    try {
      const u = new URL(raw.trim())
      const host = u.hostname.replace(/^www\./i, '').toLowerCase()
      const path = u.pathname.replace(/\/+$/, '')
      return `${host}${path}${u.search}`.toLowerCase()
    } catch {
      return raw.trim().replace(/\/+$/, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase()
    }
  }
  return norm(a) === norm(b)
}

const FULL_WEEKDAY =
  /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/i
const HAS_CLOCK = /\d{1,2}\s*[:.]\s*\d{2}|\d{1,2}\s*uhr\b/i
const NAV_NOISE =
  /stellenangebote|nachhaltigkeit|datenschutz|impressum|warenkorb|newsletter|prinzessinnen|wellness\s*&\s*more/i

/** Erkennt echte Öffnungszeiten vs. mitgescrapten Navigations-Text. */
export function looksLikeOpeningHours(raw: string | null | undefined): boolean {
  const t = decodeHtmlEntities(normalizePlaceText(raw))
  if (t.length < 6 || t.length > 2500) return false
  if (isImplausibleOpeningHours(t)) return false
  return HAS_CLOCK.test(t) || FULL_WEEKDAY.test(t)
}

/** Navigations- oder Menütext, der fälschlich als Öffnungszeiten landete. */
export function isImplausibleOpeningHours(raw: string | null | undefined): boolean {
  const t = decodeHtmlEntities(normalizePlaceText(raw))
  if (!t) return false
  return NAV_NOISE.test(t) && !HAS_CLOCK.test(t)
}

export function toGermanPlaceLabels(input: {
  adresse?: string | null
  land?: string | null
  bundesland?: string | null
}): { adresse: string | null; land: string | null; bundesland: string | null } {
  return {
    adresse: formatStoredAddress(input.adresse),
    land: germanLandName(input.land),
    bundesland: germanRegionName(input.bundesland),
  }
}

/** Beim Speichern: deutsche Ländernamen, Adresse ohne Land-Suffix, kein Nav-Text als Öffnungszeiten. */
export function sanitizeStoredPlaceFields(input: {
  land?: string
  bundesland?: string | null
  adresse?: string | null
  oeffnungszeiten?: string | null
}): {
  land?: string
  bundesland?: string | null
  adresse?: string | null
  oeffnungszeiten?: string | null
} {
  const labels = toGermanPlaceLabels({
    adresse: input.adresse,
    land: input.land,
    bundesland: input.bundesland,
  })
  let hours = input.oeffnungszeiten ?? null
  if (hours && isImplausibleOpeningHours(hours)) hours = null
  else if (hours) hours = decodeHtmlEntities(hours).trim()
  return {
    land: labels.land ?? input.land,
    bundesland: input.bundesland === undefined ? undefined : labels.bundesland,
    adresse: input.adresse === undefined ? undefined : labels.adresse,
    oeffnungszeiten: input.oeffnungszeiten === undefined ? undefined : hours,
  }
}

function sameFolded(a: string, b: string): boolean {
  return foldKey(a) === foldKey(b)
}

/**
 * Normalisiert den Vorschlag und verwirft kosmetische/unplausible Diffs.
 * Gibt null zurück, wenn kein sinnvoller Änderungsvorschlag bleibt.
 */
export function preparePlaceFieldChange(
  field: PlaceChangeField,
  previous: string | null | undefined,
  proposed: string | null | undefined
): PlaceFieldChange | null {
  const prevRaw = decodeHtmlEntities(normalizePlaceText(previous))
  let nextRaw = decodeHtmlEntities(normalizePlaceText(proposed))

  if (field === 'land') {
    const prevDe = germanLandName(prevRaw) ?? ''
    const nextDe = germanLandName(nextRaw) ?? ''
    if (!nextDe) return null
    const prevCc = countryIso2ForLandName(prevDe || prevRaw)
    const nextCc = countryIso2ForLandName(nextDe)
    if (prevCc && nextCc && prevCc === nextCc) return null
    if (sameFolded(prevDe || prevRaw, nextDe)) return null
    nextRaw = nextDe
  } else if (field === 'bundesland') {
    const prevDe = germanRegionName(prevRaw) ?? prevRaw
    const nextDe = germanRegionName(nextRaw) ?? nextRaw
    if (!nextDe) return null
    if (sameFolded(prevDe, nextDe)) return null
    nextRaw = nextDe
  } else if (field === 'adresse') {
    const prevAddr = stripTrailingCountryFromAddress(prevRaw)
    const nextAddr = stripTrailingCountryFromAddress(nextRaw)
    if (!nextAddr) return null
    if (sameFolded(prevAddr, nextAddr)) return null
    nextRaw = nextAddr
  } else if (field === 'webseite') {
    if (!nextRaw) return null
    if (prevRaw && websitesEquivalent(prevRaw, nextRaw)) return null
  } else if (field === 'oeffnungszeiten') {
    if (!nextRaw) {
      if (!prevRaw || !isImplausibleOpeningHours(prevRaw)) return null
      nextRaw = ''
    } else if (!looksLikeOpeningHours(nextRaw)) {
      return null
    }
  } else if (field === 'platzplan_url') {
    // 404: leere URL als Vorschlag ist plausibel
  } else if (!nextRaw) {
    return null
  }

  if (normalizePlaceText(prevRaw) === normalizePlaceText(nextRaw)) return null

  return {
    field,
    label: PLACE_CHANGE_LABELS[field],
    previous: prevRaw,
    proposed: nextRaw,
  }
}
