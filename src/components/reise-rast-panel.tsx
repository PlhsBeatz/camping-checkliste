'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsDown, ThumbsUp, ChevronDown, MapPin, X } from 'lucide-react'
import type { ApiResponse } from '@/lib/api-types'
import type { NearbyPlaceResult } from '@/app/api/places/nearby/route'
import type { Rastplatz, RastplatzBewertung } from '@/lib/db'
import { RASTPLATZ_MERKMALE } from '@/lib/rastplatz-merkmale'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { cacheRastplatz } from '@/lib/offline-db'

interface ReiseRastPanelProps {
  visible: boolean
  position: { lat: number; lng: number }
  vacationId?: string | null
  onDismiss: () => void
  onSaved?: (r: Rastplatz) => void
}

export function ReiseRastPanel({
  visible,
  position,
  vacationId,
  onDismiss,
  onSaved,
}: ReiseRastPanelProps) {
  const [places, setPlaces] = useState<NearbyPlaceResult[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [merkmale, setMerkmale] = useState<string[]>([])
  const [showMerkmale, setShowMerkmale] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const selected = places[selectedIdx] ?? null

  const loadNearby = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/places/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: position.lat, lng: position.lng }),
      })
      const data = (await res.json()) as ApiResponse<NearbyPlaceResult[]>
      if (data.success && data.data?.length) {
        setPlaces(data.data)
        setSelectedIdx(0)
      } else {
        setPlaces([])
      }
    } catch {
      setPlaces([])
    } finally {
      setLoading(false)
    }
  }, [position.lat, position.lng])

  useEffect(() => {
    if (visible) void loadNearby()
  }, [visible, loadNearby])

  const save = async (bewertung: RastplatzBewertung) => {
    if (!selected) {
      toast.error('Kein Ort gefunden — bitte manuell in Rastplätze anlegen.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/rastplaetze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selected.name,
          bewertung,
          kategorie: selected.kategorie,
          merkmale,
          adresse: selected.address,
          ort: selected.ort,
          land: selected.land,
          bundesland: selected.bundesland,
          lat: selected.lat,
          lng: selected.lng,
          google_place_id: selected.placeId,
          entdeckt_urlaub_id: vacationId ?? null,
        }),
      })
      const data = (await res.json()) as ApiResponse<Rastplatz>
      if (!data.success || !data.data) {
        toast.error(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      toast.success(bewertung === 'empfehlung' ? 'Empfehlung gespeichert' : 'No-Go gespeichert')
      try {
        await cacheRastplatz(data.data)
      } catch {
        /* ignore */
      }
      onSaved?.(data.data)
      onDismiss()
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-card border shadow-lg rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            Rast erfassen?
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Suche Ort in der Nähe…</p>}

        {!loading && selected && (
          <div>
            <button
              type="button"
              className="w-full text-left flex items-center justify-between gap-2"
              onClick={() => places.length > 1 && setShowPicker(!showPicker)}
            >
              <span className="font-medium truncate">{selected.name}</span>
              {places.length > 1 && <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>
            <p className="text-xs text-muted-foreground truncate">{selected.address}</p>
            {showPicker && places.length > 1 && (
              <div className="mt-2 border rounded-md max-h-32 overflow-y-auto">
                {places.map((p, i) => (
                  <button
                    key={`${p.lat}-${p.lng}-${i}`}
                    type="button"
                    className={cn(
                      'w-full text-left px-2 py-1.5 text-sm hover:bg-muted',
                      i === selectedIdx && 'bg-muted font-medium'
                    )}
                    onClick={() => {
                      setSelectedIdx(i)
                      setShowPicker(false)
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && !selected && (
          <p className="text-sm text-muted-foreground">
            Kein passender Ort gefunden. Später unter Rastplätze manuell anlegen.
          </p>
        )}

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-green-700 hover:bg-green-800"
            disabled={saving || !selected}
            onClick={() => void save('empfehlung')}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Empfehlung
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={saving || !selected}
            onClick={() => void save('no_go')}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            No-Go
          </Button>
        </div>

        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => setShowMerkmale(!showMerkmale)}
        >
          Merkmale {showMerkmale ? 'ausblenden' : 'optional'}
        </button>

        {showMerkmale && (
          <div className="flex flex-wrap gap-1">
            {RASTPLATZ_MERKMALE.slice(0, 8).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setMerkmale((prev) =>
                    prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                  )
                }
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full border',
                  merkmale.includes(m.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
