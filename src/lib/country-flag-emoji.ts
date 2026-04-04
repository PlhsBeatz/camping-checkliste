/**
 * Flaggen-Emoji aus Länderfeld: ISO-3166-1 alpha-2 (z. B. DE, AT) oder Ländername (de/en/…).
 */

function regionalIndicatorPair(iso3166Alpha2: string): string {
  const cc = iso3166Alpha2.toUpperCase()
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return ''
  const base = 0x1f1e6 // Regional Indicator Symbol Letter A
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65)
}

/** Nicht-ISO-Kürzel → ISO alpha-2 (z. B. EU-Handelsnotation) */
const ISO2_ALIASES: Record<string, string> = {
  uk: 'GB',
  el: 'GR', // Griechenland (EU)
}

function landKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
}

/** Normalisierter Ländername → ISO alpha-2 (Europa + häufige Nicht-EU) */
const LAND_NAME_TO_CC: Record<string, string> = {
  deutschland: 'DE',
  germany: 'DE',
  osterreich: 'AT',
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
  'die niederlande': 'NL',
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
  england: 'GB',
  schottland: 'GB',
  wales: 'GB',
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
  georgien: 'GE',
  georgia: 'GE',
  armenien: 'AM',
  armenia: 'AM',
  aserbaidschan: 'AZ',
  azerbaijan: 'AZ',
  kasachstan: 'KZ',
  kazakhstan: 'KZ',
  faroer: 'FO',
  faroe: 'FO',
  gronland: 'GL',
  greenland: 'GL',
  // Endonyme / weitere europäische Schreibweisen
  allemagne: 'DE',
  germania: 'DE',
  alemania: 'DE',
  autriche: 'AT',
  suisse: 'CH',
  svizzera: 'CH',
  espagne: 'ES',
  espana: 'ES',
  paysbas: 'NL',
  'pays-bas': 'NL',
  suede: 'SE',
  sverige: 'SE',
  norge: 'NO',
  suomi: 'FI',
  eesti: 'EE',
  eire: 'IE',
  'crna gora': 'ME',
  hrvatska: 'HR',
  srbija: 'RS',
  shqiperia: 'AL',
  hellas: 'GR',
  ellada: 'GR',
  magyarorszag: 'HU',
  cesko: 'CZ',
  slovensko: 'SK',
  polska: 'PL',
}

export function countryFlagEmojiForLandName(landName: string): string | null {
  const trimmed = landName.trim()
  if (!trimmed) return null

  // ISO-3166-1 alpha-2 (DE, DK, NL, …) — Hauptfall in der DB
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const lk = trimmed.toLowerCase()
    const cc = ISO2_ALIASES[lk] ?? lk.toUpperCase()
    const emoji = regionalIndicatorPair(cc)
    return emoji || null
  }

  const cc = LAND_NAME_TO_CC[landKey(trimmed)]
  if (!cc) return null
  const emoji = regionalIndicatorPair(cc)
  return emoji || null
}
