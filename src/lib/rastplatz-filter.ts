import type { Rastplatz } from '@/lib/db'

export type RastplatzBewertungFilter = 'all' | 'empfehlung' | 'no_go'

export type RastplatzFilterState = {
  search: string
  filterBewertung: RastplatzBewertungFilter
  filterKategorie: string
}

export const DEFAULT_RASTPLATZ_FILTER: RastplatzFilterState = {
  search: '',
  filterBewertung: 'empfehlung',
  filterKategorie: 'all',
}

export function filterRastplaetze(items: Rastplatz[], filter: RastplatzFilterState): Rastplatz[] {
  const q = filter.search.trim().toLowerCase()
  return items.filter((r) => {
    if (filter.filterBewertung !== 'all' && r.bewertung !== filter.filterBewertung) return false
    if (filter.filterKategorie !== 'all' && r.kategorie !== filter.filterKategorie) return false
    if (!q) return true
    const hay = [r.name, r.ort, r.land, r.bemerkungen, ...r.merkmale]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}
