export const PLACE_CHANGE_FIELDS = [
  'name',
  'adresse',
  'ort',
  'bundesland',
  'land',
  'webseite',
  'telefon',
  'oeffnungszeiten',
  'platzplan_url',
] as const

export type PlaceChangeField = (typeof PLACE_CHANGE_FIELDS)[number]

export type PlaceFieldChange = {
  field: PlaceChangeField
  label: string
  previous: string
  proposed: string
}

export const PLACE_CHANGE_LABELS: Record<PlaceChangeField, string> = {
  name: 'Name',
  adresse: 'Adresse',
  ort: 'Ort',
  bundesland: 'Bundesland',
  land: 'Land',
  webseite: 'Webseite',
  telefon: 'Telefon',
  oeffnungszeiten: 'Öffnungszeiten',
  platzplan_url: 'Platzplan-URL',
}

export function normalizePlaceText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export function textsDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizePlaceText(a) !== normalizePlaceText(b)
}

export function parsePlaceFieldChanges(payload: Record<string, unknown>): PlaceFieldChange[] {
  const raw = payload.changes
  if (!Array.isArray(raw)) return []
  const out: PlaceFieldChange[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const field = String(rec.field ?? '')
    if (!(PLACE_CHANGE_FIELDS as readonly string[]).includes(field)) continue
    out.push({
      field: field as PlaceChangeField,
      label: PLACE_CHANGE_LABELS[field as PlaceChangeField],
      previous: String(rec.previous ?? ''),
      proposed: String(rec.proposed ?? ''),
    })
  }
  return out
}
