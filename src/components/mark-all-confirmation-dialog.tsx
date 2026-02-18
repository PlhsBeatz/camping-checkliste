'use client'

import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkAllConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  _itemName: string
  travelerNames: string[]
  isUnmarkMode?: boolean
}

export function MarkAllConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  _itemName,
  travelerNames,
  isUnmarkMode = false
}: MarkAllConfirmationDialogProps) {
  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={isUnmarkMode ? 'Für alle zurücksetzen?' : 'Für alle abhaken?'}
      description={
        isUnmarkMode
          ? `Dieser Gegenstand wird für ${travelerNames.join(', ')} als "nicht gepackt" zurückgesetzt.`
          : `Dieser Gegenstand wird für ${travelerNames.join(', ')} als "gepackt" markiert.`
      }
      contentClassName="sm:max-w-md"
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
          <CheckCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={cn(
              "w-full sm:w-auto",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              "font-medium"
            )}
          >
            {isUnmarkMode ? 'Ja, zurücksetzen' : 'Ja, für alle'}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
