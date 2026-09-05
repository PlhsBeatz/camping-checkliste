'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { Faelligkeit } from '@/lib/db'
import type { EquipmentFaelligkeitDisposition } from '@/lib/db-wartung'

export type ReplaceWartungDisposition = Extract<
  EquipmentFaelligkeitDisposition,
  'keep' | 'transfer' | 'archive_and_create'
>
export type RetireWartungDisposition = Extract<EquipmentFaelligkeitDisposition, 'keep' | 'archive'>

interface EquipmentFaelligkeitDispositionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'replace' | 'retire'
  items: Faelligkeit[]
  sourceName: string
  onConfirm: (disposition: EquipmentFaelligkeitDisposition) => void
  isLoading?: boolean
}

export function EquipmentFaelligkeitDispositionDialog({
  open,
  onOpenChange,
  mode,
  items,
  sourceName,
  onConfirm,
  isLoading = false,
}: EquipmentFaelligkeitDispositionDialogProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Zugeordnete Wartung"
      description={
        mode === 'replace'
          ? `„${sourceName}“ hat offene Fälligkeiten. Was soll mit ihnen passieren?`
          : `„${sourceName}“ wird ausgemustert und hat offene Fälligkeiten.`
      }
      contentClassName="max-w-lg"
    >
      <div className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border px-3 py-2">
              <span className="font-medium">{item.name}</span>
              {item.naechste_faelligkeit ? (
                <span className="block text-xs text-muted-foreground">
                  Nächste Fälligkeit {item.naechste_faelligkeit}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Label>Auswahl</Label>
          <div className="flex flex-col gap-2">
            {mode === 'replace' && (
              <Button
                type="button"
                className="justify-start h-auto whitespace-normal py-2"
                onClick={() => onConfirm('transfer')}
                disabled={isLoading}
              >
                Auf den neuen Eintrag umhängen (Historie bleibt)
              </Button>
            )}
            {mode === 'replace' && (
              <Button
                type="button"
                variant="outline"
                className="justify-start h-auto whitespace-normal py-2"
                onClick={() => onConfirm('archive_and_create')}
                disabled={isLoading}
              >
                Alte archivieren und gleiche Fälligkeit am Nachfolger neu anlegen
              </Button>
            )}
            {mode === 'retire' && (
              <Button
                type="button"
                className="justify-start h-auto whitespace-normal py-2"
                onClick={() => onConfirm('archive')}
                disabled={isLoading}
              >
                Fälligkeiten archivieren
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="justify-start h-auto whitespace-normal py-2"
              onClick={() => onConfirm('keep')}
              disabled={isLoading}
            >
              Am alten Eintrag belassen
            </Button>
          </div>
          {mode === 'replace' && (
            <p className="text-xs text-muted-foreground">
              Am alten Eintrag belassene Fälligkeiten können im Heute-Hub weiter erscheinen, bis sie
              archiviert sind.
            </p>
          )}
        </div>
      </div>
    </ResponsiveModal>
  )
}
