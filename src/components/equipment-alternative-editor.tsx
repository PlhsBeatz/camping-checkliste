'use client'

import { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { ChevronDown, ChevronRight, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { ApiResponse } from '@/lib/api-types'
import type { EquipmentItem } from '@/lib/db'
import {
  formatXorChoice,
  type AlternativeGroup,
} from '@/lib/packing-alternatives'

export type EquipmentAlternativeEditorHandle = {
  /** Speichert eine offene Auswahl. true = nichts offen oder erfolgreich. */
  savePending: () => Promise<boolean>
}

export const EquipmentAlternativeEditor = forwardRef<
  EquipmentAlternativeEditorHandle,
  {
    currentItem: EquipmentItem
    equipmentItems: EquipmentItem[]
    groups: AlternativeGroup[]
    canEdit: boolean
    onGroupsChange: (next: AlternativeGroup[]) => void
  }
>(function EquipmentAlternativeEditor(
  { currentItem, equipmentItems, groups, canEdit, onGroupsChange },
  ref
) {
  const [query, setQuery] = useState('')
  const [otherIds, setOtherIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(groups.length > 0)

  const takenIds = new Set<string>([currentItem.id])
  for (const g of groups) {
    for (const it of g.items) takenIds.add(it.gegenstand_id)
  }

  const selected = otherIds
    .map((id) => equipmentItems.find((e) => e.id === id))
    .filter(Boolean) as EquipmentItem[]

  const q = query.trim().toLowerCase()
  const hits =
    q.length < 1
      ? []
      : equipmentItems
          .filter((e) => {
            if (takenIds.has(e.id) || otherIds.includes(e.id)) return false
            if (e.status === 'Ausgemustert') return false
            return e.was.toLowerCase().includes(q)
          })
          .slice(0, 8)

  const addOther = (id: string) => {
    setOtherIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setQuery('')
  }

  const save = useCallback(async (): Promise<boolean> => {
    if (otherIds.length === 0) return true
    if (saving) return false
    setSaving(true)
    try {
      const options = [[currentItem.id], otherIds]
      const otherNames = otherIds
        .map((id) => equipmentItems.find((e) => e.id === id)?.was)
        .filter(Boolean) as string[]
      const titel =
        otherNames.length === 1
          ? `${currentItem.was} oder ${otherNames[0]}`
          : `${currentItem.was} oder ${otherNames.join(' und ')}`
      const res = await fetch('/api/packing-alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options, titel }),
      })
      const json = (await res.json()) as ApiResponse<AlternativeGroup>
      if (!json.success || !json.data) {
        alert(json.error ?? 'Alternative konnte nicht gespeichert werden')
        return false
      }
      onGroupsChange([...groups, json.data])
      setOtherIds([])
      setQuery('')
      setExpanded(true)
      return true
    } catch {
      alert('Alternative konnte nicht gespeichert werden')
      return false
    } finally {
      setSaving(false)
    }
  }, [otherIds, saving, currentItem, equipmentItems, groups, onGroupsChange])

  useImperativeHandle(ref, () => ({ savePending: () => save() }), [save])

  const removeGroup = async (groupId: string) => {
    const res = await fetch('/api/packing-alternatives', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: groupId }),
    })
    const json = (await res.json()) as ApiResponse<unknown>
    if (!json.success) {
      alert(json.error ?? 'Gruppe konnte nicht gelöscht werden')
      return
    }
    onGroupsChange(groups.filter((g) => g.id !== groupId))
  }

  const summary =
    groups.length > 0
      ? groups.map((g) => g.titel?.trim() || formatXorChoice(g.options)).join(' · ')
      : 'optional'

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="rounded-md border border-border/60 bg-muted/20"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30 rounded-md"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">Entweder-oder</span>
            <span className="text-xs text-muted-foreground truncate">· {summary}</span>
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 px-3 pb-3 pt-1 text-sm">
          {groups.length > 0 ? (
            <ul className="space-y-1">
              {groups.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground pt-1.5">
                    {g.titel?.trim() || formatXorChoice(g.options)}
                  </span>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label="Alternative löschen"
                      onClick={() => void removeGroup(g.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              Noch keine Alternative. Du kannst z. B. „{currentItem.was}“ gegen ein oder mehrere
              andere Teile hinterlegen (Sofa und Hocker als eine Seite).
            </p>
          )}

          {canEdit && (
            <div className="space-y-2 pt-1">
              <Label htmlFor="alt-search" className="text-xs">
                Andere Seite wählen (ein oder mehrere Gegenstände)
              </Label>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.map((e) => (
                    <span
                      key={e.id}
                      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs"
                    >
                      {e.was}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`${e.was} entfernen`}
                        onClick={() => setOtherIds((prev) => prev.filter((id) => id !== e.id))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                id="alt-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Namen suchen…"
                className="h-8 text-sm"
              />
              {hits.length > 0 && (
                <ul className="max-h-32 overflow-y-auto rounded-md border bg-card divide-y">
                  {hits.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted"
                        onClick={() => addOther(e.id)}
                      >
                        {e.was}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {otherIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Wird mit „Aktualisieren“ gespeichert, oder direkt hier:
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={otherIds.length === 0 || saving}
                onClick={() => void save()}
              >
                {saving ? 'Speichert…' : 'Alternative anlegen'}
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})
