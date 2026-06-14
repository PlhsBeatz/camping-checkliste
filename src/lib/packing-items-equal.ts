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
              `${m.mitreisender_id}:${m.gepackt ? 1 : 0}:${m.gepackt_vorgemerkt ? 1 : 0}:${m.anzahl ?? ''}`
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
        return `${i.id}\t${i.gepackt ? 1 : 0}\t${i.gepackt_vorgemerkt ? 1 : 0}\t${i.anzahl}\t${modus}\t${verantwortliche}\t${grup}\t${mit}`
      })
      .sort()
      .join('\n')

  return signature(a) === signature(b)
}
