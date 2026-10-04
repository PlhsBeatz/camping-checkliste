/** Bekannte Hersteller-Domains für Grundriss-/Maß-Recherche (Vorrang vor Vergleichsportalen). */

export const HERSTELLER_DOMAINS: Record<string, string[]> = {
  lmc: ['lmc-caravan.com', 'lmc-caravan.de'],
  hobby: ['hobby-caravan.de', 'hobby-caravan.com'],
  knaus: ['knaus.com', 'knaus.de'],
  fendt: ['fendt-caravan.com', 'fendt.com'],
  dethleffs: ['dethleffs.de', 'dethleffs.com'],
  tabbert: ['tabbert.com', 'tabbert.de'],
  adria: ['adria-mobil.com', 'adria-mobil.de'],
  bürstner: ['buerstner.com', 'buerstner.de'],
  buerstner: ['buerstner.com', 'buerstner.de'],
  weinsberg: ['weinsberg.com', 'weinsberg.de'],
  hymer: ['hymer.com'],
  eriba: ['eriba.com'],
  sprite: ['spritecaravans.com', 'swiftgroup.co.uk'],
}

export const VERGLEICH_DOMAIN_PENALTY =
  /caravanvergelijker|caravans\.nl|wohnwagen\.check24|mobile\.de|autoscout|kleinanzeigen|marktplaats|facebook|pinterest/i

export function herstellerDomainsFor(hersteller: string): string[] {
  const key = hersteller
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '')
  if (!key) return []
  for (const [name, domains] of Object.entries(HERSTELLER_DOMAINS)) {
    if (key.includes(name) || name.includes(key)) return domains
  }
  return []
}

export function scoreSourceUrl(url: string, hersteller: string): number {
  let score = 0
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (VERGLEICH_DOMAIN_PENALTY.test(host)) score -= 50
    for (const d of herstellerDomainsFor(hersteller)) {
      if (host === d || host.endsWith(`.${d}`)) score += 100
    }
    if (host.includes(hersteller.trim().toLowerCase().slice(0, 4))) score += 20
  } catch {
    /* ignore */
  }
  return score
}

/**
 * Platzierungs-Länge für Sonnenausrichtung:
 * Aufbau (Karosserie) bevorzugen; sonst Gesamtlänge; sonst generisches laenge_m.
 */
export function resolvePlacementLengthM(v: {
  laenge_aufbau_m?: number | null
  laenge_gesamt_m?: number | null
  laenge_m?: number | null
}): { lengthM: number | null; basis: 'aufbau' | 'gesamt' | 'laenge_m' | null } {
  const aufbau = v.laenge_aufbau_m != null ? Number(v.laenge_aufbau_m) : NaN
  if (Number.isFinite(aufbau) && aufbau > 0) return { lengthM: aufbau, basis: 'aufbau' }
  const gesamt = v.laenge_gesamt_m != null ? Number(v.laenge_gesamt_m) : NaN
  if (Number.isFinite(gesamt) && gesamt > 0) return { lengthM: gesamt, basis: 'gesamt' }
  const L = v.laenge_m != null ? Number(v.laenge_m) : NaN
  if (Number.isFinite(L) && L > 0) return { lengthM: L, basis: 'laenge_m' }
  return { lengthM: null, basis: null }
}
