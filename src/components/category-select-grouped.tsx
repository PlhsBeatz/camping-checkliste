'use client'

import { useMemo, useEffect, useRef, useState } from 'react'
import { SelectContent, SelectGroup, SelectItem, SelectLabel, Select, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Category, MainCategory } from '@/lib/db'

export type CategoryWithMainTitle = Pick<Category, 'id' | 'titel' | 'hauptkategorie_id'> & {
  hauptkategorie_titel: string
  reihenfolge?: number
}

/** Scroll-Ziel für gruppierte Kategorie-Dropdowns (Packliste / Ausrüstung). */
export type CategorySelectScrollTarget =
  | { kind: 'mainHeading'; mainTitle: string }
  | { kind: 'categoryRow'; categoryId: string }

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

function findHeading(viewport: HTMLElement, mainTitle: string): HTMLElement | null {
  for (const el of viewport.querySelectorAll('[data-category-select-main]')) {
    if (el.getAttribute('data-category-select-main') === mainTitle) return el as HTMLElement
  }
  return null
}

/** Oberkante von `el` mit Padding unterhalb der Viewport-Oberkante ausrichten (Hauptkategorie-Titel bleibt lesbar). */
function alignTop(viewport: HTMLElement, el: HTMLElement, pad: number) {
  const vr = viewport.getBoundingClientRect()
  const er = el.getBoundingClientRect()
  const delta = er.top - vr.top - pad
  if (Math.abs(delta) < 0.5) return
  viewport.scrollTop += delta
}

/** Sicherstellen, dass `el` vollständig im Viewport liegt (ohne Animation). */
function ensureVisible(viewport: HTMLElement, el: HTMLElement, pad: number) {
  let er = el.getBoundingClientRect()
  const vr = viewport.getBoundingClientRect()
  if (er.bottom > vr.bottom - pad) {
    viewport.scrollTop += er.bottom - vr.bottom + pad
  }
  er = el.getBoundingClientRect()
  if (er.top < vr.top + pad) {
    viewport.scrollTop += er.top - vr.top - pad
  }
}

/**
 * Scrollt den geöffneten Dropdown-Inhalt synchron (ohne smooth).
 * `contentEl` = Radix Select Content (enthält Viewport als Kind).
 */
/** false = Ziel noch nicht im DOM (z. B. Collection noch nicht registriert) oder kein Scroll nötig. */
export function applyCategorySelectScroll(contentEl: HTMLElement, target: CategorySelectScrollTarget): boolean {
  const viewport = contentEl.querySelector('[data-radix-select-viewport]') as HTMLElement | null
  if (!viewport) return false

  const pad = 8

  if (target.kind === 'mainHeading') {
    const heading = findHeading(viewport, target.mainTitle)
    if (!heading) return false
    alignTop(viewport, heading, pad)
    return true
  }

  const item = viewport.querySelector(
    `[data-category-select-id="${CSS.escape(target.categoryId)}"]`,
  ) as HTMLElement | null
  if (!item) return false

  const group = item.closest('[role="group"]')
  const heading = group?.querySelector('[data-category-select-main]') as HTMLElement | null

  if (heading) alignTop(viewport, heading, pad)
  ensureVisible(viewport, item, pad)

  if (heading) {
    const vr = viewport.getBoundingClientRect()
    const hr = heading.getBoundingClientRect()
    if (hr.top < vr.top + pad - 1) alignTop(viewport, heading, pad)
  }

  return true
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
            <SelectItem key={c.id} value={c.id} data-category-select-id={c.id}>
              {c.titel}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  )
}

interface CategoryGroupedSelectFieldProps {
  value: string
  onValueChange: (value: string) => void
  categories: CategoryWithMainTitle[]
  mainCategories: MainCategory[]
  scrollTarget?: CategorySelectScrollTarget | null
  triggerId?: string
  placeholder?: string
}

/**
 * Gruppiertes Kategorie-Dropdown mit kontrolliertem `open` und einmaligem Initial-Scroll
 * beim Aufklappen (nach Radix focus/Position); kein erneutes Scrollen bei Parent-Rerenders.
 */
export function CategoryGroupedSelectField({
  value,
  onValueChange,
  categories,
  mainCategories,
  scrollTarget = null,
  triggerId,
  placeholder = 'Kategorie wählen',
}: CategoryGroupedSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  /** Nur false→true: sonst feuert der Effect bei jedem Parent-Rerender mit neuem scrollTarget-Objekt erneut und überschreibt manuelles Scrollen. */
  const wasOpenRef = useRef(false)

  /**
   * Radix Select ruft beim Öffnen in einem Effect `focusSelectedItem` auf und setzt bei leerem
   * Value `viewport.scrollTop = 0`. Das läuft nach `useLayoutEffect` und verwirft unser Scrollen.
   * Daher erst in `useEffect` (+ kurze rAF-Serie als Absicherung für `isPositioned` / Collection).
   */
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true

    if (!justOpened || !scrollTarget) return

    let cancelled = false
    let rafId = 0
    let appliedFrames = 0
    /** Mehrere Anwendungen, falls Radix in einem späteren Frame erneut `scrollTop` setzt */
    const maxApply = 10
    let totalTicks = 0
    const maxTicks = 90

    const tick = () => {
      totalTicks++
      if (cancelled || appliedFrames >= maxApply || totalTicks > maxTicks) return

      const node = contentRef.current
      if (node) {
        applyCategorySelectScroll(node, scrollTarget)
        appliedFrames++
      }

      if (!cancelled && appliedFrames < maxApply && totalTicks < maxTicks) {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [open, scrollTarget])

  return (
    <Select open={open} onOpenChange={setOpen} value={value} onValueChange={onValueChange}>
      <SelectTrigger id={triggerId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent ref={contentRef}>
        <CategorySelectGroupedItems categories={categories} mainCategories={mainCategories} />
      </SelectContent>
    </Select>
  )
}
