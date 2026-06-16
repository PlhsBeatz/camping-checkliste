'use client'

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BulkPackingDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemNames: string[]
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}

const PREVIEW_LIMIT = 5
const CONFIRM_CHECK_FROM = 4
const TYPE_COUNT_FROM = 10

export function BulkPackingDeleteDialog({
  open,
  onOpenChange,
  itemNames,
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

  const handleConfirm = async () => {
    if (!canDelete) return
    await onConfirm()
    onOpenChange(false)
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${count} ${count === 1 ? 'Eintrag' : 'Einträge'} löschen?`}
      description="Diese Einträge werden dauerhaft aus der Packliste entfernt."
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
            <span>Ich verstehe, dass {count} Einträge dauerhaft gelöscht werden.</span>
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
            {isLoading ? 'Wird gelöscht…' : `${count} löschen`}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
