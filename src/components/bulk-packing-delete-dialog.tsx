'use client'

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { BulkDeleteSemantics } from '@/lib/bulk-packing-profile'

interface BulkPackingDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemNames: string[]
  semantics?: BulkDeleteSemantics
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}

function deleteCopy(semantics: BulkDeleteSemantics, count: number) {
  const entries = count === 1 ? 'Eintrag' : 'Einträge'
  switch (semantics) {
    case 'person':
      return {
        title: `${count} ${entries} entfernen?`,
        description:
          'Die Zuordnung wird für die gewählten Personen aufgehoben. Einträge können für andere Personen auf der Packliste bleiben.',
        confirmCheckbox: `Ich verstehe, dass ${count} Zuordnungen aufgehoben werden.`,
        confirmButton: `${count} entfernen`,
      }
    case 'mixed':
      return {
        title: `${count} ${entries} entfernen?`,
        description:
          'Ganze Einträge werden gelöscht. Bei personenbezogenen Einträgen wird nur die Zuordnung für die gewählten Personen aufgehoben.',
        confirmCheckbox: `Ich verstehe die Auswirkungen für ${count} ausgewählte Einträge.`,
        confirmButton: `${count} bestätigen`,
      }
    default:
      return {
        title: `${count} ${entries} löschen?`,
        description: 'Diese Einträge werden aus der Packliste entfernt.',
        confirmCheckbox: `Ich verstehe, dass ${count} Einträge gelöscht werden.`,
        confirmButton: `${count} löschen`,
      }
  }
}

const PREVIEW_LIMIT = 5
const CONFIRM_CHECK_FROM = 4
const TYPE_COUNT_FROM = 10

export function BulkPackingDeleteDialog({
  open,
  onOpenChange,
  itemNames,
  semantics = 'whole',
  onConfirm,
  isLoading = false,
}: BulkPackingDeleteDialogProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [typedCount, setTypedCount] = useState('')
  const count = itemNames.length

  useEffect(() => {
    if (!open) {
      setConfirmed(false)
      setTypedCount('')
    }
  }, [open])

  const preview = useMemo(() => itemNames.slice(0, PREVIEW_LIMIT), [itemNames])
  const rest = count - preview.length

  const needsCheckbox = count >= CONFIRM_CHECK_FROM
  const needsTypedCount = count >= TYPE_COUNT_FROM
  const typedOk = !needsTypedCount || typedCount.trim() === String(count)
  const canDelete = (!needsCheckbox || confirmed) && typedOk && !isLoading
  const copy = deleteCopy(semantics, count)

  const handleConfirm = async () => {
    if (!canDelete) return
    await onConfirm()
    onOpenChange(false)
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      contentClassName="sm:max-w-md"
    >
      <div className="space-y-4 pt-2">
        <ul className="text-sm list-disc pl-5 space-y-0.5">
          {preview.map((name, i) => (
            <li key={`${name}-${i}`}>{name}</li>
          ))}
          {rest > 0 && <li className="text-muted-foreground">… und {rest} weitere</li>}
        </ul>

        {needsCheckbox && (
          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(c) => setConfirmed(!!c)}
              className="mt-0.5"
            />
            <span>{copy.confirmCheckbox}</span>
          </label>
        )}

        {needsTypedCount && (
          <div>
            <Label htmlFor="bulk-delete-count" className="text-sm">
              Zur Bestätigung „{count}“ eingeben
            </Label>
            <Input
              id="bulk-delete-count"
              inputMode="numeric"
              value={typedCount}
              onChange={(e) => setTypedCount(e.target.value)}
              className="mt-1.5"
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete}
            onClick={() => void handleConfirm()}
          >
            {isLoading ? 'Wird verarbeitet…' : copy.confirmButton}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
