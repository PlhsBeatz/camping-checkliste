export const CHECKLISTE_HUB_ANLAESSE = [
  'keine',
  'abfahrt',
  'ankunft',
  'einwintern',
  'auswintern',
] as const

export type ChecklisteHubAnlass = (typeof CHECKLISTE_HUB_ANLAESSE)[number]

export const HUB_ANLASS_LABEL: Record<ChecklisteHubAnlass, string> = {
  keine: 'Nicht im Hub',
  abfahrt: 'Abfahrt',
  ankunft: 'Ankunft',
  einwintern: 'Einwintern',
  auswintern: 'Auswintern',
}

export function isChecklisteHubAnlass(v: unknown): v is ChecklisteHubAnlass {
  return (
    typeof v === 'string' &&
    (CHECKLISTE_HUB_ANLAESSE as readonly string[]).includes(v)
  )
}

export function normalizeHubAnlass(v: unknown): ChecklisteHubAnlass {
  return isChecklisteHubAnlass(v) ? v : 'keine'
}
