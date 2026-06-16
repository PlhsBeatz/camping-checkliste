'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PauschalGruppenModus } from '@/lib/pauschal-gruppen'
import {
  derivePauschalAssignmentFromGruppeSelection,
  getSelectedGruppeIdsFromAssignment,
  type PauschalGruppenAssignmentPayload,
} from '@/lib/pauschal-gruppen'
import type { PackProfileGroup } from '@/lib/pack-profile-groups'

const EMPTY_GRUPPE_IDS: string[] = []

export type { PauschalGruppenAssignmentPayload }

interface PauschalGruppeAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  /** Mehrfach-Zuordnung: Anzahl der Einträge (Titel/Confirm-Button) */
  itemCount?: number
  vacationGroups: PackProfileGroup[]
  currentModus?: PauschalGruppenModus
  currentVerantwortlicheGruppeId?: string | null
  currentGruppeIds?: string[]
  ownGruppeId?: string | null
  /** false: Sofort bei Chip-Klick; true: Bestätigen-Button (Bulk) */
  deferApply?: boolean
  onAssign?: (payload: PauschalGruppenAssignmentPayload) => void
  onConfirm?: (payload: PauschalGruppenAssignmentPayload) => void
}

function GroupChip({
  active,
  onClick,
  children,
  highlight,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)] text-white'
          : 'border-subtle bg-card hover:bg-muted/60',
        highlight && !active && 'ring-1 ring-[rgb(45,79,30)]/40'
      )}
    >
      {children}
    </button>
  )
}

export function PauschalGruppeAssignmentModal({
  open,
  onOpenChange,
  itemName,
  itemCount,
  vacationGroups,
  currentModus,
  currentVerantwortlicheGruppeId,
  currentGruppeIds,
  ownGruppeId,
  deferApply = false,
  onAssign,
  onConfirm,
}: PauschalGruppeAssignmentModalProps) {
  const gruppeIds = currentGruppeIds ?? EMPTY_GRUPPE_IDS
  const gruppeIdsKey = gruppeIds.join('\u0001')
  const groups = useMemo(
    () =>
      vacationGroups.flatMap((g) =>
        g.members.length > 0 ? [{ id: g.id, name: g.name }] : []
      ),
    [vacationGroups]
  )
  const allGruppeIds = useMemo(() => groups.map((g) => g.id), [groups])
  const isBulk = (itemCount ?? 1) > 1

  const initialSelectedIds = useMemo(
    () =>
      isBulk
        ? EMPTY_GRUPPE_IDS
        : getSelectedGruppeIdsFromAssignment(
            currentModus,
            currentVerantwortlicheGruppeId,
            gruppeIds,
            allGruppeIds
          ),
    [
      isBulk,
      currentModus,
      currentVerantwortlicheGruppeId,
      gruppeIdsKey,
      allGruppeIds,
    ]
  )

  const [pendingIds, setPendingIds] = useState<string[]>(EMPTY_GRUPPE_IDS)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setPendingIds(initialSelectedIds)
    }
    wasOpenRef.current = open
  }, [open, initialSelectedIds])

  const selectedIds = deferApply ? pendingIds : initialSelectedIds

  const toggleGroup = useCallback(
    (gruppeId: string) => {
      const base = deferApply ? pendingIds : initialSelectedIds
      const next = base.includes(gruppeId)
        ? base.filter((id) => id !== gruppeId)
        : [...base, gruppeId]
      const payload = derivePauschalAssignmentFromGruppeSelection(next, allGruppeIds)

      if (deferApply) {
        setPendingIds(next)
        return
      }
      onAssign?.(payload)
    },
    [deferApply, pendingIds, initialSelectedIds, allGruppeIds, onAssign]
  )

  const handleConfirm = () => {
    const payload = derivePauschalAssignmentFromGruppeSelection(pendingIds, allGruppeIds)
    if (payload.pauschalGruppenModus === 'offen') return
    onConfirm?.(payload)
  }

  const title = isBulk
    ? `${itemCount} Einträge – Zuordnung`
    : `${itemName} – Zuordnung`

  const description = isBulk
    ? 'Haushalt(e) für alle ausgewählten pauschalen Einträge wählen.'
    : 'Haushalt(e) auswählen.'

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      contentClassName="sm:max-w-md"
    >
      <div className="flex flex-wrap gap-2 pt-2">
        {groups.map((g) => (
          <GroupChip
            key={g.id}
            active={selectedIds.includes(g.id)}
            highlight={g.id === ownGruppeId}
            onClick={() => toggleGroup(g.id)}
          >
            {g.name}
          </GroupChip>
        ))}
      </div>
      {deferApply && (
        <Button
          type="button"
          className="w-full mt-4 bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white"
          disabled={pendingIds.length === 0}
          onClick={handleConfirm}
        >
          {itemCount} {itemCount === 1 ? 'Eintrag' : 'Einträge'} zuordnen
        </Button>
      )}
    </ResponsiveModal>
  )
}
