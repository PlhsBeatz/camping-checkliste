import type { PackingItem } from './db'

/** Stabiler Vergleich für Reconnect-Refetch – vermeidet UI-Flackern bei identischen Daten. */
export function packingItemsEqual(a: PackingItem[], b: PackingItem[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false

  const signature = (items: PackingItem[]) =>
    items
      .map((i) => {
        const mit = (i.mitreisende ?? [])
          .map(
            (m) =>
              `${m.mitreisender_id}:${m.gepackt ? 1 : 0}:${m.gepackt_vorgemerkt ? 1 : 0}:${m.anzahl ?? ''}:${m.transport_id ?? ''}:${m.einzelgewicht_override ?? ''}`
          )
          .sort()
          .join(';')
        const grup = (i.gruppen ?? [])
          .map(
            (g) =>
              `${g.gruppe_id}:${g.gepackt ? 1 : 0}:${g.gepackt_vorgemerkt ? 1 : 0}`
          )
          .sort()
          .join(';')
        const modus = i.pauschal_gruppen_modus ?? 'einmal'
        const verantwortliche = i.verantwortliche_gruppe_id ?? ''
        const bemerkung = i.bemerkung ?? ''
        const transportId = i.transport_id ?? ''
        const was = i.was ?? ''
        const kategorieId = i.kategorie_id ?? ''
        const gewicht = i.einzelgewicht ?? ''
        const gewichtOverride = i.einzelgewicht_override ?? ''
        const ausruestungGewicht = i.ausruestung_einzelgewicht ?? ''
        return `${i.id}\t${i.gepackt ? 1 : 0}\t${i.gepackt_vorgemerkt ? 1 : 0}\t${i.anzahl}\t${modus}\t${verantwortliche}\t${bemerkung}\t${transportId}\t${was}\t${kategorieId}\t${gewicht}\t${gewichtOverride}\t${ausruestungGewicht}\t${grup}\t${mit}`
      })
      .sort()
      .join('\n')

  return signature(a) === signature(b)
}
