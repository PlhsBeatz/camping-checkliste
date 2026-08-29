'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { cn } from '@/lib/utils'
import {
  conflictsForPackingList,
  formatOptionLabel,
  replacementAfterRemoving,
  suggestedKeepOptionIndex,
  type AlternativeGroup,
  type XorConflict,
} from '@/lib/packing-alternatives'
import { fetchAndCacheAlternativeGroups } from '@/lib/offline-sync'

function keepBothLabel(optionCount: number): string {
  return optionCount <= 2 ? 'Trotzdem beides mitnehmen' : 'Trotzdem alle behalten'
}

const IGNORE_STORAGE_PREFIX = 'camping:packliste-xor-ignoriert:'

type QueuedXor = XorConflict & { suggestedKeepOptionIndex: number | null }

function readLocalIgnored(vacationId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(`${IGNORE_STORAGE_PREFIX}${vacationId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && !!id) : []
  } catch {
    return []
  }
}

function writeLocalIgnored(vacationId: string, ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${IGNORE_STORAGE_PREFIX}${vacationId}`, JSON.stringify([...new Set(ids)]))
  } catch {
    /* Quota / privater Modus */
  }
}

export function PackingXorBanner({
  vacationId,
  packedGegenstandIds,
  justRemoved,
  onAddEquipmentIds,
  onRemoveGegenstandIds,
  onDismissReplacement,
}: {
  vacationId: string | null
  packedGegenstandIds: string[]
  justRemoved: { id: string; was: string } | null
  onAddEquipmentIds?: (gegenstandIds: string[]) => Promise<void> | void
  onRemoveGegenstandIds?: (gegenstandIds: string[]) => Promise<void> | void
  onDismissReplacement?: () => void
}) {
  const [groups, setGroups] = useState<AlternativeGroup[]>([])
  const [groupsReady, setGroupsReady] = useState(false)
  const [ignoredIds, setIgnoredIds] = useState<string[]>([])
  const [ignoredReady, setIgnoredReady] = useState(false)
  const [sessionSkipped, setSessionSkipped] = useState<Set<string>>(new Set())
  const [queue, setQueue] = useState<QueuedXor[]>([])
  const prevPackedRef = useRef<Set<string> | null>(null)
  const prevVacationRef = useRef(vacationId)
  const [resolverOpen, setResolverOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [adding, setAdding] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const onAddRef = useRef(onAddEquipmentIds)
  onAddRef.current = onAddEquipmentIds
  const onRemoveRef = useRef(onRemoveGegenstandIds)
  onRemoveRef.current = onRemoveGegenstandIds
  const onDismissRef = useRef(onDismissReplacement)
  onDismissRef.current = onDismissReplacement

  useEffect(() => {
    if (!vacationId) {
      setGroups([])
      setGroupsReady(false)
      setIgnoredIds([])
      setIgnoredReady(false)
      setSessionSkipped(new Set())
      setQueue([])
      prevPackedRef.current = null
      setResolverOpen(false)
      setIndex(0)
      return
    }
    setGroupsReady(false)
    setIgnoredReady(false)
    setSessionSkipped(new Set())
    setQueue([])
    prevPackedRef.current = null
    setResolverOpen(false)
    setIndex(0)
    setResolveError(null)

    let cancelled = false
    void (async () => {
      try {
        const cached = await fetchAndCacheAlternativeGroups()
        if (!cancelled) {
          setGroups(cached)
          setGroupsReady(true)
        }
      } catch {
        if (!cancelled) {
          setGroups([])
          setGroupsReady(true)
        }
      }
    })()

    const local = readLocalIgnored(vacationId)
    setIgnoredIds(local)
    void (async () => {
      try {
        const res = await fetch(
          `/api/packing-alternatives/xor-ignore?vacationId=${encodeURIComponent(vacationId)}`,
          { cache: 'no-store' }
        )
        const json = (await res.json()) as {
          success?: boolean
          data?: { ignoredGroupIds?: string[] }
        }
        const server = json.data?.ignoredGroupIds ?? []
        if (cancelled) return
        const merged = [...new Set([...local, ...server])]
        setIgnoredIds(merged)
        writeLocalIgnored(vacationId, merged)
        const missingOnServer = local.filter((id) => !server.includes(id))
        for (const gruppeId of missingOnServer) {
          void fetch('/api/packing-alternatives/xor-ignore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vacationId, gruppeId }),
          })
        }
      } catch {
        /* Offline: lokale Liste reicht */
      } finally {
        if (!cancelled) setIgnoredReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [vacationId])

  const packedKey = packedGegenstandIds.join('|')
  const packedIdsStable = useMemo(
    () => (packedKey ? packedKey.split('|') : []),
    [packedKey]
  )

  if (prevVacationRef.current !== vacationId) {
    prevVacationRef.current = vacationId
    prevPackedRef.current = null
  }

  const prevPacked = prevPackedRef.current
  const justAddedNow =
    prevPacked === null || (prevPacked.size === 0 && packedIdsStable.length > 0)
      ? []
      : packedIdsStable.filter((id) => !prevPacked.has(id))
  const justAddedForSuggest =
    justAddedNow.length > 0 && justAddedNow.length <= 4 ? justAddedNow : []
  const justAddedRef = useRef(justAddedForSuggest)
  justAddedRef.current = justAddedForSuggest

  useEffect(() => {
    prevPackedRef.current = new Set(packedIdsStable)
  }, [packedIdsStable])

  const ignoredSet = useMemo(() => new Set(ignoredIds), [ignoredIds])

  const pending = useMemo(() => {
    const all = conflictsForPackingList(groups, packedIdsStable)
    return all.filter((c) => !ignoredSet.has(c.group_id) && !sessionSkipped.has(c.group_id))
  }, [groups, packedIdsStable, ignoredSet, sessionSkipped])

  const pendingIdsKey = pending.map((c) => c.group_id).join('|')
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  const replacement = justRemoved
    ? replacementAfterRemoving(groups, packedIdsStable, justRemoved.id, justRemoved.was)
    : null
  const showReplacement = !!replacement && replacement.suggest.length > 0

  useEffect(() => {
    if (!vacationId || !groupsReady || !ignoredReady || showReplacement) return
    if (queue.length > 0) return
    if (!pendingIdsKey) {
      setResolverOpen(false)
      return
    }
    setQueue(
      pendingRef.current.map((conflict) => ({
        ...conflict,
        suggestedKeepOptionIndex: suggestedKeepOptionIndex(conflict, justAddedRef.current),
      }))
    )
    setIndex(0)
    setResolverOpen(true)
  }, [vacationId, groupsReady, ignoredReady, showReplacement, pendingIdsKey, queue.length])

  const current = queue[index]
  const total = queue.length
  const step = total === 0 ? 0 : index + 1
  const isLast = total > 0 && index >= total - 1

  useEffect(() => {
    if (!current) {
      setChecked(new Set())
      return
    }
    if (current.suggestedKeepOptionIndex != null) {
      setChecked(new Set([current.suggestedKeepOptionIndex]))
    } else {
      setChecked(new Set(current.options.map((o) => o.option_index)))
    }
    setResolveError(null)
  }, [current])

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

  const toggleOption = (optionIndex: number, nextChecked: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (nextChecked) {
        next.add(optionIndex)
        return next
      }
      if (next.size <= 1) return prev
      next.delete(optionIndex)
      return next
    })
  }

  const canContinue = !!current && checked.size === 1 && current.options.length >= 2
  const canKeepAll =
    !!current && checked.size === current.options.length && current.options.length >= 2

  const goToNextOrClose = (fromIndex: number) => {
    const next = fromIndex + 1
    if (next >= queue.length) {
      setQueue([])
      setIndex(0)
      setResolverOpen(false)
      return
    }
    setIndex(next)
  }

  const applyKeepSelection = async () => {
    const remove = onRemoveRef.current
    if (!current || !remove || !canContinue || resolving) return
    const removeIds = current.options
      .filter((o) => !checked.has(o.option_index))
      .flatMap((o) => o.items.map((i) => i.gegenstand_id))
    const fromIndex = index
    setResolving(true)
    setResolveError(null)
    try {
      await remove(removeIds)
      goToNextOrClose(fromIndex)
    } catch (error) {
      console.error('XOR-Auswahl anwenden:', error)
      setResolveError(
        error instanceof Error ? error.message : 'Die Auswahl konnte nicht übernommen werden.'
      )
    } finally {
      setResolving(false)
    }
  }

  const ignoreCurrent = async () => {
    if (!vacationId || !current || resolving || !canKeepAll) return
    const gruppeId = current.group_id
    const fromIndex = index
    const nextIgnored = [...new Set([...ignoredIds, gruppeId])]
    setIgnoredIds(nextIgnored)
    writeLocalIgnored(vacationId, nextIgnored)
    setResolving(true)
    setResolveError(null)
    try {
      const res = await fetch('/api/packing-alternatives/xor-ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacationId, gruppeId }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || json.success === false) {
        throw new Error(json.error ?? 'Ignorieren fehlgeschlagen')
      }
    } catch (error) {
      console.error('XOR ignorieren:', error)
      /* Lokal bleibt gespeichert, damit der Hinweis auf diesem Gerät nicht wiederkommt. */
    } finally {
      setResolving(false)
      goToNextOrClose(fromIndex)
    }
  }

  const skipRemainingThisVisit = () => {
    setSessionSkipped((prev) => {
      const next = new Set(prev)
      for (const c of queue.slice(index)) next.add(c.group_id)
      return next
    })
    setQueue([])
    setIndex(0)
    setResolverOpen(false)
  }

  return (
    <>
      <ResponsiveModal
        open={resolverOpen && !showReplacement && !!current}
        onOpenChange={(open) => {
          if (!open) skipRemainingThisVisit()
        }}
        title="Beides mitnehmen?"
        description={total > 1 ? `${step} von ${total}` : undefined}
      >
        {current && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Du nimmst normalerweise nur eines davon mit. Wähle aus, was auf der Packliste bleiben
              soll.
              {current.suggestedKeepOptionIndex != null ? (
                <> Der gerade hinzugefügte Eintrag ist vorausgewählt.</>
              ) : null}
            </p>
            <ul className="space-y-2">
              {current.options.map((option) => {
                const optionId = `xor-option-${current.group_id}-${option.option_index}`
                const isChecked = checked.has(option.option_index)
                const lastChecked = isChecked && checked.size === 1
                const willRemove = !isChecked && checked.size === 1
                const willKeep = isChecked && checked.size === 1
                return (
                  <li
                    key={option.option_index}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 transition-colors',
                      willRemove
                        ? 'border-destructive/40 bg-destructive/10'
                        : willKeep
                          ? 'border-primary/25 bg-primary/5'
                          : 'border-border bg-muted/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={optionId}
                        checked={isChecked}
                        disabled={resolving || lastChecked}
                        className="mt-0.5"
                        onCheckedChange={(value) =>
                          toggleOption(option.option_index, value === true)
                        }
                      />
                      <label htmlFor={optionId} className="flex-1 cursor-pointer min-w-0">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            willRemove && 'line-through text-destructive'
                          )}
                        >
                          {formatOptionLabel(option.items)}
                        </span>
                        {option.items.length > 1 && (
                          <span
                            className={cn(
                              'mt-0.5 block text-xs leading-4 text-muted-foreground',
                              willRemove && 'line-through text-destructive/80'
                            )}
                          >
                            {option.items.map((i) => i.was).join(', ')}
                          </span>
                        )}
                        <span
                          className={cn(
                            'mt-1.5 flex h-3.5 items-center gap-1.5 text-xs font-medium leading-none',
                            willRemove ? 'text-destructive' : willKeep ? 'text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {willRemove ? (
                            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          ) : null}
                          <span className="min-w-0 truncate">
                            {willRemove ? 'Wird von der Packliste entfernt' : 'Bleibt auf der Packliste'}
                          </span>
                        </span>
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>
            {resolveError && (
              <p className="text-sm text-destructive" role="alert">
                {resolveError}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={resolving || !canKeepAll}
                onClick={() => void ignoreCurrent()}
              >
                {keepBothLabel(current.options.length)}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={resolving || !canContinue || !onRemoveGegenstandIds}
                onClick={() => void applyKeepSelection()}
              >
                {resolving ? 'Speichert…' : isLast ? 'Fertig' : 'Weiter'}
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      <ResponsiveModal
        open={showReplacement}
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
