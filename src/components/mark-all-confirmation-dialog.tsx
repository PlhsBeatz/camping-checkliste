'use client'

import { useState, useEffect } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TravelerForMarkAll {
  id: string
  name: string
  isCurrentlyPacked?: boolean
}

interface MarkAllConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedTravelerIds: string[]) => void
  _itemName: string
  /** Betroffene Mitreisende – für Mark-Modus die ungepackten, für Unmark die gepackten */
  travelers: TravelerForMarkAll[]
  isUnmarkMode?: boolean
}

export function MarkAllConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  _itemName,
  travelers,
  isUnmarkMode = false
}: MarkAllConfirmationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && travelers.length > 0) {
      setSelectedIds(new Set(travelers.map(t => t.id)))
    }
  }, [isOpen, travelers])

  const toggleTraveler = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds))
    onClose()
  }

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={isUnmarkMode ? 'Für alle zurücksetzen?' : 'Für alle abhaken?'}
      description={
        isUnmarkMode
          ? 'Wählen Sie die Mitreisenden, für die dieser Gegenstand zurückgesetzt werden soll.'
          : 'Wählen Sie die Mitreisenden, für die dieser Gegenstand als "gepackt" markiert werden soll.'
      }
      contentClassName="sm:max-w-md"
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
          <CheckCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          {travelers.map(t => (
            <label
              key={t.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedIds.has(t.id)}
                onCheckedChange={() => toggleTraveler(t.id)}
              />
              <span className="text-sm font-medium">{t.name}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className={cn(
              "w-full sm:w-auto",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              "font-medium"
            )}
          >
            {isUnmarkMode
              ? `Zurücksetzen (${selectedIds.size})`
              : `Abhaken (${selectedIds.size})`}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
