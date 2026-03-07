'use client'

import { useState, useEffect } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TravelerForMarkAll {
  id: string
  name: string
  isCurrentlyPacked?: boolean
  /** Nur im Löschen-Dialog: Eintrag für diese Person bereits als gepackt markiert */
  gepackt?: boolean
  /** Nur im Löschen-Dialog: Eintrag für diese Person als vorgemerkt markiert */
  gepackt_vorgemerkt?: boolean
}

interface MarkAllConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedTravelerIds: string[]) => void
  _itemName: string
  /** Betroffene Mitreisende – für Mark-Modus die ungepackten, für Unmark die gepackten */
  travelers: TravelerForMarkAll[]
  isUnmarkMode?: boolean
  /** Optionale Overrides (z. B. für Löschen-Dialog) */
  title?: string
  description?: string
  confirmLabel?: string
  /** Löschen-Modus: „Für wen von der Packliste entfernen?“ – Bestätigungs-Button zeigt Anzahl */
  deleteMode?: boolean
}

export function MarkAllConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  _itemName,
  travelers,
  isUnmarkMode = false,
  title: titleOverride,
  description: descriptionOverride,
  confirmLabel: confirmLabelOverride,
  deleteMode = false
}: MarkAllConfirmationDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && travelers.length > 0) {
      if (deleteMode) {
        // Im Löschen-Modus: nur Personen anhaken, bei denen der Eintrag weder gepackt noch vorgemerkt ist
        const idsToSelect = travelers
          .filter(t => !t.gepackt && !t.gepackt_vorgemerkt)
          .map(t => t.id)
        setSelectedIds(new Set(idsToSelect))
      } else {
        setSelectedIds(new Set(travelers.map(t => t.id)))
      }
    }
  }, [isOpen, travelers, deleteMode])

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

  const title =
    titleOverride ??
    (deleteMode
      ? 'Für wen von der Packliste entfernen?'
      : isUnmarkMode
        ? 'Für alle zurücksetzen?'
        : 'Für alle abhaken?')
  const description =
    descriptionOverride ??
    (deleteMode
      ? 'Wählen Sie die Mitreisenden, für die dieser Eintrag von der Packliste entfernt werden soll.'
      : isUnmarkMode
        ? 'Wählen Sie die Mitreisenden, für die dieser Gegenstand zurückgesetzt werden soll.'
        : 'Wählen Sie die Mitreisenden, für die dieser Gegenstand als "gepackt" markiert werden soll.')
  const confirmLabel =
    confirmLabelOverride ??
    (deleteMode
      ? `Entfernen (${selectedIds.size})`
      : isUnmarkMode
        ? `Zurücksetzen (${selectedIds.size})`
        : `Abhaken (${selectedIds.size})`)

  const hasPackedOrVorgemerkt = deleteMode && travelers.some(t => t.gepackt || t.gepackt_vorgemerkt)

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      contentClassName="sm:max-w-md"
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className={cn(
          'mx-auto w-12 h-12 rounded-full flex items-center justify-center border',
          deleteMode ? 'bg-destructive/10 border-destructive/20' : 'bg-primary/10 border-primary/20'
        )}>
          {deleteMode ? (
            <Trash2 className="h-6 w-6 text-destructive" />
          ) : (
            <CheckCheck className="h-6 w-6 text-primary" />
          )}
        </div>
        {hasPackedOrVorgemerkt && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            Bei einigen Personen ist der Eintrag bereits als gepackt oder vorgemerkt markiert. Diese sind standardmäßig nicht ausgewählt.
          </p>
        )}
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
              <span className="text-sm font-medium flex-1">{t.name}</span>
              {deleteMode && (t.gepackt || t.gepackt_vorgemerkt) && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {t.gepackt ? 'Gepackt' : 'Vorgemerkt'}
                </span>
              )}
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
              "w-full sm:w-auto font-medium",
              deleteMode
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
