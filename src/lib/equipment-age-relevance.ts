/**
 * Ob ein Anschaffungsdatum sinnvoll ist: dieselbe physische Sache, nicht ein Typ.
 *
 * Neu rechnen bei jedem Öffnen aus Name + aktuellen Kategorie-Titeln.
 * Keine Kategorie-IDs. Leere Datumsfelder sind kein „nein“.
 * Positiv bestätigt: gespeichertes Datum (dieser Eintrag oder sehr ähnlicher Name).
 * Negativ bestätigt: gesetztes Datum bewusst entfernt — nur in der aktuellen Bearbeitung.
 */

export type AgeRelevanceDecision = 'show' | 'hide' | 'unsure'

export type AgeRelevanceNeighbor = {
  was: string
  anschaffungsdatum?: string | null
}

export type AgeRelevanceInput = {
  name: string
  categoryTitle?: string | null
  mainCategoryTitle?: string | null
  /** Nur positiv bestätigtes Datum dieses Eintrags — nie „leer = nein“. */
  hasAcquisitionDate?: boolean
  neighbors?: AgeRelevanceNeighbor[]
}

export type AgeRelevanceResult = {
  decision: AgeRelevanceDecision
  /** -1 Verbrauch … +1 dauerhaft */
  score: number
  source: 'existing-date' | 'name' | 'category' | 'neighbor' | 'mixed' | 'none'
}

const TITLE_LOWER = [
  // Essen / Vorrat — nicht nur „Lebensmittel“
  'lebensmittel',
  'lebensmittelvorrat',
  'nahrung',
  'nahrungsmittel',
  'essen',
  'esswaren',
  'speisen',
  'vorrat',
  'vorrate',
  'vorraete',
  'vorratskammer',
  'speisekammer',
  'pantry',
  'proviant',
  'verpflegung',
  'rations',
  'dryfood',
  'trockenware',
  'getrank',
  'getraenk',
  'getranke',
  'getraenke',
  'drinks',
  'alkohol',
  'gewurz',
  'gewuerz',
  'gewurze',
  'gewuerze',
  'backzutaten',
  'konserven',
  'dosen',
  'tiefkuhl',
  'tiefkuehl',
  'snack',
  'snacks',
  'sussigkeit',
  'sussigkeiten',
  'suessigkeit',
  // Kleidung
  'klamotten',
  'kleidung',
  'kleider',
  'apparel',
  'wardrobe',
  'waesche',
  'wasche',
  'textilien',
  'bekleidung',
  'outdoorbekleidung',
  'regenkleidung',
  'schuhe',
  'schuhwerk',
  // Hygiene / Kosmetik-Verbrauch
  'kosmetik',
  'drogerie',
  'hygiene',
  'korperpflege',
  'koerperpflege',
  'pflegeprodukte',
  'badartikel',
  'duschzeug',
  'waschzeug',
  // Medizin-Verbrauch
  'apotheke',
  'reiseapotheke',
  'medikamente',
  'medizinbedarf',
  'verbandsmaterial',
  'erstehilfeverbrauch',
  // Verbrauch / Einweg / Chemie
  'verbrauch',
  'verbrauchsmaterial',
  'einweg',
  'disposables',
  'nachfull',
  'nachfuell',
  'refill',
  'sanitarchemie',
  'sanitaerchemie',
  'reinigung',
  'putzmittel',
  'waschmittel',
  'muell',
  'mull',
  'abfall',
] as const

const TITLE_RAISE = [
  'mobel',
  'moebel',
  'wohnmobel',
  'wohnmoebel',
  'sitzmobel',
  'sitzmoebel',
  'campingmobel',
  'campingmoebel',
  'stuhl',
  'tisch',
  'geschirr',
  'besteck',
  'kuchenausstattung',
  'kuechenausstattung',
  'kuchengerat',
  'kuechengeraet',
  'kochgeschirr',
  'elektro',
  'elektronik',
  'technik',
  'gadgets',
  'multimedia',
  'werkzeug',
  'werkstatt',
  'vorzelt',
  'campingzelt',
  'heizung',
  'klimaanlage',
  'lueftung',
  'luftung',
  'sicherheit',
  'warnmittel',
  'navigation',
  'outdoortechnik',
  'strom',
  'solar',
  'energie',
  'powerstation',
  'wassersystem',
  'sanitarausstattung',
  'sanitaerausstattung',
  'sport',
  'outdoor',
  'wassersport',
  'fahrrad',
  'dokumente',
  'deko',
  'kinderspielzeug',
  'spielzeug',
  'papierkram',
  'beleuchtung',
] as const

/** Allein kein Ja/Nein — Name oder Link entscheiden. */
const TITLE_UNSURE = [
  'grundausstattung',
  'camping',
  'campingausrustung',
  'campingausruestung',
  'wohnwagen',
  'wohnmobil',
  'reisemobil',
  'kuche',
  'kueche',
  'campkuche',
  'campkueche',
  'kochen',
  'bad',
  'wohnen',
  'organisation',
  'ordnung',
  'sonstiges',
  'divers',
  'various',
  'kinder',
  'baby',
  'familie',
  'haustier',
  'winter',
  'saison',
  'urlaub',
  'reise',
  'auto',
  'zugfahrzeug',
  'fahrzeug',
] as const

const NAME_CONSUMABLE = [
  // Kleidung
  'socken',
  'struempfe',
  'strumpfe',
  'unterwasche',
  'unterwaesche',
  'tshirt',
  'shirt',
  'shorts',
  'pullover',
  'mütze',
  'muetze',
  'handschuhe',
  'sandals',
  'sandalen',
  'crocs',
  'regenponcho',
  'regenjacke',
  // Essen / Trinken
  'mehl',
  'zucker',
  'nudeln',
  'pasta',
  'kaffeepulver',
  'kaffeebohnen',
  'kakao',
  'knackebrot',
  'knaeckebrot',
  'muesli',
  'musli',
  'haferflocken',
  'schokolade',
  'marmelade',
  'gewurz',
  'gewuerz',
  'pfeffer',
  'konserve',
  'konserven',
  'limo',
  // Hygiene
  'duschgel',
  'shampoo',
  'zahnpasta',
  'zahnbuerste',
  'zahnbürste',
  'deodorant',
  'sonnencreme',
  'aftersun',
  'feuchtucher',
  'feuchttuecher',
  'feuchttuch',
  'wattepad',
  'tampons',
  'windeln',
  // Medizin
  'pflaster',
  'tabletten',
  'ibuprofen',
  'paracetamol',
  'desinfektion',
  'verbandszeug',
  // Einweg / Verbrauch
  'muelltute',
  'muelltuten',
  'mulltute',
  'muellbeutel',
  'mullbeutel',
  'eiswuerfelbeutel',
  'eiswurfelbeutel',
  'zipbeutel',
  'gefrierbeutel',
  'kuchenrolle',
  'kuechenrolle',
  'toilettenpapier',
  'taschentuch',
  'taschentucher',
  'taschentuecher',
  'alufolie',
  'frischhaltefolie',
  'backpapier',
  'serviette',
  'mueckenspirale',
  'muckenspirale',
  'teelicht',
  'teelichter',
  'feuerzeug',
  'streichholz',
  'streichholzer',
  'streichhoelzer',
  'batterien',
  'knopfzelle',
  // Chemie
  'waschmittel',
  'weichspuler',
  'weichspueler',
  'spulmittel',
  'spuelmittel',
  'entkalker',
  'thetford',
  'sanichem',
  'toilettenzusatz',
  'impragnierspray',
  'impraegnierspray',
  // Energie-Portion
  'gaskartusche',
  'gaskartuschen',
  'stechkartusche',
  'lyogaskartusche',
  'filterkartusche',
  'ersatzfilter',
  'brennpaste',
] as const

/** Kurze Verbrauchswörter: nur als ganzes Token, nicht als Teil von Gerätenamen. */
const NAME_CONSUMABLE_EXACT = [
  'slip',
  'hose',
  'kleid',
  'jacke',
  'schal',
  'schuhe',
  'salz',
  'reis',
  'kaffee',
  'milch',
  'butter',
  'kase',
  'kaese',
  'brot',
  'nuesse',
  'nusse',
  'honig',
  'paprika',
  'dosen',
  'saft',
  'bier',
  'wein',
  'seife',
  'watte',
  'binden',
  'jod',
  'salbe',
  'tropfen',
  'kerze',
  'kerzen',
  'chlor',
  'spiritus',
  'tee',
  'ol',
  'oel',
  'essig',
] as const

const NAME_DURABLE = [
  // Möbel / Aufbau
  'stuhl',
  'stuehle',
  'stuhle',
  'tisch',
  'hocker',
  'liege',
  'markise',
  'vorzelt',
  'vorzeltteppich',
  'relaxsessel',
  'campingsessel',
  // Küche Gerät
  'kuhlbox',
  'kuehlbox',
  'kuhlschrank',
  'kuehlschrank',
  'kaffeemuhle',
  'kaffeemuehle',
  'kaffeemaschine',
  'espressomaschine',
  'wasserkocher',
  'toaster',
  'schneidbrett',
  'wasserfilter',
  'wassertank',
  'kanister',
  // Geschirr
  'teller',
  'schussel',
  'schuessel',
  'tasse',
  'becher',
  'weinglas',
  'trinkglas',
  'besteck',
  'messerblock',
  'schopfkelle',
  'schoepfkelle',
  // Technik
  'powerstation',
  'ladegerat',
  'ladegeraet',
  'wechselrichter',
  'solarpanel',
  'navigationsgerat',
  'navigationsgeraet',
  'lautsprecher',
  'taschenlampe',
  'laterne',
  'stirnlampe',
  // Werkzeug / Sicherheit
  'hammer',
  'zange',
  'schrauber',
  'feuerloscher',
  'feuerloescher',
  'warndreieck',
  'warnweste',
  'ersthelferkoffer',
  // Fahrzeug / Sanitär Gerät
  'gasflasche',
  'alugas',
  'stahlflasche',
  'gasgrill',
  'klimaanlage',
  'waescheklammer',
  'wascheklammer',
  'waeschestander',
  'waschestaender',
  'waescheständer',
  // Sport / Kinder
  'fahrrad',
  'kindersitz',
  'kajak',
  'spielzeugauto',
  'brettspiel',
  'fernglas',
] as const

const NAME_DURABLE_EXACT = [
  'zelt',
  'pfanne',
  'topf',
  'kanne',
  'mixer',
  'waage',
  'pumpe',
  'glas',
  'tablet',
  'laptop',
  'kamera',
  'drohne',
  'walkie',
  'radio',
  'heizung',
  'boiler',
  'cassette',
  'kassette',
  'deko',
  'paneel',
  'solar',
] as const

const SHOW_THRESHOLD = 0.4
const HIDE_THRESHOLD = -0.4
const CATEGORY_WEIGHT = 0.55
const NEIGHBOR_WEIGHT = 0.4

export function normalizeAgeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactAgeText(s: string): string {
  return normalizeAgeText(s).replace(/ /g, '')
}

function ageTokens(s: string): string[] {
  return normalizeAgeText(s)
    .split(' ')
    .filter((t) => t.length >= 2)
}

function longestMatch(compact: string, tokens: string[], stems: readonly string[]): string | null {
  let best: string | null = null
  for (const raw of stems) {
    const stem = normalizeAgeText(raw).replace(/ /g, '')
    if (stem.length < 3) continue
    if (stem.length >= 5) {
      if (!compact.includes(stem)) continue
    } else if (!tokens.includes(stem)) {
      continue
    }
    if (!best || stem.length > best.length) best = stem
  }
  return best
}

function titlePolarity(titles: string): 1 | -1 | 0 {
  const compact = compactAgeText(titles)
  const tokens = ageTokens(titles)
  if (!compact) return 0
  const lower = longestMatch(compact, tokens, TITLE_LOWER)
  const raise = longestMatch(compact, tokens, TITLE_RAISE)
  const unsure = longestMatch(compact, tokens, TITLE_UNSURE)
  if (lower && raise) {
    if (lower.length > raise.length) return -1
    if (raise.length > lower.length) return 1
    return 0
  }
  if (lower && unsure && unsure.length > lower.length) return 0
  if (raise && unsure && unsure.length > raise.length) return 0
  if (lower) return -1
  if (raise) return 1
  return 0
}

function namePolarity(name: string): 1 | -1 | 0 {
  const compact = compactAgeText(name)
  const tokens = ageTokens(name)
  if (!compact) return 0
  const durable = longestMatch(compact, tokens, [...NAME_DURABLE, ...NAME_DURABLE_EXACT])
  const consumable = longestMatch(compact, tokens, [...NAME_CONSUMABLE, ...NAME_CONSUMABLE_EXACT])
  if (durable && consumable) {
    if (durable.length > consumable.length) return 1
    if (consumable.length > durable.length) return -1
    return 0
  }
  if (durable) return 1
  if (consumable) return -1
  return 0
}

export function namesLookAlikeForAge(a: string, b: string): boolean {
  const ca = compactAgeText(a)
  const cb = compactAgeText(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  if (ca.length >= 5 && cb.length >= 5 && (ca.includes(cb) || cb.includes(ca))) return true
  const ta = ageTokens(a)
  const tb = ageTokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const setB = new Set(tb)
  let hit = 0
  for (const t of ta) if (setB.has(t)) hit++
  return hit / Math.max(ta.length, tb.length) >= 0.55
}

/** Nur Nachbarn mit gespeichertem Datum — leere Felder zählen nicht. */
export function confirmedAgeNeighbors(
  items: AgeRelevanceNeighbor[],
  excludeWas?: string
): AgeRelevanceNeighbor[] {
  return items.filter((item) => {
    if (!item.anschaffungsdatum) return false
    if (excludeWas && compactAgeText(item.was) === compactAgeText(excludeWas)) return false
    return true
  })
}

export function scoreAgeRelevance(input: AgeRelevanceInput): AgeRelevanceResult {
  if (input.hasAcquisitionDate) {
    return { decision: 'show', score: 1, source: 'existing-date' }
  }

  const nameScore = namePolarity(input.name)
  if (nameScore !== 0) {
    return {
      decision: nameScore > 0 ? 'show' : 'hide',
      score: nameScore,
      source: 'name',
    }
  }

  const titles = [input.categoryTitle, input.mainCategoryTitle].filter(Boolean).join(' ')
  const categoryScore = titlePolarity(titles) * CATEGORY_WEIGHT

  const confirmedNeighbors = (input.neighbors ?? []).filter((n) => n.anschaffungsdatum)
  const neighborHit = confirmedNeighbors.some((n) => namesLookAlikeForAge(input.name, n.was))
  const neighborScore = neighborHit ? NEIGHBOR_WEIGHT : 0

  const score = categoryScore + neighborScore
  if (score >= SHOW_THRESHOLD) {
    return {
      decision: 'show',
      score,
      source: neighborHit && categoryScore === 0 ? 'neighbor' : 'category',
    }
  }
  if (score <= HIDE_THRESHOLD) {
    return { decision: 'hide', score, source: 'category' }
  }
  if (categoryScore !== 0 && neighborScore !== 0) {
    return { decision: 'unsure', score, source: 'mixed' }
  }
  return { decision: 'unsure', score, source: 'none' }
}

export function shouldPrefillReplaceAcquisitionDate(input: AgeRelevanceInput): boolean {
  return scoreAgeRelevance({ ...input, hasAcquisitionDate: false }).decision === 'show'
}

export function shouldShowAcquisitionDateField(
  input: AgeRelevanceInput,
  revealed: boolean
): boolean {
  if (revealed || input.hasAcquisitionDate) return true
  return scoreAgeRelevance(input).decision === 'show'
}

/** Katalog-Angelegt nur, wenn ein Anschaffungsdatum sinnvoll wäre oder schon gesetzt ist. */
export function shouldShowAngelegtAm(input: AgeRelevanceInput): boolean {
  if (input.hasAcquisitionDate) return true
  return scoreAgeRelevance(input).decision === 'show'
}
