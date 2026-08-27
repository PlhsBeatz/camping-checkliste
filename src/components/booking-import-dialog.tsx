'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { StayDateRangePicker } from '@/components/stay-date-range-picker'
import type { ApiResponse } from '@/lib/api-types'
import type { Vacation, VacationCampingStay, Campingplatz } from '@/lib/db'
import type {
  BookingImportPending,
  CampingStayEmailTyp,
  ParsedBookingFields,
  StayBookingFields,
  Buchungsstatus,
} from '@/lib/booking-types'
import {
  BUCHUNGSSTATUS_LABELS,
  BUCHUNGSSTATUS_OPTIONS,
  EMAIL_TYP_LABELS,
} from '@/lib/booking-types'
import type { StayMatchSuggestion } from '@/lib/booking-stay-matcher'
import { invalidateBookingImportBadgeCache } from '@/hooks/use-booking-import-badge'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'

type AiAnalyzeMeta = {
  pdfs_used: string[]
  pdfs_skipped: Array<{ filename: string; reason: string }>
  model: string
}

function parsedToBooking(parsed: ParsedBookingFields | null): StayBookingFields {
  if (!parsed) return {}
  return {
    platznummer: parsed.platznummer ?? '',
    buchungsnummer: parsed.buchungsnummer ?? '',
    buchungsstatus: parsed.buchungsstatus ?? null,
    checkin_zeit: parsed.checkin_zeit ?? '',
    checkout_zeit: parsed.checkout_zeit ?? '',
    zugangscode: parsed.zugangscode ?? '',
    unterkunftstyp: parsed.unterkunftstyp ?? '',
    preis_gesamt: parsed.preis_gesamt ?? null,
    waehrung: parsed.waehrung ?? 'EUR',
    anzahlung_betrag: parsed.anzahlung_betrag ?? null,
    restzahlung_faellig_am: parsed.restzahlung_faellig_am ?? '',
    buchungsdatum: parsed.buchungsdatum ?? '',
    stornierungsfrist: parsed.stornierungsfrist ?? '',
    kontakt_platz: parsed.kontakt_platz ?? '',
  }
}

export type BookingImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPendingId?: string | null
  initialUrlaubId?: string | null
  initialBetreff?: string
  initialInhalt?: string
  pendingCount?: number
  onConfirmed?: () => void
}

export function BookingImportDialog({
  open,
  onOpenChange,
  initialPendingId = null,
  initialUrlaubId = null,
  initialBetreff = '',
  initialInhalt = '',
  pendingCount = 0,
  onConfirmed,
}: BookingImportDialogProps) {
  const [pendingList, setPendingList] = useState<BookingImportPending[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedBookingFields | null>(null)
  const [suggestion, setSuggestion] = useState<StayMatchSuggestion | null>(null)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [stays, setStays] = useState<VacationCampingStay[]>([])
  const [urlaubId, setUrlaubId] = useState('')
  const [stayId, setStayId] = useState<string>('_new')
  const [campingplatzId, setCampingplatzId] = useState('')
  const [startDatum, setStartDatum] = useState('')
  const [endDatum, setEndDatum] = useState('')
  const [emailTyp, setEmailTyp] = useState<CampingStayEmailTyp>('buchungsbestaetigung')
  const [booking, setBooking] = useState<StayBookingFields>({})
  const [pasteBetreff, setPasteBetreff] = useState('')
  const [pasteInhalt, setPasteInhalt] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiMeta, setAiMeta] = useState<AiAnalyzeMeta | null>(null)
  const [saving, setSaving] = useState(false)

  const applyAnalysisResult = useCallback(
    (data: {
      parsed: ParsedBookingFields
      suggestion: StayMatchSuggestion | null
      vacations?: Vacation[]
      stays?: VacationCampingStay[]
      ai_meta?: AiAnalyzeMeta
    }) => {
      setParsed(data.parsed)
      setSuggestion(data.suggestion)
      setBooking(parsedToBooking(data.parsed))
      setEmailTyp(data.parsed.email_typ ?? 'buchungsbestaetigung')
      if (data.vacations) setVacations(data.vacations)
      if (data.stays) setStays(data.stays)
      if (data.ai_meta) setAiMeta(data.ai_meta)
      if (data.suggestion?.urlaub_id) setUrlaubId(data.suggestion.urlaub_id)
      else if (initialUrlaubId) setUrlaubId(initialUrlaubId)
      if (data.suggestion?.stay_id) setStayId(data.suggestion.stay_id)
      if (data.suggestion?.campingplatz_id) setCampingplatzId(data.suggestion.campingplatz_id)
      setStartDatum(
        data.parsed.start_datum ?? data.suggestion?.suggested_start_datum ?? ''
      )
      setEndDatum(data.parsed.end_datum ?? data.suggestion?.suggested_end_datum ?? '')
    },
    [initialUrlaubId]
  )

  const loadList = useCallback(async () => {
    const res = await fetch('/api/booking-import')
    const data = (await res.json()) as ApiResponse<{ list: BookingImportPending[] }>
    if (data.success && data.data) setPendingList(data.data.list)
  }, [])

  const loadPending = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/booking-import?id=${encodeURIComponent(id)}`)
      const data = (await res.json()) as ApiResponse<{
        pending: BookingImportPending
        parsed: ParsedBookingFields
        suggestion: StayMatchSuggestion | null
        vacations: Vacation[]
        stays: VacationCampingStay[]
      }>
      if (!data.success || !data.data) return
      const { pending, parsed: p, suggestion: s, vacations: v, stays: st } = data.data
      setSelectedId(pending.id)
      setParsed(p)
      setSuggestion(s)
      setVacations(v)
      setStays(st)
      setBooking(parsedToBooking(p))
      setEmailTyp(p?.email_typ ?? 'buchungsbestaetigung')
      setUrlaubId(
        s?.urlaub_id ??
          pending.vorgeschlagener_urlaub_id ??
          initialUrlaubId ??
          v[0]?.id ??
          ''
      )
      setStayId(s?.stay_id ?? '_new')
      setCampingplatzId(s?.campingplatz_id ?? '')
      setStartDatum(p?.start_datum ?? s?.suggested_start_datum ?? '')
      setEndDatum(p?.end_datum ?? s?.suggested_end_datum ?? '')
    } finally {
      setLoading(false)
    }
  }, [initialUrlaubId])

  useEffect(() => {
    if (!open) return
    void loadList()
  }, [open, loadList])

  useEffect(() => {
    if (!open || !initialUrlaubId || initialPendingId) return
    setUrlaubId(initialUrlaubId)
    void (async () => {
      const vacRes = await fetch('/api/vacations')
      const vacData = (await vacRes.json()) as ApiResponse<Vacation[]>
      if (vacData.success && vacData.data) setVacations(vacData.data)
    })()
  }, [open, initialUrlaubId, initialPendingId])

  useEffect(() => {
    if (!open) return
    if (initialBetreff) setPasteBetreff(initialBetreff)
    if (initialInhalt) setPasteInhalt(initialInhalt)
  }, [open, initialBetreff, initialInhalt])

  useEffect(() => {
    if (!open || !initialPendingId) return
    void loadPending(initialPendingId)
  }, [open, initialPendingId, loadPending])

  useEffect(() => {
    if (!urlaubId) {
      setStays([])
      return
    }
    void (async () => {
      const res = await fetch(`/api/vacations/${urlaubId}`)
      const data = (await res.json()) as ApiResponse<{ stays?: VacationCampingStay[] }>
      if (data.success && data.data) setStays(data.data.stays ?? [])
    })()
  }, [urlaubId])

  const analyzePaste = async () => {
    if (!pasteInhalt.trim()) {
      toast.error('Bitte E-Mail-Text einfügen')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/booking-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          betreff: pasteBetreff,
          inhalt: pasteInhalt,
        }),
      })
      const data = (await res.json()) as ApiResponse<{
        parsed: ParsedBookingFields
        suggestion: StayMatchSuggestion | null
      }>
      if (!data.success || !data.data) {
        toast.error('Analyse fehlgeschlagen')
        return
      }
      setSelectedId(null)
      setAiMeta(null)
      applyAnalysisResult(data.data)
      const vacRes = await fetch('/api/vacations')
      const vacData = (await vacRes.json()) as ApiResponse<Vacation[]>
      if (vacData.success && vacData.data) setVacations(vacData.data)
    } finally {
      setLoading(false)
    }
  }

  const analyzeWithAi = async () => {
    const inhalt = pasteInhalt.trim()
    if (!selectedId && !inhalt) {
      toast.error('Bitte E-Mail-Text einfügen oder einen ausstehenden Import wählen')
      return
    }
    setAiAnalyzing(true)
    try {
      const res = await fetch('/api/booking-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze-ai',
          pending_id: selectedId ?? undefined,
          betreff: pasteBetreff || undefined,
          inhalt: selectedId ? undefined : inhalt,
        }),
      })
      const data = (await res.json()) as ApiResponse<{
        parsed: ParsedBookingFields
        suggestion: StayMatchSuggestion | null
        vacations: Vacation[]
        stays: VacationCampingStay[]
        ai_meta: AiAnalyzeMeta
      }>
      if (!data.success || !data.data) {
        toast.error(data.error ?? 'KI-Analyse fehlgeschlagen')
        return
      }
      applyAnalysisResult(data.data)
      const meta = data.data.ai_meta
      const pdfInfo =
        meta.pdfs_used.length > 0
          ? `${meta.pdfs_used.length} PDF(s) ausgewertet`
          : selectedId
            ? 'ohne PDF (keine .eml in R2)'
            : 'nur E-Mail-Text'
      const skipped =
        meta.pdfs_skipped.length > 0 ? `, ${meta.pdfs_skipped.length} übersprungen` : ''
      toast.success(`KI-Analyse fertig (${pdfInfo}${skipped})`)
    } finally {
      setAiAnalyzing(false)
    }
  }

  const createFromPaste = async () => {
    if (!pasteInhalt.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/booking-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betreff: pasteBetreff, inhalt: pasteInhalt }),
      })
      const data = (await res.json()) as ApiResponse<{
        pending: BookingImportPending
        parsed: ParsedBookingFields
        suggestion: StayMatchSuggestion | null
      }>
      if (!data.success || !data.data) {
        toast.error('Import fehlgeschlagen')
        return
      }
      invalidateBookingImportBadgeCache()
      await loadList()
      await loadPending(data.data.pending.id)
      toast.success('Import angelegt – bitte prüfen und speichern')
    } finally {
      setLoading(false)
    }
  }

  const confirm = async () => {
    if (!selectedId || !urlaubId) {
      toast.error('Urlaub auswählen')
      return
    }
    if (stayId === '_new' && !campingplatzId) {
      toast.error('Campingplatz auswählen oder bestehenden Aufenthalt wählen')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/booking-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          pending_id: selectedId,
          urlaub_id: urlaubId,
          stay_id: stayId === '_new' ? null : stayId,
          campingplatz_id: stayId === '_new' ? campingplatzId : null,
          start_datum: startDatum || null,
          end_datum: endDatum || null,
          email_typ: emailTyp,
          booking,
        }),
      })
      const data = (await res.json()) as ApiResponse<{ stay_id: string }>
      if (!data.success) {
        toast.error('Speichern fehlgeschlagen')
        return
      }
      invalidateBookingImportBadgeCache()
      await loadList()
      toast.success('Buchung gespeichert')
      setSelectedId(null)
      onConfirmed?.()
    } finally {
      setSaving(false)
    }
  }

  const dismiss = async (id: string) => {
    await fetch('/api/booking-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', pending_id: id }),
    })
    invalidateBookingImportBadgeCache()
    await loadList()
    if (selectedId === id) setSelectedId(null)
  }

  const campingplatzOptions = useMemo(() => {
    const fromStays = stays.map((s) => s.campingplatz)
    const seen = new Set<string>()
    return fromStays.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [stays])

  const titleSuffix =
    pendingCount > 0 || pendingList.length > 0
      ? ` (${pendingList.length || pendingCount})`
      : ''

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Buchung importieren${titleSuffix}`}
      description="E-Mail-Inhalt einfügen oder ausstehende Weiterleitungen prüfen."
      contentClassName="max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-4 pb-2">
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-medium text-sm">Manuell einfügen</h2>
          <div>
            <Label>Betreff (optional)</Label>
            <Input value={pasteBetreff} onChange={(e) => setPasteBetreff(e.target.value)} />
          </div>
          <div>
            <Label>E-Mail-Text</Label>
            <Textarea
              className="min-h-[100px] font-mono text-xs"
              value={pasteInhalt}
              onChange={(e) => setPasteInhalt(e.target.value)}
              placeholder="Text aus Gmail kopieren und hier einfügen…"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" disabled={loading || aiAnalyzing} onClick={() => void analyzePaste()}>
              Analysieren
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || aiAnalyzing}
              onClick={() => void analyzeWithAi()}
            >
              {aiAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  KI analysiert…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Mit KI analysieren
                </>
              )}
            </Button>
            <Button type="button" disabled={loading || aiAnalyzing} onClick={() => void createFromPaste()}>
              Import anlegen
            </Button>
          </div>
        </section>

        {pendingList.length > 0 && (
          <section className="rounded-xl border bg-card p-4 space-y-2">
            <h2 className="font-medium text-sm">Ausstehende Imports ({pendingList.length})</h2>
            <ul className="divide-y">
              {pendingList.map((p) => (
                <li key={p.id} className="py-2 flex items-start gap-2">
                  <button
                    type="button"
                    className="flex-1 text-left text-sm hover:underline"
                    onClick={() => void loadPending(p.id)}
                  >
                    <span className="font-medium">{p.betreff ?? '(Ohne Betreff)'}</span>
                    <span className="block text-xs text-muted-foreground">{p.absender}</span>
                  </button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void dismiss(p.id)}>
                    Verwerfen
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(selectedId || parsed) && (
          <section className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-medium">Review</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loading || aiAnalyzing}
                onClick={() => void analyzeWithAi()}
              >
                {aiAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    KI analysiert…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Mit KI analysieren
                  </>
                )}
              </Button>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {aiMeta && (
                  <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-2 py-1.5">
                    KI ({aiMeta.model}):{' '}
                    {aiMeta.pdfs_used.length > 0
                      ? `${aiMeta.pdfs_used.length} PDF(s): ${aiMeta.pdfs_used.join(', ')}`
                      : 'keine PDFs ausgewertet'}
                    {aiMeta.pdfs_skipped.length > 0 &&
                      ` · übersprungen: ${aiMeta.pdfs_skipped.map((s) => `${s.filename} (${s.reason})`).join('; ')}`}
                  </p>
                )}
                {suggestion && (
                  <p className="text-xs text-muted-foreground">
                    Vorschlag: {suggestion.urlaub_titel} ({suggestion.confidence})
                  </p>
                )}
                <div>
                  <Label>Urlaub</Label>
                  <Select value={urlaubId} onValueChange={setUrlaubId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Urlaub wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {vacations.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.titel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Aufenthalt</Label>
                  <Select value={stayId} onValueChange={setStayId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_new">Neuer Aufenthalt</SelectItem>
                      {stays.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.campingplatz.name} ({s.start_datum ?? '—'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {stayId === '_new' && (
                  <div>
                    <Label>Campingplatz</Label>
                    <Select value={campingplatzId} onValueChange={setCampingplatzId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Platz wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {campingplatzOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}, {c.ort}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Zeitraum</Label>
                  <StayDateRangePicker
                    startDatum={startDatum}
                    endDatum={endDatum}
                    onChange={(start, end) => {
                      setStartDatum(start)
                      setEndDatum(end)
                    }}
                    dialogTitle="Zeitraum wählen"
                    emptyLabel="Zeitraum wählen"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Platznummer</Label>
                    <Input
                      value={booking.platznummer ?? ''}
                      onChange={(e) => setBooking((b) => ({ ...b, platznummer: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Buchungsnummer</Label>
                    <Input
                      value={booking.buchungsnummer ?? ''}
                      onChange={(e) => setBooking((b) => ({ ...b, buchungsnummer: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={booking.buchungsstatus ?? '_none'}
                      onValueChange={(v) =>
                        setBooking((b) => ({
                          ...b,
                          buchungsstatus: v === '_none' ? null : (v as Buchungsstatus),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {BUCHUNGSSTATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {BUCHUNGSSTATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>E-Mail-Typ</Label>
                    <Select
                      value={emailTyp}
                      onValueChange={(v) => setEmailTyp(v as CampingStayEmailTyp)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EMAIL_TYP_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedId && (
                  <div className="flex gap-2">
                    <Button type="button" disabled={saving} onClick={() => void confirm()}>
                      {saving ? 'Speichern…' : 'Speichern'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void dismiss(selectedId)}>
                      Verwerfen
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <section className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-sm text-foreground">Gmail-Weiterleitung</p>
          <p>
            Buchungsmails an <strong>buchung@andi-melli.de</strong> weiterleiten (Cloudflare Email
            Routing → Worker).
          </p>
        </section>
      </div>
    </ResponsiveModal>
  )
}
