'use client'

import * as React from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}

/**
 * Bestätigungs-Dialog: Drawer auf Smartphone, Modal auf Desktop.
 * Ersetzt window.confirm() für ein konsistentes Design.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  variant = 'destructive',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const busy = isLoading || isSubmitting

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          onClick={handleConfirm}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {busy ? 'Wird gelöscht...' : confirmLabel}
        </Button>
      </div>
    </ResponsiveModal>
  )
}
