/**
 * Flaggen-Emoji aus Ländernamen (übliche deutsche/englische Schreibweisen).
 * Unbekannte Namen → null (nur Text anzeigen).
 */

function regionalIndicatorPair(iso3166Alpha2: string): string {
  const cc = iso3166Alpha2.toUpperCase()
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return ''
  const base = 0x1f1e6 // Regional Indicator Symbol Letter A
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65)
}

/** Diakritika entfernen für Lookup (Österreich → osterreich) */
function landKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
}

/** ISO-3166-1 alpha-2, nur Kleinbuchstaben-Keys */
const LAND_NAME_TO_CC: Record<string, string> = {
  deutschland: 'DE',
  germany: 'DE',
  osterreich: 'AT',
  at: 'AT',
  austria: 'AT',
  schweiz: 'CH',
  switzerland: 'CH',
  italien: 'IT',
  italy: 'IT',
  frankreich: 'FR',
  france: 'FR',
  spanien: 'ES',
  spain: 'ES',
  portugal: 'PT',
  niederlande: 'NL',
  holland: 'NL',
  netherlands: 'NL',
  belgien: 'BE',
  belgium: 'BE',
  luxemburg: 'LU',
  luxembourg: 'LU',
  danemark: 'DK',
  denmark: 'DK',
  schweden: 'SE',
  sweden: 'SE',
  norwegen: 'NO',
  norway: 'NO',
  finnland: 'FI',
  finland: 'FI',
  island: 'IS',
  iceland: 'IS',
  irland: 'IE',
  ireland: 'IE',
  'vereinigtes konigreich': 'GB',
  grossbritannien: 'GB',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  polen: 'PL',
  poland: 'PL',
  tschechien: 'CZ',
  'tschechische republik': 'CZ',
  czechia: 'CZ',
  'czech republic': 'CZ',
  slowakei: 'SK',
  slovakia: 'SK',
  ungarn: 'HU',
  hungary: 'HU',
  rumanien: 'RO',
  romania: 'RO',
  bulgarien: 'BG',
  bulgaria: 'BG',
  griechenland: 'GR',
  greece: 'GR',
  zypern: 'CY',
  cyprus: 'CY',
  malta: 'MT',
  kroatien: 'HR',
  croatia: 'HR',
  slowenien: 'SI',
  slovenia: 'SI',
  serbien: 'RS',
  serbia: 'RS',
  'bosnien und herzegowina': 'BA',
  bosnien: 'BA',
  montenegro: 'ME',
  nordmazedonien: 'MK',
  mazedonien: 'MK',
  albanien: 'AL',
  albania: 'AL',
  kosovo: 'XK',
  turkei: 'TR',
  turkey: 'TR',
  tunesien: 'TN',
  tunisia: 'TN',
  marokko: 'MA',
  morocco: 'MA',
  agypten: 'EG',
  egypt: 'EG',
  israel: 'IL',
  jordanien: 'JO',
  jordan: 'JO',
  'vereinigte staaten': 'US',
  usa: 'US',
  'united states': 'US',
  kanada: 'CA',
  canada: 'CA',
  mexiko: 'MX',
  mexico: 'MX',
  brasilien: 'BR',
  brazil: 'BR',
  argentinien: 'AR',
  argentina: 'AR',
  chile: 'CL',
  neuseeland: 'NZ',
  'new zealand': 'NZ',
  australien: 'AU',
  australia: 'AU',
  sudafrika: 'ZA',
  'south africa': 'ZA',
  liechtenstein: 'LI',
  andorra: 'AD',
  monaco: 'MC',
  'san marino': 'SM',
  vatikan: 'VA',
  vatikanstadt: 'VA',
  lettland: 'LV',
  latvia: 'LV',
  litauen: 'LT',
  lithuania: 'LT',
  estland: 'EE',
  estonia: 'EE',
  ukraine: 'UA',
  weissrussland: 'BY',
  belarus: 'BY',
  moldawien: 'MD',
  moldova: 'MD',
  russland: 'RU',
  russia: 'RU',
}

export function countryFlagEmojiForLandName(landName: string): string | null {
  const cc = LAND_NAME_TO_CC[landKey(landName)]
  if (!cc) return null
  const emoji = regionalIndicatorPair(cc)
  return emoji || null
}
