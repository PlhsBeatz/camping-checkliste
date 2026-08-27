'use client'

import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { formatStayDateRangeDe } from '@/lib/booking-stay-dates'

export type BookingExtraDayDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  stayRangeLabel: string
  importRangeLabel: string
  onChooseExtraDay: () => void
  onChooseUpdateStay: () => void
}

export function BookingExtraDayDialog({
  open,
  onOpenChange,
  stayRangeLabel,
  importRangeLabel,
  onChooseExtraDay,
  onChooseUpdateStay,
}: BookingExtraDayDialogProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Abweichendes Abreisedatum"
      description="Die Buchungs-E-Mail weicht beim Abreisetag ab. Wie soll das gespeichert werden?"
      contentClassName="max-w-lg"
    >
      <div className="space-y-4 pb-1">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
          <p>
            <span className="text-muted-foreground">Aufenthalt geplant:</span>{' '}
            <span className="font-medium">{stayRangeLabel}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Laut Buchung:</span>{' '}
            <span className="font-medium">{importRangeLabel}</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Anreisetag ist identisch – Abreise in der Buchung ist einen Tag später. Das ist oft
          Absicht, um am Abreisetag weniger Zeitdruck zu haben.
        </p>
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={onChooseExtraDay}>
            Ein Tag länger gebucht (Absicht)
          </Button>
          <Button type="button" variant="outline" onClick={onChooseUpdateStay}>
            Aufenthaltsdaten anpassen
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}

export function buildExtraDayRangeLabels(
  stayStart: string | null | undefined,
  stayEnd: string | null | undefined,
  importStart: string | null | undefined,
  importEnd: string | null | undefined
): { stayRangeLabel: string; importRangeLabel: string } {
  return {
    stayRangeLabel: formatStayDateRangeDe(stayStart, stayEnd),
    importRangeLabel: formatStayDateRangeDe(importStart, importEnd),
  }
}
