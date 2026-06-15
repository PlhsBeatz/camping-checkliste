'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { suppressAdminForeignWarn } from '@/lib/pauschal-gruppen'

interface AdminFremdeGruppeWarningDialogProps {
  open: boolean
  gruppeName: string
  /** true = abhaken, false = Haken entfernen */
  markingAsPacked: boolean
  vacationId: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function AdminFremdeGruppeWarningDialog({
  open,
  gruppeName,
  markingAsPacked,
  vacationId,
  onConfirm,
  onCancel,
}: AdminFremdeGruppeWarningDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)

  const handleConfirm = () => {
    if (dontAskAgain && vacationId) {
      suppressAdminForeignWarn(vacationId)
    }
    onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fremde Gruppe</AlertDialogTitle>
          <AlertDialogDescription>
            Dieser Eintrag ist <strong>{gruppeName}</strong> zugeordnet.{' '}
            {markingAsPacked ? 'Trotzdem abhaken?' : 'Trotzdem Haken entfernen?'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="dont-ask-foreign-gruppe"
            checked={dontAskAgain}
            onCheckedChange={(v) => setDontAskAgain(!!v)}
          />
          <Label htmlFor="dont-ask-foreign-gruppe" className="text-sm font-normal cursor-pointer">
            In diesem Urlaub nicht mehr fragen
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {markingAsPacked ? 'Trotzdem abhaken' : 'Trotzdem entfernen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
