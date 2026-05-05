'use client'

import { useMemo } from 'react'
import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select'
import type { Category, MainCategory } from '@/lib/db'

export type CategoryWithMainTitle = Pick<Category, 'id' | 'titel' | 'hauptkategorie_id'> & {
  hauptkategorie_titel: string
  reihenfolge?: number
}

function groupCategories(
  categories: CategoryWithMainTitle[],
  mainCategories: MainCategory[],
): { mainId: string; mainTitle: string; items: CategoryWithMainTitle[] }[] {
  const grouped = new Map<string, CategoryWithMainTitle[]>()
  for (const c of categories) {
    const list = grouped.get(c.hauptkategorie_id)
    if (list) list.push(c)
    else grouped.set(c.hauptkategorie_id, [c])
  }

  const result: { mainId: string; mainTitle: string; items: CategoryWithMainTitle[] }[] = []

  if (mainCategories.length > 0) {
    const sortedMains = [...mainCategories].sort((a, b) => a.reihenfolge - b.reihenfolge)
    for (const m of sortedMains) {
      const items = grouped.get(m.id)
      if (!items?.length) continue
      items.sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))
      result.push({ mainId: m.id, mainTitle: m.titel, items })
    }
  }

  for (const [mainId, items] of grouped) {
    if (result.some((r) => r.mainId === mainId)) continue
    items.sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))
    const title = items[0]?.hauptkategorie_titel ?? 'Unbekannt'
    result.push({ mainId, mainTitle: title, items })
  }

  return result
}

interface CategorySelectGroupedItemsProps {
  categories: CategoryWithMainTitle[]
  mainCategories: MainCategory[]
}

/** Hauptkategorien als graue, nicht auswählbare Überschriften; Kategorien nur mit Kurznamen. */
export function CategorySelectGroupedItems({
  categories,
  mainCategories,
}: CategorySelectGroupedItemsProps) {
  const groups = useMemo(() => groupCategories(categories, mainCategories), [categories, mainCategories])

  return (
    <>
      {groups.map((g) => (
        <SelectGroup key={g.mainId}>
          <SelectLabel
            className="mx-0 rounded-sm bg-muted px-2 py-2 text-sm font-semibold text-foreground pointer-events-none cursor-default select-none"
            data-category-select-main={g.mainTitle}
          >
            {g.mainTitle}
          </SelectLabel>
          {g.items.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.titel}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  )
}

/** Scrollt die Radix-Select-Viewport zur Hauptkategorie-Überschrift (Titelerwartung wie in der Packliste). */
export function scrollCategorySelectToMainTitle(mainTitle: string): void {
  let heading: Element | null = null
  for (const el of document.querySelectorAll('[data-category-select-main]')) {
    if (el.getAttribute('data-category-select-main') === mainTitle) {
      heading = el
      break
    }
  }
  if (!heading || !(heading instanceof HTMLElement)) return

  const viewport = heading.closest('[data-radix-select-viewport]') as HTMLElement | null
  if (!viewport) return

  const top =
    heading.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
  viewport.scrollTo({ top: Math.max(0, top - 6), behavior: 'auto' })
}
