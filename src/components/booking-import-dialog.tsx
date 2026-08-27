'use client'

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import {
  bookingChangesByField,
  mergeStayBookingFields,
  stayToBookingFields,
  type BookingFieldChange,
} from '@/lib/booking-merge'
import { invalidateBookingImportBadgeCache } from '@/hooks/use-booking-import-badge'
import { formatBookingMoney, parseBookingMoneyInput } from '@/lib/booking-format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ChevronDown, History, Loader2, Sparkles } from 'lucide-react'
import { Input as InputComponent } from '@/components/ui/input'
import { Textarea as TextareaComponent } from '@/components/ui/textarea'
import { SelectTrigger as SelectTriggerComponent } from '@/components/ui/select'

const CHANGED_FIELD_RING =
  'ring-2 ring-accent-orange border-accent-orange focus-visible:ring-accent-orange'

function applyChangedRing(node: ReactNode, changed: boolean): ReactNode {
  if (!changed || !isValidElement(node)) return node
  const el = node as ReactElement<{
    className?: string
    children?: ReactNode
    highlighted?: boolean
  }>
  if (
    el.type === InputComponent ||
    el.type === TextareaComponent ||
    el.type === SelectTriggerComponent
  ) {
    return cloneElement(el, {
      className: cn(el.props.className, CHANGED_FIELD_RING),
    })
  }
  if ((el.type as { displayName?: string }).displayName === 'CurrencyInput') {
    return cloneElement(el, { highlighted: true })
  }
  const childNodes = el.props.children
  if (childNodes != null) {
    const mapped = Children.map(childNodes, (child) => applyChangedRing(child, changed))
    return cloneElement(el, {}, mapped)
  }
  return node
}

function CurrencyInput({
  value,
  currency,
  onChange,
  className,
  highlighted = false,
}: {
  value: number | null | undefined
  currency?: string | null
  onChange: (value: number | null) => void
  className?: string
  highlighted?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const displayValue = focused
    ? draft
    : value != null && Number.isFinite(value)
      ? formatBookingMoney(value, currency)
      : ''

  return (
    <Input
      inputMode="decimal"
      className={cn(className, highlighted && CHANGED_FIELD_RING)}
      value={displayValue}
      onFocus={() => {
        setFocused(true)
        setDraft(value != null && Number.isFinite(value) ? String(value) : '')
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseBookingMoneyInput(draft)
        onChange(parsed)
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        const parsed = parseBookingMoneyInput(e.target.value)
        if (parsed != null) onChange(parsed)
        else if (!e.target.value.trim()) onChange(null)
      }}
    />
  )
}
CurrencyInput.displayName = 'CurrencyInput'

function ImportSectionHeader({
  title,
  count,
  open,
}: {
  title: string
  count?: number
  open?: boolean
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="h-5 w-1 shrink-0 rounded-full bg-accent-orange" aria-hidden />
        <span className="font-semibold text-sm text-foreground tracking-tight">{title}</span>
        {count != null && count > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-orange px-1.5 text-[10px] font-semibold text-white tabular-nums">
            {count}
          </span>
        )}
      </div>
      {open != null && (
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      )}
    </div>
  )
}

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

function isBookingFieldVisible(
  field: keyof StayBookingFields,
  booking: StayBookingFields,
  change?: BookingFieldChange
): boolean {
  const always = new Set<keyof StayBookingFields>([
    'platznummer',
    'buchungsnummer',
    'buchungsstatus',
  ])
  if (always.has(field)) return true
  if (change) return true
  const value = booking[field]
  if (value == null) return false
  if (typeof value === 'number') return Number.isFinite(value)
  return String(value).trim() !== ''
}

function PreviousValuePopover({
  previousValue,
  onKeepPrevious,
}: {
  previousValue: string
  onKeepPrevious?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-accent-orange hover:bg-accent-orange/10"
          aria-label={`Vorheriger Wert: ${previousValue}`}
          title={`Vorher: ${previousValue}`}
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto p-2.5">
        <p className="text-xs text-muted-foreground">
          Vorher: <span className="font-medium text-foreground">{previousValue}</span>
        </p>
        {onKeepPrevious && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 w-full text-xs"
            onClick={() => {
              onKeepPrevious()
              setOpen(false)
            }}
          >
            Alten Wert behalten
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function ImportField({
  label,
  change,
  onKeepPrevious,
  children,
}: {
  label: string
  change?: BookingFieldChange
  onKeepPrevious?: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 min-h-5">
        <Label>{label}</Label>
        {change && (
          <PreviousValuePopover
            previousValue={change.previous}
            onKeepPrevious={onKeepPrevious}
          />
        )}
      </div>
      {applyChangedRing(children, !!change)}
    </div>
  )
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
  const [existingBooking, setExistingBooking] = useState<StayBookingFields | null>(null)
  const [pasteBetreff, setPasteBetreff] = useState('')
  const [pasteInhalt, setPasteInhalt] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiMeta, setAiMeta] = useState<AiAnalyzeMeta | null>(null)
  const [saving, setSaving] = useState(false)

  const applyBookingForStay = useCallback(
    (stay: VacationCampingStay | null | undefined, parsedFields: ParsedBookingFields | null) => {
      const incoming = parsedToBooking(parsedFields)
      if (!stay) {
        setExistingBooking(null)
        setBooking(incoming)
        return
      }
      const existing = stayToBookingFields(stay)
      const { merged } = mergeStayBookingFields(existing, incoming)
      setExistingBooking(existing)
      setBooking(merged)
    },
    []
  )

  const parsedBooking = useMemo(() => parsedToBooking(parsed), [parsed])

  const bookingSavePreview = useMemo(() => {
    if (!existingBooking || stayId === '_new') return null
    return mergeStayBookingFields(existingBooking, booking)
  }, [existingBooking, booking, stayId])

  const bookingChanges = useMemo(
    () => bookingChangesByField(bookingSavePreview),
    [bookingSavePreview]
  )

  const selectedStay = useMemo(
    () => (stayId === '_new' ? null : stays.find((s) => s.id === stayId) ?? null),
    [stayId, stays]
  )

  const dateRangeChanged =
    selectedStay != null &&
    ((startDatum && selectedStay.start_datum && startDatum !== selectedStay.start_datum) ||
      (endDatum && selectedStay.end_datum && endDatum !== selectedStay.end_datum))

  const onlyEmailLink =
    stayId !== '_new' &&
    bookingSavePreview != null &&
    bookingSavePreview.changes.length === 0 &&
    !dateRangeChanged

  const revertBookingField = useCallback(
    (field: keyof StayBookingFields) => {
      if (!existingBooking) return
      const previous = existingBooking[field]
      setBooking((b) => ({
        ...b,
        [field]:
          previous ??
          (field === 'preis_gesamt' || field === 'anzahlung_betrag'
            ? null
            : field === 'buchungsstatus'
              ? null
              : ''),
      }))
    },
    [existingBooking]
  )

  const revertDateRange = useCallback(() => {
    if (!selectedStay) return
    setStartDatum(selectedStay.start_datum ?? '')
    setEndDatum(selectedStay.end_datum ?? '')
  }, [selectedStay])

  const handleStayChange = useCallback(
    (id: string) => {
      setStayId(id)
      if (id === '_new') {
        setExistingBooking(null)
        setBooking(parsedBooking)
        return
      }
      const stay = stays.find((s) => s.id === id)
      applyBookingForStay(stay, parsed)
      setStartDatum(parsed?.start_datum ?? stay?.start_datum ?? '')
      setEndDatum(parsed?.end_datum ?? stay?.end_datum ?? '')
    },
    [applyBookingForStay, parsed, parsedBooking, stays]
  )

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
      setEmailTyp(data.parsed.email_typ ?? 'buchungsbestaetigung')
      if (data.vacations) setVacations(data.vacations)
      if (data.stays) setStays(data.stays)
      if (data.ai_meta) setAiMeta(data.ai_meta)
      if (data.suggestion?.urlaub_id) setUrlaubId(data.suggestion.urlaub_id)
      else if (initialUrlaubId) setUrlaubId(initialUrlaubId)
      const nextStayId = data.suggestion?.stay_id ?? '_new'
      setStayId(nextStayId)
      if (data.suggestion?.campingplatz_id) setCampingplatzId(data.suggestion.campingplatz_id)
      const matchedStay =
        nextStayId !== '_new'
          ? data.stays?.find((s) => s.id === nextStayId)
          : undefined
      applyBookingForStay(matchedStay, data.parsed)
      setStartDatum(
        data.parsed.start_datum ??
          matchedStay?.start_datum ??
          data.suggestion?.suggested_start_datum ??
          ''
      )
      setEndDatum(
        data.parsed.end_datum ??
          matchedStay?.end_datum ??
          data.suggestion?.suggested_end_datum ??
          ''
      )
    },
    [initialUrlaubId, applyBookingForStay]
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
      setEmailTyp(p?.email_typ ?? 'buchungsbestaetigung')
      const nextStayId = s?.stay_id ?? '_new'
      setUrlaubId(
        s?.urlaub_id ??
          pending.vorgeschlagener_urlaub_id ??
          initialUrlaubId ??
          v[0]?.id ??
          ''
      )
      setStayId(nextStayId)
      setCampingplatzId(s?.campingplatz_id ?? '')
      const matchedStay =
        nextStayId !== '_new' ? st.find((stay) => stay.id === nextStayId) : undefined
      applyBookingForStay(matchedStay, p)
      setStartDatum(
        p?.start_datum ?? matchedStay?.start_datum ?? s?.suggested_start_datum ?? ''
      )
      setEndDatum(p?.end_datum ?? matchedStay?.end_datum ?? s?.suggested_end_datum ?? '')
    } finally {
      setLoading(false)
    }
  }, [initialUrlaubId, applyBookingForStay])

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
    if (initialBetreff || initialInhalt) setManualOpen(true)
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
        <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
          <section className="rounded-xl border bg-muted/20 overflow-hidden">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
              >
                <ImportSectionHeader title="Manuell einfügen" open={manualOpen} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 border-t border-border/60 px-4 py-4 bg-card/80">
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
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading || aiAnalyzing}
                    onClick={() => void analyzePaste()}
                  >
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
                  <Button
                    type="button"
                    disabled={loading || aiAnalyzing}
                    onClick={() => void createFromPaste()}
                  >
                    Import anlegen
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>

        {pendingList.length > 0 && (
          <section className="rounded-xl border bg-muted/20 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border/60 bg-card/60">
              <ImportSectionHeader title="Ausstehende Imports" count={pendingList.length} />
            </div>
            <ul className="divide-y divide-border/60 bg-card/80">
              {pendingList.map((p) => (
                <li key={p.id} className="py-2.5 px-4 flex items-start gap-2">
                  <button
                    type="button"
                    className="flex-1 text-left text-sm hover:underline min-w-0"
                    onClick={() => void loadPending(p.id)}
                  >
                    <span className="font-medium block truncate">{p.betreff ?? '(Ohne Betreff)'}</span>
                    <span className="block text-xs text-muted-foreground truncate">{p.absender}</span>
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
                  <Select value={stayId} onValueChange={handleStayChange}>
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
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 min-h-5">
                    <Label>Zeitraum</Label>
                    {dateRangeChanged && selectedStay && (
                      <PreviousValuePopover
                        previousValue={`${selectedStay.start_datum ?? '—'} – ${selectedStay.end_datum ?? '—'}`}
                        onKeepPrevious={revertDateRange}
                      />
                    )}
                  </div>
                  <StayDateRangePicker
                    startDatum={startDatum}
                    endDatum={endDatum}
                    onChange={(start, end) => {
                      setStartDatum(start)
                      setEndDatum(end)
                    }}
                    dialogTitle="Zeitraum wählen"
                    emptyLabel="Zeitraum wählen"
                    buttonClassName={dateRangeChanged ? CHANGED_FIELD_RING : undefined}
                  />
                </div>
                {onlyEmailLink && (
                  <p className="text-xs text-muted-foreground">
                    Keine Buchungsfelder ändern sich – diese E-Mail wird nur verknüpft.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {isBookingFieldVisible('platznummer', booking, bookingChanges.platznummer) && (
                    <ImportField
                      label="Platznummer"
                      change={bookingChanges.platznummer}
                      onKeepPrevious={
                        bookingChanges.platznummer
                          ? () => revertBookingField('platznummer')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.platznummer ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, platznummer: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('buchungsnummer', booking, bookingChanges.buchungsnummer) && (
                    <ImportField
                      label="Buchungsnummer"
                      change={bookingChanges.buchungsnummer}
                      onKeepPrevious={
                        bookingChanges.buchungsnummer
                          ? () => revertBookingField('buchungsnummer')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.buchungsnummer ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, buchungsnummer: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('buchungsstatus', booking, bookingChanges.buchungsstatus) && (
                    <ImportField
                      label="Status"
                      change={bookingChanges.buchungsstatus}
                      onKeepPrevious={
                        bookingChanges.buchungsstatus
                          ? () => revertBookingField('buchungsstatus')
                          : undefined
                      }
                    >
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
                    </ImportField>
                  )}
                  <ImportField label="E-Mail-Typ">
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
                  </ImportField>
                  {isBookingFieldVisible('checkin_zeit', booking, bookingChanges.checkin_zeit) && (
                    <ImportField
                      label="Check-in"
                      change={bookingChanges.checkin_zeit}
                      onKeepPrevious={
                        bookingChanges.checkin_zeit
                          ? () => revertBookingField('checkin_zeit')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.checkin_zeit ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, checkin_zeit: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('checkout_zeit', booking, bookingChanges.checkout_zeit) && (
                    <ImportField
                      label="Check-out"
                      change={bookingChanges.checkout_zeit}
                      onKeepPrevious={
                        bookingChanges.checkout_zeit
                          ? () => revertBookingField('checkout_zeit')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.checkout_zeit ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, checkout_zeit: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('unterkunftstyp', booking, bookingChanges.unterkunftstyp) && (
                    <ImportField
                      label="Unterkunftstyp"
                      change={bookingChanges.unterkunftstyp}
                      onKeepPrevious={
                        bookingChanges.unterkunftstyp
                          ? () => revertBookingField('unterkunftstyp')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.unterkunftstyp ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, unterkunftstyp: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('kontakt_platz', booking, bookingChanges.kontakt_platz) && (
                    <ImportField
                      label="Kontakt Platz"
                      change={bookingChanges.kontakt_platz}
                      onKeepPrevious={
                        bookingChanges.kontakt_platz
                          ? () => revertBookingField('kontakt_platz')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.kontakt_platz ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, kontakt_platz: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('zugangscode', booking, bookingChanges.zugangscode) && (
                    <ImportField
                      label="Zugangscode"
                      change={bookingChanges.zugangscode}
                      onKeepPrevious={
                        bookingChanges.zugangscode
                          ? () => revertBookingField('zugangscode')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.zugangscode ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, zugangscode: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('preis_gesamt', booking, bookingChanges.preis_gesamt) && (
                    <ImportField
                      label="Preis gesamt"
                      change={bookingChanges.preis_gesamt}
                      onKeepPrevious={
                        bookingChanges.preis_gesamt
                          ? () => revertBookingField('preis_gesamt')
                          : undefined
                      }
                    >
                      <CurrencyInput
                        value={booking.preis_gesamt}
                        currency={booking.waehrung}
                        onChange={(preis_gesamt) => setBooking((b) => ({ ...b, preis_gesamt }))}
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('anzahlung_betrag', booking, bookingChanges.anzahlung_betrag) && (
                    <ImportField
                      label="Anzahlung"
                      change={bookingChanges.anzahlung_betrag}
                      onKeepPrevious={
                        bookingChanges.anzahlung_betrag
                          ? () => revertBookingField('anzahlung_betrag')
                          : undefined
                      }
                    >
                      <CurrencyInput
                        value={booking.anzahlung_betrag}
                        currency={booking.waehrung}
                        onChange={(anzahlung_betrag) =>
                          setBooking((b) => ({ ...b, anzahlung_betrag }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible(
                    'restzahlung_faellig_am',
                    booking,
                    bookingChanges.restzahlung_faellig_am
                  ) && (
                    <ImportField
                      label="Restzahlung fällig"
                      change={bookingChanges.restzahlung_faellig_am}
                      onKeepPrevious={
                        bookingChanges.restzahlung_faellig_am
                          ? () => revertBookingField('restzahlung_faellig_am')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.restzahlung_faellig_am ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, restzahlung_faellig_am: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible('buchungsdatum', booking, bookingChanges.buchungsdatum) && (
                    <ImportField
                      label="Buchungsdatum"
                      change={bookingChanges.buchungsdatum}
                      onKeepPrevious={
                        bookingChanges.buchungsdatum
                          ? () => revertBookingField('buchungsdatum')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.buchungsdatum ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, buchungsdatum: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
                  {isBookingFieldVisible(
                    'stornierungsfrist',
                    booking,
                    bookingChanges.stornierungsfrist
                  ) && (
                    <ImportField
                      label="Stornierungsfrist"
                      change={bookingChanges.stornierungsfrist}
                      onKeepPrevious={
                        bookingChanges.stornierungsfrist
                          ? () => revertBookingField('stornierungsfrist')
                          : undefined
                      }
                    >
                      <Input
                        value={booking.stornierungsfrist ?? ''}
                        onChange={(e) =>
                          setBooking((b) => ({ ...b, stornierungsfrist: e.target.value }))
                        }
                      />
                    </ImportField>
                  )}
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
