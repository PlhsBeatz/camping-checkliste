/** Icon-Keys (ohne Client-Import aus transport-icons) */
export type TransportIconKey =
  | 'car'
  | 'caravan'
  | 'van'
  | 'bus'
  | 'container'
  | 'package'
  | 'box'

/**
 * Hinweis Migration 0064: transportmittel.name bleibt UNIQUE.
 * Kein DROP/RECREATE der Tabelle – sonst setzt D1 transport_id-FKs (Ausrüstung etc.) auf NULL.
 */

/** Fahrzeugtypen laut Stammdaten / Migration 0064 */
export const FAHRZEUGTYPEN = [
  'auto',
  'wohnmobil',
  'kastenwagen',
  'wohnwagen',
  'faltcaravan',
  'anhaenger',
  'dachbox',
  'hecktraeger',
] as const

export type Fahrzeugtyp = (typeof FAHRZEUGTYPEN)[number]

export const FAHRZEUGTYP_LABELS: Record<Fahrzeugtyp, string> = {
  auto: 'Auto (Zugfahrzeug)',
  wohnmobil: 'Wohnmobil',
  kastenwagen: 'Kastenwagen',
  wohnwagen: 'Wohnwagen',
  faltcaravan: 'Faltcaravan',
  anhaenger: 'Anhänger',
  dachbox: 'Dachbox',
  hecktraeger: 'Heckträger',
}

export const ZUGFAEHIGE_TYPEN: readonly Fahrzeugtyp[] = ['auto', 'wohnmobil', 'kastenwagen']
export const GEZOGENE_TYPEN: readonly Fahrzeugtyp[] = ['wohnwagen', 'faltcaravan', 'anhaenger']
export const ANBAU_TYPEN: readonly Fahrzeugtyp[] = ['dachbox', 'hecktraeger']

export function isFahrzeugtyp(value: string | null | undefined): value is Fahrzeugtyp {
  return !!value && (FAHRZEUGTYPEN as readonly string[]).includes(value)
}

export function isZugfaehig(typ: string | null | undefined): boolean {
  return isFahrzeugtyp(typ) && (ZUGFAEHIGE_TYPEN as readonly string[]).includes(typ)
}

export function isGezogen(typ: string | null | undefined): boolean {
  return isFahrzeugtyp(typ) && (GEZOGENE_TYPEN as readonly string[]).includes(typ)
}

export function isAnbau(typ: string | null | undefined): boolean {
  return isFahrzeugtyp(typ) && (ANBAU_TYPEN as readonly string[]).includes(typ)
}

/** Icon-Key aus Fahrzeugtyp (Packliste / Verwaltung). */
export function iconKeyFromFahrzeugtyp(typ: Fahrzeugtyp): TransportIconKey {
  switch (typ) {
    case 'auto':
      return 'car'
    case 'wohnmobil':
      return 'bus'
    case 'kastenwagen':
      return 'van'
    case 'wohnwagen':
    case 'faltcaravan':
      return 'caravan'
    case 'anhaenger':
      return 'container'
    case 'dachbox':
      return 'package'
    case 'hecktraeger':
      return 'box'
  }
}

/** Typ aus Icon/Name ableiten (Migration / Fallback). */
export function inferFahrzeugtypFromIconOrName(
  icon: string | null | undefined,
  name: string
): Fahrzeugtyp {
  const n = name.trim().toLowerCase()
  if (icon === 'package' || n.includes('dachbox')) return 'dachbox'
  if (icon === 'box' || n.includes('heckbox') || n.includes('heckträger') || n.includes('hecktraeger')) {
    return 'hecktraeger'
  }
  if (
    icon === 'container' ||
    n.includes('anhänger') ||
    n.includes('anhaenger') ||
    n.includes('trailer')
  ) {
    return 'anhaenger'
  }
  if (icon === 'bus' || n.includes('wohnmobil')) return 'wohnmobil'
  if (n.includes('faltcaravan') || n.includes('faltwohnwagen')) return 'faltcaravan'
  if (icon === 'caravan' || n.includes('wohnwagen') || n.includes('caravan')) return 'wohnwagen'
  if (icon === 'van' || icon === 'truck' || n.includes('kastenwagen')) return 'kastenwagen'
  if (icon === 'car' || n.includes('auto') || n.includes('pkw')) return 'auto'
  return 'auto'
}

/** Aktiv am Kalendertag D (inklusiv, YYYY-MM-DD). */
export function isTransportActiveOn(
  vehicle: { aktiv_von?: string | null; aktiv_bis?: string | null },
  dateYmd: string
): boolean {
  const d = dateYmd.trim().slice(0, 10)
  if (!d) return true
  const von = vehicle.aktiv_von?.trim().slice(0, 10) || null
  const bis = vehicle.aktiv_bis?.trim().slice(0, 10) || null
  if (von && von > d) return false
  if (bis && bis < d) return false
  return true
}

/** Datum für Aktivität/Defaults: Abfahrt vor Start. */
export function vacationActivityDate(vacation: {
  startdatum: string
  abfahrtdatum?: string | null
}): string {
  const abfahrt = vacation.abfahrtdatum?.trim()
  if (abfahrt) return abfahrt.slice(0, 10)
  return vacation.startdatum.trim().slice(0, 10)
}

/** Ein Tag vor YYYY-MM-DD (UTC-Kalenderarithmetik). */
export function dayBeforeYmd(ymd: string): string {
  const d = ymd.trim().slice(0, 10)
  const parts = d.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const day = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return d
  const dt = new Date(Date.UTC(y, m - 1, day))
  dt.setUTCDate(dt.getUTCDate() - 1)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Standard-Auswahl für einen Urlaubstag (je geplante Haushalte bereits gefiltert):
 * - genau ein Zugfahrzeug → vorauswählen
 * - alle mit `urlaub_standard` → vorauswählen (auch Gezogenes/Anbau/weitere Autos)
 */
export function defaultTransportIdsForDate<
  T extends {
    id: string
    fahrzeugtyp?: string | null
    aktiv_von?: string | null
    aktiv_bis?: string | null
    traeger_transport_id?: string | null
    urlaub_standard?: boolean | number | null
  },
>(vehicles: T[], dateYmd: string): string[] {
  const active = vehicles.filter((v) => isTransportActiveOn(v, dateYmd))
  const selected = new Set<string>()

  const zug = active.filter((v) => isZugfaehig(v.fahrzeugtyp))
  if (zug.length === 1 && zug[0]) selected.add(zug[0].id)

  for (const v of active) {
    if (v.urlaub_standard === true || v.urlaub_standard === 1) {
      selected.add(v.id)
    }
  }

  return [...selected]
}

/**
 * Transport-ID für einen Packlisten-Eintrag im Urlaubskontext.
 * Stammdaten bleiben unverändert; nur die Packlisten-Zuordnung wird angepasst.
 *
 * Regeln:
 * - Quelle bereits in Urlaubsauswahl → behalten
 * - sonst gleiche Rolle (Zug / Gezogen / Anbau), wenn genau eines in der Auswahl
 * - Anbau ohne Träger in Auswahl → Träger, sonst Zugfahrzeug
 * - Gezogenes fehlt im Urlaub (z. B. Ferienhaus) → einziges Transportmittel bzw. einziges Zugfahrzeug
 * - zwei Autos, Ausrüstung auf dem anderen → auf das Urlaubs-Auto umbiegen
 */
export function resolveVacationPackTransportId<
  T extends {
    id: string
    fahrzeugtyp?: string | null
    traeger_transport_id?: string | null
  },
>(
  sourceTransportId: string | null | undefined,
  vacationTransportIds: readonly string[],
  vehicles: readonly T[]
): string | null {
  const vacIds = [...new Set(vacationTransportIds.filter(Boolean))]
  if (vacIds.length === 0) return sourceTransportId ?? null
  if (!sourceTransportId) return null
  if (vacIds.includes(sourceTransportId)) return sourceTransportId

  const byId = new Map(vehicles.map((v) => [v.id, v]))
  const vacSet = new Set(vacIds)
  const vacationVehicles = vacIds
    .map((id) => byId.get(id))
    .filter((v): v is T => !!v)
  const source = byId.get(sourceTransportId)

  if (source && isAnbau(source.fahrzeugtyp)) {
    const traeger = source.traeger_transport_id
    if (traeger && vacSet.has(traeger)) return traeger
  }

  const sameRole = (v: T): boolean => {
    if (!source) return false
    if (isZugfaehig(source.fahrzeugtyp)) return isZugfaehig(v.fahrzeugtyp)
    if (isGezogen(source.fahrzeugtyp)) return isGezogen(v.fahrzeugtyp)
    if (isAnbau(source.fahrzeugtyp)) return isAnbau(v.fahrzeugtyp)
    return false
  }
  const roleMatches = vacationVehicles.filter(sameRole)
  if (roleMatches.length === 1) return roleMatches[0].id

  if (vacIds.length === 1) return vacIds[0]

  const zug = vacationVehicles.filter((v) => isZugfaehig(v.fahrzeugtyp))
  if (zug.length >= 1) return zug[0].id

  return vacIds[0]
}

/** Fahrzeuge nach Rolle gruppieren (Zug / Gezogen / Anbau). */
export function groupVehiclesByRole<
  T extends { fahrzeugtyp?: string | null },
>(vehicles: T[]): { zug: T[]; gezogen: T[]; anbau: T[] } {
  const zug: T[] = []
  const gezogen: T[] = []
  const anbau: T[] = []
  for (const v of vehicles) {
    if (isZugfaehig(v.fahrzeugtyp)) zug.push(v)
    else if (isGezogen(v.fahrzeugtyp)) gezogen.push(v)
    else if (isAnbau(v.fahrzeugtyp)) anbau.push(v)
    else zug.push(v)
  }
  return { zug, gezogen, anbau }
}

/** Wirksames Stützlast-Limit (Kapazität), wenn Zug + Gezogenes beide Werte haben. */
export function effectiveStuetzlast(
  zugMax: number | null | undefined,
  gezogenMax: number | null | undefined
): number | null {
  const a = zugMax != null && zugMax > 0 ? zugMax : null
  const b = gezogenMax != null && gezogenMax > 0 ? gezogenMax : null
  if (a != null && b != null) return Math.min(a, b)
  return a ?? b
}

/** ZGG für Anbauten aus Eigengewicht + Traglast. */
export function zulGesamtgewichtForAnbau(eigengewicht: number, maxTraglast: number): number {
  const sum = eigengewicht + maxTraglast
  return sum > 0 ? sum : Math.max(eigengewicht, 0.01)
}
