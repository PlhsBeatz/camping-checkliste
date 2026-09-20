'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatVerbrauch, literAusGewicht } from '@/lib/verbrauch-format'

/** Hilfsfelder: Brutto/Leer → Liter, Übernehmen in das Ziel-Feld. */
export function GewichtZuLiterEingabe({
  dichteKgProL,
  defaultLeergewichtKg,
  onUebernehmen,
}: {
  dichteKgProL: number
  defaultLeergewichtKg: number | null
  onUebernehmen: (liter: number) => void
}) {
  const [brutto, setBrutto] = useState('')
  const [leer, setLeer] = useState(
    defaultLeergewichtKg != null ? String(defaultLeergewichtKg) : ''
  )

  useEffect(() => {
    setLeer(defaultLeergewichtKg != null ? String(defaultLeergewichtKg) : '')
  }, [defaultLeergewichtKg])

  const bruttoN = brutto === '' ? NaN : Number(brutto)
  const leerN = leer === '' ? 0 : Number(leer)
  const liter =
    Number.isFinite(bruttoN) && Number.isFinite(leerN)
      ? literAusGewicht(bruttoN, leerN, dichteKgProL)
      : null

  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/20 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">
        Liter aus Gewicht (Dichte {formatVerbrauch(dichteKgProL, 2)} kg/l)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Brutto (kg)</Label>
          <Input
            type="number"
            step="0.1"
            value={brutto}
            onChange={(e) => setBrutto(e.target.value)}
            placeholder="z. B. 18,5"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Leergewicht (kg)</Label>
          <Input
            type="number"
            step="0.1"
            value={leer}
            onChange={(e) => setLeer(e.target.value)}
            placeholder="Kanister leer"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm tabular-nums">
          {liter != null ? (
            <>
              ≈ <span className="font-medium">{formatVerbrauch(liter, 2)} l</span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={liter == null}
          onClick={() => liter != null && onUebernehmen(liter)}
        >
          Übernehmen
        </Button>
      </div>
    </div>
  )
}
