'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 border border-primary/20">
            <CheckCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-foreground">
            {isUnmarkMode ? 'Für alle zurücksetzen?' : 'Für alle abhaken?'}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {isUnmarkMode 
              ? `Dieser Gegenstand wird für ${travelerNames.join(', ')} als "nicht gepackt" zurückgesetzt.`
              : `Dieser Gegenstand wird für ${travelerNames.join(', ')} als "gepackt" markiert.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto border-border hover:bg-accent"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
