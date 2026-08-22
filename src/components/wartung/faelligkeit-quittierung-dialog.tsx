'use client'

import { useEffect, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker'
import type { Faelligkeit } from '@/lib/db'

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FaelligkeitQuittierungDialog({
  open,
  onOpenChange,
  item,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Faelligkeit | null
  onDone: () => void
}) {
  const [notiz, setNotiz] = useState('')
  const [datum, setDatum] = useState(todayYmd)
  const [bezugDatum, setBezugDatum] = useState('')
  const [gueltigBis, setGueltigBis] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAlterAnzeige = item?.typ === 'alter_anzeige'

  useEffect(() => {
    if (!open || !item) return
    const today = todayYmd()
    setDatum(today)
    setNotiz('')
    setBezugDatum(isAlterAnzeige ? today : '')
    setGueltigBis('')
    setError(null)
  }, [open, item, isAlterAnzeige])

  const handleSubmit = async (typ: 'quittiert' | 'erledigt') => {
    if (!item) return

    if (isAlterAnzeige && typ === 'erledigt' && !bezugDatum && !gueltigBis) {
      setError('Bitte Kauf-/Herstell-Datum oder Gültig bis angeben.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        ereignis_typ: typ,
        datum,
        notiz: notiz || null,
        updateLetzteErledigung: true,
      }

      if (isAlterAnzeige && typ === 'erledigt') {
        body.bezug_datum = bezugDatum || null
        body.gueltig_bis = gueltigBis || null
      }

      const res = await fetch(`/api/faelligkeiten/${item.id}/historie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      onDone()
      onOpenChange(false)
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={`Quittieren: ${item.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isAlterAnzeige
            ? 'Bei „Erledigt / getauscht“ tragen Sie die Daten des neuen Gegenstands ein (z. B. neuer Feuerlöscher oder Reifen).'
            : 'Bestätigen Sie, dass die Maßnahme erledigt wurde oder die Warnung zur Kenntnis genommen wurde.'}
        </p>

        <div className="space-y-2">
          <Label>Quittierungsdatum</Label>
          <CalendarDatePicker value={datum} onChange={setDatum} dialogTitle="Datum wählen" />
        </div>

        {isAlterAnzeige && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              Nur bei „Erledigt / getauscht“ – mindestens eines der Felder ausfüllen.
            </p>
            <div className="space-y-2">
              <Label>Kauf-/Herstell-Datum</Label>
              <CalendarDatePicker
                value={bezugDatum}
                onChange={setBezugDatum}
                dialogTitle="Kauf-/Herstell-Datum"
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis</Label>
              <CalendarDatePicker
                value={gueltigBis}
                onChange={setGueltigBis}
                dialogTitle="Gültig bis"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Notiz (optional)</Label>
          <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => void handleSubmit('quittiert')}
          >
            Zur Kenntnis genommen
          </Button>
          <Button disabled={saving} onClick={() => void handleSubmit('erledigt')}>
            Erledigt / getauscht
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  )
}
