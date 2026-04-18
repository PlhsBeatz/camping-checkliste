/**
 * Dynamische Mengenregeln für Packlisten-Einträge
 *
 * Dieses Modul liefert die Typen und Berechnungen, um für einen Ausrüstungs-
 * gegenstand abhängig von Reisedauer und Mitreisenden-Typ (Erwachsener / Kind)
 * die beim Generieren zu verwendende Anzahl abzuleiten.
 *
 * Kompatibilität:
 * - Gegenstände ohne `mengenregel` fallen auf `standard_anzahl` zurück.
 * - Die berechnete Zahl wird EINMALIG beim Generieren gespeichert (keine
 *   dauerhafte Bindung der Packliste an die Regel).
 */

export type MengenRegelTyp =
  | 'fest'
  | 'pro_tag'
  | 'pro_n_tage'
  | 'pro_woche'
  | 'schwellwert'

export interface MengenRegelFest {
  typ: 'fest'
  anzahl: number
  kind?: { anzahl: number }
}

export interface MengenRegelProTag {
  typ: 'pro_tag'
  /** Stück pro Reisetag (darf auch z.B. 0.5 sein, wird aufgerundet) */
  proTag: number
  /** Zusätzlicher Puffer, der additiv dazukommt */
  reserve: number
  /** Obergrenze der Gesamtzahl (optional, z.B. weil dann gewaschen wird) */
  max?: number
  /** Nur die abweichenden Felder für Kinder setzen */
  kind?: Partial<{ proTag: number; reserve: number; max: number }>
}

export interface MengenRegelProNTage {
  typ: 'pro_n_tage'
  /** 1 Stück pro angefangene N Tage */
  n: number
  /** Obergrenze der Gesamtzahl (optional) */
  max?: number
  kind?: Partial<{ n: number; max: number }>
}

export interface MengenRegelProWoche {
  typ: 'pro_woche'
  /** Stück pro angefangene Woche */
  proWoche: number
  max?: number
  kind?: Partial<{ proWoche: number; max: number }>
}

export interface SchwellwertStufe {
  /** Ab dieser Reisedauer (in Tagen, inklusive) gilt `menge` */
  abTage: number
  menge: number
}

export interface MengenRegelSchwellwert {
  typ: 'schwellwert'
  /** Stufen; die höchste passende Stufe gewinnt */
  stufen: SchwellwertStufe[]
  kind?: { stufen: SchwellwertStufe[] }
}

export type MengenRegel =
  | MengenRegelFest
  | MengenRegelProTag
  | MengenRegelProNTage
  | MengenRegelProWoche
  | MengenRegelSchwellwert

export const MENGEN_REGEL_TYPEN: MengenRegelTyp[] = [
  'fest',
  'pro_tag',
  'pro_n_tage',
  'pro_woche',
  'schwellwert',
]

/**
 * Tage eines Urlaubs bestimmen (Anreise- und Abreisetag zählen mit).
 *
 * - `abfahrtdatum` geht vor `startdatum`, falls vorhanden (real gepackter Tag).
 * - Bei fehlendem/ungültigem Enddatum → 1 Tag.
 * - Mindestwert 1, damit Regeln sinnvoll greifen.
 */
export function berechneReiseTage(vacation: {
  startdatum: string
  abfahrtdatum?: string | null
  enddatum?: string | null
}): number {
  const startStr = vacation.abfahrtdatum?.trim() || vacation.startdatum
  const endStr = vacation.enddatum?.trim() || vacation.startdatum
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1
  const MS_PER_DAY = 86_400_000
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
  return Math.max(1, diffDays)
}

/**
 * Ist ein Mitreisender als Kind zu behandeln?
 *
 * Ableitung aus `user_role`: Wer als `kind` am User-Account hinterlegt ist,
 * gilt als Kind. Alle anderen (admin, gast, kein Account) → Erwachsener.
 */
export function istKind(mitreisender: {
  user_role?: 'admin' | 'kind' | 'gast' | null
}): boolean {
  return mitreisender.user_role === 'kind'
}

function clampMax(value: number, max?: number): number {
  if (max === undefined || max === null) return value
  return Math.min(value, max)
}

/**
 * Berechnet die Anzahl für einen Gegenstand anhand einer Regel.
 *
 * @param regel Regel aus den Stammdaten (null → Fallback nötig beim Aufrufer)
 * @param reiseTage Urlaubsdauer in Tagen (inkl. Anreise/Abreise)
 * @param kind true, wenn die Berechnung für ein Kind erfolgt (greift nur,
 *             wenn die Regel einen `kind`-Override hat)
 */
export function berechneAnzahl(
  regel: MengenRegel | null | undefined,
  reiseTage: number,
  kind: boolean,
): number {
  if (!regel) return 0
  const tage = Math.max(1, Math.floor(reiseTage))

  switch (regel.typ) {
    case 'fest': {
      if (kind && regel.kind?.anzahl !== undefined) return Math.max(0, regel.kind.anzahl)
      return Math.max(0, regel.anzahl)
    }
    case 'pro_tag': {
      const proTag = kind ? regel.kind?.proTag ?? regel.proTag : regel.proTag
      const reserve = kind ? regel.kind?.reserve ?? regel.reserve : regel.reserve
      const max = kind ? regel.kind?.max ?? regel.max : regel.max
      const raw = Math.ceil(tage * proTag) + reserve
      return clampMax(Math.max(0, raw), max)
    }
    case 'pro_n_tage': {
      const n = kind ? regel.kind?.n ?? regel.n : regel.n
      const max = kind ? regel.kind?.max ?? regel.max : regel.max
      if (!n || n <= 0) return 0
      const raw = Math.ceil(tage / n)
      return clampMax(Math.max(0, raw), max)
    }
    case 'pro_woche': {
      const proWoche = kind ? regel.kind?.proWoche ?? regel.proWoche : regel.proWoche
      const max = kind ? regel.kind?.max ?? regel.max : regel.max
      const raw = Math.ceil(tage / 7) * proWoche
      return clampMax(Math.max(0, raw), max)
    }
    case 'schwellwert': {
      const stufen = (kind && regel.kind?.stufen ? regel.kind.stufen : regel.stufen) || []
      let best = 0
      for (const s of stufen) {
        if (tage >= s.abTage && s.menge >= best) best = s.menge
      }
      // Falls keine Stufe ab 0 angegeben: sortiert den korrekten Wert finden
      if (stufen.length > 0) {
        const sorted = [...stufen].sort((a, b) => a.abTage - b.abTage)
        let current = 0
        for (const s of sorted) {
          if (tage >= s.abTage) current = s.menge
        }
        best = Math.max(best, current)
      }
      return Math.max(0, best)
    }
    default:
      return 0
  }
}

/**
 * Serialisiert eine Regel für die Datenbank (JSON-String oder null).
 */
export function serializeRegel(regel: MengenRegel | null | undefined): string | null {
  if (!regel) return null
  try {
    return JSON.stringify(regel)
  } catch {
    return null
  }
}

/**
 * Parst einen JSON-String aus der Datenbank zu einer Regel.
 * Liefert `null` bei ungültigem/leerem Input.
 */
export function parseRegel(raw: string | null | undefined): MengenRegel | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as MengenRegel
    if (!parsed || typeof parsed !== 'object') return null
    if (!MENGEN_REGEL_TYPEN.includes(parsed.typ)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Ableitung der „fallback"-Standardanzahl aus einer Regel für Stellen, die
 * keine Urlaubsdauer kennen (z.B. Gewichtsanzeige im Ausrüstungs-Katalog).
 *
 * Nimmt einen plausiblen Default (7 Tage) für variable Regeln und den festen
 * Wert bei `fest`.
 */
export function regelToStandardAnzahl(
  regel: MengenRegel | null | undefined,
  fallback: number = 1,
): number {
  if (!regel) return fallback
  if (regel.typ === 'fest') return Math.max(0, regel.anzahl)
  return Math.max(1, berechneAnzahl(regel, 7, false))
}

/**
 * Kurz-Label für die UI/Tooltips, die den Regeltyp menschenlesbar benennt.
 */
export function regelKurzLabel(regel: MengenRegel | null | undefined): string {
  if (!regel) return ''
  switch (regel.typ) {
    case 'fest':
      return `Fest: ${regel.anzahl}`
    case 'pro_tag':
      return `Pro Tag ${regel.proTag}${regel.reserve ? ` +${regel.reserve} Reserve` : ''}${
        regel.max !== undefined ? ` (max ${regel.max})` : ''
      }`
    case 'pro_n_tage':
      return `Alle ${regel.n} Tage 1${regel.max !== undefined ? ` (max ${regel.max})` : ''}`
    case 'pro_woche':
      return `Pro Woche ${regel.proWoche}${regel.max !== undefined ? ` (max ${regel.max})` : ''}`
    case 'schwellwert':
      return `Nach Reisedauer (${regel.stufen.length} Stufen)`
    default:
      return ''
  }
}
