'use client'

import { useCallback, useMemo } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { cn } from '@/lib/utils'
import type { PauschalGruppenModus } from '@/lib/pauschal-gruppen'
import {
  derivePauschalAssignmentFromGruppeSelection,
  getSelectedGruppeIdsFromAssignment,
  type PauschalGruppenAssignmentPayload,
} from '@/lib/pauschal-gruppen'
import type { PackProfileGroup } from '@/lib/pack-profile-groups'

export type { PauschalGruppenAssignmentPayload }

interface PauschalGruppeAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  vacationGroups: PackProfileGroup[]
  currentModus?: PauschalGruppenModus
  currentVerantwortlicheGruppeId?: string | null
  currentGruppeIds?: string[]
  ownGruppeId?: string | null
  onAssign: (payload: PauschalGruppenAssignmentPayload) => void
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
  vacationGroups,
  currentModus,
  currentVerantwortlicheGruppeId,
  currentGruppeIds = [],
  ownGruppeId,
  onAssign,
}: PauschalGruppeAssignmentModalProps) {
  const groups = useMemo(
    () =>
      vacationGroups.flatMap((g) =>
        g.members.length > 0 ? [{ id: g.id, name: g.name }] : []
      ),
    [vacationGroups]
  )
  const allGruppeIds = useMemo(() => groups.map((g) => g.id), [groups])

  const selectedIds = useMemo(
    () =>
      getSelectedGruppeIdsFromAssignment(
        currentModus,
        currentVerantwortlicheGruppeId,
        currentGruppeIds,
        allGruppeIds
      ),
    [currentModus, currentVerantwortlicheGruppeId, currentGruppeIds, allGruppeIds]
  )

  const toggleGroup = useCallback(
    (gruppeId: string) => {
      const next = selectedIds.includes(gruppeId)
        ? selectedIds.filter((id) => id !== gruppeId)
        : [...selectedIds, gruppeId]
      onAssign(derivePauschalAssignmentFromGruppeSelection(next, allGruppeIds))
    },
    [selectedIds, allGruppeIds, onAssign]
  )

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${itemName} – Zuordnung`}
      description="Haushalt(e) auswählen. Eine Gruppe = gemeinsam von ihr, mehrere = pro Haushalt, alle = jeder Haushalt."
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
    </ResponsiveModal>
  )
}
