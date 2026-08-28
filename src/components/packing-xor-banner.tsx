'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  conflictsForPackingList,
  replacementAfterRemoving,
  type AlternativeGroup,
} from '@/lib/packing-alternatives'
import { fetchAndCacheAlternativeGroups } from '@/lib/offline-sync'

export function PackingXorBanner({
  vacationId,
  packedGegenstandIds,
  justRemoved,
  onAddEquipmentIds,
  onDismissReplacement,
}: {
  vacationId: string | null
  packedGegenstandIds: string[]
  justRemoved: { id: string; was: string } | null
  onAddEquipmentIds?: (gegenstandIds: string[]) => Promise<void> | void
  onDismissReplacement?: () => void
}) {
  const [groups, setGroups] = useState<AlternativeGroup[]>([])
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const onAddRef = useRef(onAddEquipmentIds)
  onAddRef.current = onAddEquipmentIds
  const onDismissRef = useRef(onDismissReplacement)
  onDismissRef.current = onDismissReplacement

  useEffect(() => {
    if (!vacationId) {
      setGroups([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const cached = await fetchAndCacheAlternativeGroups()
        if (!cancelled) setGroups(cached)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vacationId])

  const conflicts = conflictsForPackingList(groups, packedGegenstandIds)
  const replacement = justRemoved
    ? replacementAfterRemoving(groups, packedGegenstandIds, justRemoved.id, justRemoved.was)
    : null

  const closeReplacement = () => {
    setAddError(null)
    onDismissRef.current?.()
  }

  useEffect(() => {
    setAddError(null)
  }, [replacement?.group_id, replacement?.removed_was])

  const addReplacement = async () => {
    const add = onAddRef.current
    if (!replacement || !add || adding) return
    setAdding(true)
    setAddError(null)
    try {
      await add(replacement.suggest.map((s) => s.gegenstand_id))
      closeReplacement()
    } catch (error) {
      console.error('XOR-Alternative hinzufügen:', error)
      setAddError(
        error instanceof Error
          ? error.message
          : 'Die Alternative konnte nicht auf die Packliste.'
      )
    } finally {
      setAdding(false)
    }
  }

  const showModal = !!replacement && replacement.suggest.length > 0

  return (
    <>
      {conflicts.length > 0 && (
        <div className="space-y-2 mb-4">
          {conflicts.map((c) => (
            <Alert key={c.group_id}>
              <AlertTitle>Entweder-oder</AlertTitle>
              <AlertDescription>
                {c.on_list.map((i) => i.was).join(' und ')} stehen zusammen auf der Liste.
                Laut Ausrüstung: {c.choice_label || 'nur eine der beiden Seiten'}.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={showModal}
        onOpenChange={(open) => {
          if (!open) closeReplacement()
        }}
        title="Alternative ergänzen?"
        description={
          replacement
            ? `„${replacement.removed_was}“ ist nicht mehr auf der Packliste.`
            : undefined
        }
      >
        {replacement && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {replacement.suggest.length > 1
                ? 'Diese Teile gehören zusammen und werden gemeinsam aufgenommen:'
                : 'Stattdessen aufnehmen:'}
            </p>
            <ul className="rounded-lg border bg-muted/30 divide-y">
              {replacement.suggest.map((s) => (
                <li key={s.gegenstand_id} className="px-3 py-2 text-sm font-medium">
                  {s.was}
                </li>
              ))}
            </ul>
            {addError && (
              <p className="text-sm text-destructive" role="alert">
                {addError}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={adding}
                onClick={closeReplacement}
              >
                Nicht jetzt
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={adding || !onAddEquipmentIds}
                onClick={() => void addReplacement()}
              >
                {adding ? 'Fügt hinzu…' : 'Auf die Packliste'}
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>
    </>
  )
}
