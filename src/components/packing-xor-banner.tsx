'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ApiResponse } from '@/lib/api-types'
import type { XorConflict, XorReplacement } from '@/lib/packing-alternatives'

export function PackingXorBanner({
  vacationId,
  packedGegenstandIds,
  justRemoved,
  onAddGegenstand,
}: {
  vacationId: string | null
  packedGegenstandIds: string[]
  justRemoved: { id: string; was: string } | null
  onAddGegenstand?: (gegenstandId: string) => void
}) {
  const [conflicts, setConflicts] = useState<XorConflict[]>([])
  const [replacement, setReplacement] = useState<XorReplacement | null>(null)

  const load = useCallback(async () => {
    if (!vacationId) {
      setConflicts([])
      setReplacement(null)
      return
    }
    const params = new URLSearchParams({ vacationId })
    if (justRemoved) {
      params.set('removedId', justRemoved.id)
      params.set('removedWas', justRemoved.was)
    }
    try {
      const res = await fetch(`/api/packing-alternatives?${params.toString()}`)
      const json = (await res.json()) as ApiResponse<{
        conflicts?: XorConflict[]
        replacement?: XorReplacement | null
      }>
      if (json.success) {
        setConflicts(json.data?.conflicts ?? [])
        setReplacement(json.data?.replacement ?? null)
      }
    } catch {
      /* ignore */
    }
  }, [vacationId, justRemoved, packedGegenstandIds.join('|')])

  useEffect(() => {
    void load()
  }, [load])

  if (conflicts.length === 0 && !replacement) return null

  return (
    <div className="space-y-2 mb-4">
      {conflicts.map((c) => (
        <Alert key={c.group_id}>
          <AlertTitle>Entweder-oder</AlertTitle>
          <AlertDescription>
            {c.on_list.map((i) => i.was).join(' und ')} sind zusammen auf der Liste – meist
            braucht ihr nur eines.
          </AlertDescription>
        </Alert>
      ))}
      {replacement && (() => {
        const first = replacement.suggest[0]
        if (!first) return null
        return (
        <Alert>
          <AlertTitle>Alternative?</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {replacement.removed_was} ist runter. Stattdessen{' '}
              {replacement.suggest.map((s) => s.was).join(' oder ')}?
            </span>
            {onAddGegenstand && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddGegenstand(first.gegenstand_id)}
              >
                {first.was} hinzufügen
              </Button>
            )}
          </AlertDescription>
        </Alert>
        )
      })()}
    </div>
  )
}
