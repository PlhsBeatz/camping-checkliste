import type { Category, EquipmentItem, MainCategory } from '@/lib/db'

export type GroupedEquipmentPicker = {
  mainCategoryId: string
  mainName: string
  categories: { categoryId: string; name: string; items: EquipmentItem[] }[]
}

/** Gruppierung wie Ausrüstungstabelle: reihenfolge der Haupt-/Unterkategorien, ohne Ausgemustert. */
export function groupEquipmentForPicker(
  items: EquipmentItem[],
  categories: Category[],
  mainCategories: MainCategory[],
  search: string
): GroupedEquipmentPicker[] {
  const q = search.trim().toLowerCase()
  const active = items.filter((e) => e.status !== 'Ausgemustert')
  const filtered = q
    ? active.filter(
        (e) =>
          e.was.toLowerCase().includes(q) ||
          e.kategorie_titel?.toLowerCase().includes(q) ||
          e.hauptkategorie_titel?.toLowerCase().includes(q)
      )
    : active

  const mainGroups: Record<string, Record<string, EquipmentItem[]>> = {}
  for (const item of filtered) {
    const cat = categories.find((c) => c.id === item.kategorie_id)
    const mainId = cat?.hauptkategorie_id ?? 'unknown'
    if (!mainGroups[mainId]) mainGroups[mainId] = {}
    if (!mainGroups[mainId][item.kategorie_id]) mainGroups[mainId][item.kategorie_id] = []
    mainGroups[mainId][item.kategorie_id].push(item)
  }

  const mainIds = Object.keys(mainGroups)
  mainIds.sort((a, b) => {
    const orderA = mainCategories.find((m) => m.id === a)?.reihenfolge ?? 999
    const orderB = mainCategories.find((m) => m.id === b)?.reihenfolge ?? 999
    return orderA - orderB || a.localeCompare(b, 'de')
  })

  return mainIds.map((mainCategoryId) => {
    const categoryGroup = mainGroups[mainCategoryId] ?? {}
    const mainCategory = mainCategories.find((m) => m.id === mainCategoryId)
    const categoryIds = Object.keys(categoryGroup)
    categoryIds.sort((a, b) => {
      const orderA = categories.find((c) => c.id === a)?.reihenfolge ?? 999
      const orderB = categories.find((c) => c.id === b)?.reihenfolge ?? 999
      return orderA - orderB || a.localeCompare(b, 'de')
    })
    return {
      mainCategoryId,
      mainName: mainCategory?.titel ?? 'Unbekannt',
      categories: categoryIds.map((categoryId) => ({
        categoryId,
        name: categories.find((c) => c.id === categoryId)?.titel ?? 'Ohne Kategorie',
        items: (categoryGroup[categoryId] ?? []).sort((a, b) =>
          a.was.localeCompare(b.was, 'de')
        ),
      })),
    }
  })
}
