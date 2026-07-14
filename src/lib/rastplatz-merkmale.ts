export type RastplatzMerkmalId =
  | 'sauber'
  | 'fruehstueck'
  | 'wohnwagen_parkplatz'
  | 'wc_dusche'
  | 'spielplatz'
  | 'ruhig'
  | 'viel_verkehr'
  | 'teuer'
  | 'günstig'
  | 'schmutzig'
  | 'voll'
  | 'wenig_platz'

export const RASTPLATZ_MERKMALE: Array<{ id: RastplatzMerkmalId; label: string }> = [
  { id: 'sauber', label: 'Sauber' },
  { id: 'fruehstueck', label: 'Gutes Frühstück' },
  { id: 'wohnwagen_parkplatz', label: 'Wohnwagen-Parkplätze' },
  { id: 'wc_dusche', label: 'WC / Dusche' },
  { id: 'spielplatz', label: 'Spielplatz' },
  { id: 'ruhig', label: 'Ruhig' },
  { id: 'viel_verkehr', label: 'Viel Verkehr' },
  { id: 'teuer', label: 'Teuer' },
  { id: 'günstig', label: 'Günstig' },
  { id: 'schmutzig', label: 'Schmutzig' },
  { id: 'voll', label: 'Oft voll' },
  { id: 'wenig_platz', label: 'Wenig Platz' },
]

export const RASTPLATZ_MERKMAL_LABELS: Record<RastplatzMerkmalId, string> = Object.fromEntries(
  RASTPLATZ_MERKMALE.map((m) => [m.id, m.label])
) as Record<RastplatzMerkmalId, string>

export function merkmalLabel(id: string): string {
  return RASTPLATZ_MERKMAL_LABELS[id as RastplatzMerkmalId] ?? id
}
