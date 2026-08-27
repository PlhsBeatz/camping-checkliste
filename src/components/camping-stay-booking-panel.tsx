'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { VacationCampingStay } from '@/lib/db'
import type { UrlaubCampingplatzEmail } from '@/lib/booking-types'
import {
  BUCHUNGSSTATUS_LABELS,
  BUCHUNGSSTATUS_OPTIONS,
  EMAIL_TYP_LABELS,
  type Buchungsstatus,
  type StayBookingFields,
} from '@/lib/booking-types'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Copy, ExternalLink, Mail } from 'lucide-react'
import { buildPlatzplanUrl } from '@/lib/platzplan-url'
import { useBottomToast } from '@/components/undo-toast'
import { CurrencyInput } from '@/components/currency-input'
import { formatBookingMoney } from '@/lib/booking-format'
import { formatCalendarDateDe } from '@/lib/booking-stay-dates'
import { toast } from 'sonner'

type Props = {
  stay: VacationCampingStay
  emails?: UrlaubCampingplatzEmail[]
  canEdit?: boolean
  onSaved?: () => void
  /** In Urlaub-Detail-Karte: nur Details ohne Summary/Rahmen */
  variant?: 'standalone' | 'expanded-details'
}

function BookingDetailsReadonly({
  stay,
  className,
}: {
  stay: VacationCampingStay
  className?: string
}) {
  const currency = stay.waehrung ?? 'EUR'
  return (
    <dl className={cn('grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm', className)}>
      {stay.preis_gesamt != null && Number.isFinite(stay.preis_gesamt) && (
        <div>
          <dt className="text-xs text-muted-foreground">Preis gesamt</dt>
          <dd className="font-medium tabular-nums">
            {formatBookingMoney(stay.preis_gesamt, currency)}
          </dd>
        </div>
      )}
      {stay.anzahlung_betrag != null && Number.isFinite(stay.anzahlung_betrag) && (
        <div>
          <dt className="text-xs text-muted-foreground">Anzahlung</dt>
          <dd className="font-medium tabular-nums">
            {formatBookingMoney(stay.anzahlung_betrag, currency)}
          </dd>
        </div>
      )}
      {stay.restzahlung_faellig_am && (
        <div>
          <dt className="text-xs text-muted-foreground">Restzahlung fällig</dt>
          <dd className="font-medium">{formatCalendarDateDe(stay.restzahlung_faellig_am)}</dd>
        </div>
      )}
      {stay.checkin_zeit && (
        <div>
          <dt className="text-xs text-muted-foreground">Check-in</dt>
          <dd>{stay.checkin_zeit}</dd>
        </div>
      )}
      {stay.checkout_zeit && (
        <div>
          <dt className="text-xs text-muted-foreground">Check-out</dt>
          <dd>{stay.checkout_zeit}</dd>
        </div>
      )}
      {stay.zugangscode && (
        <div>
          <dt className="text-xs text-muted-foreground">Zugangscode</dt>
          <dd>{stay.zugangscode}</dd>
        </div>
      )}
      {stay.kontakt_platz && (
        <div>
          <dt className="text-xs text-muted-foreground">Kontakt Platz</dt>
          <dd>{stay.kontakt_platz}</dd>
        </div>
      )}
      {Boolean(stay.buchung_abreise_extra_tag) && (
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Abreise Buchung</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-accent-orange/15 text-accent-orange px-2 py-0.5 text-[11px] font-medium">
              +1 Tag länger gebucht
            </span>
            {stay.buchung_end_datum && (
              <span className="text-xs text-muted-foreground">
                Gebucht bis {formatCalendarDateDe(stay.buchung_end_datum)}
              </span>
            )}
          </dd>
        </div>
      )}
      {stay.notizen_buchung && (
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Notizen</dt>
          <dd>{stay.notizen_buchung}</dd>
        </div>
      )}
    </dl>
  )
}

export function CampingStayBookingPanel({
  stay,
  emails = [],
  canEdit = false,
  onSaved,
  variant = 'standalone',
}: Props) {
  const [open, setOpen] = useState(false)
  const isExpandedDetails = variant === 'expanded-details'
  const [saving, setSaving] = useState(false)
  const { showBottomToast, bottomToast } = useBottomToast()
  const [form, setForm] = useState<StayBookingFields>({
    platznummer: stay.platznummer ?? '',
    buchungsnummer: stay.buchungsnummer ?? '',
    buchungsstatus: (stay.buchungsstatus as Buchungsstatus | null) ?? null,
    checkin_zeit: stay.checkin_zeit ?? '',
    checkout_zeit: stay.checkout_zeit ?? '',
    zugangscode: stay.zugangscode ?? '',
    unterkunftstyp: stay.unterkunftstyp ?? '',
    preis_gesamt: stay.preis_gesamt ?? null,
    waehrung: stay.waehrung ?? 'EUR',
    anzahlung_betrag: stay.anzahlung_betrag ?? null,
    restzahlung_faellig_am: stay.restzahlung_faellig_am ?? '',
    buchungsdatum: stay.buchungsdatum ?? '',
    stornierungsfrist: stay.stornierungsfrist ?? '',
    kontakt_platz: stay.kontakt_platz ?? '',
    notizen_buchung: stay.notizen_buchung ?? '',
  })

  const hasBookingDetails =
    stay.preis_gesamt != null ||
    stay.anzahlung_betrag != null ||
    Boolean(stay.restzahlung_faellig_am) ||
    Boolean(stay.checkin_zeit) ||
    Boolean(stay.checkout_zeit) ||
    Boolean(stay.zugangscode) ||
    Boolean(stay.unterkunftstyp) ||
    Boolean(stay.kontakt_platz) ||
    Boolean(stay.notizen_buchung) ||
    Boolean(stay.buchung_abreise_extra_tag)

  const hasBookingSummary =
    Boolean(stay.platznummer || stay.buchungsnummer || stay.buchungsstatus) ||
    hasBookingDetails ||
    emails.length > 0

  const showReadonlyDetails = isExpandedDetails && hasBookingDetails && !canEdit
  const showEditForm = canEdit && (isExpandedDetails || open)

  const platzplanUrl = buildPlatzplanUrl(stay.campingplatz, stay.platznummer)

  const copyPlatznummer = async () => {
    if (!stay.platznummer) return
    try {
      await navigator.clipboard.writeText(stay.platznummer)
      toast.success('Platznummer kopiert')
    } catch {
      toast.error('Kopieren fehlgeschlagen')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/vacations/stays/${stay.id}/booking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          platznummer: form.platznummer || null,
          buchungsnummer: form.buchungsnummer || null,
          checkin_zeit: form.checkin_zeit || null,
          checkout_zeit: form.checkout_zeit || null,
          zugangscode: form.zugangscode || null,
          unterkunftstyp: form.unterkunftstyp || null,
          waehrung: form.waehrung || 'EUR',
          restzahlung_faellig_am: form.restzahlung_faellig_am || null,
          buchungsdatum: form.buchungsdatum || null,
          stornierungsfrist: form.stornierungsfrist || null,
          kontakt_platz: form.kontakt_platz || null,
          notizen_buchung: form.notizen_buchung || null,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!data.success) {
        toast.error(data.error ?? 'Speichern fehlgeschlagen')
        return
      }
      showBottomToast('Buchungsdaten gespeichert')
      onSaved?.()
    } catch {
      toast.error('Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  if (!hasBookingSummary && !canEdit) return null
  if (isExpandedDetails && !hasBookingSummary && !canEdit && emails.length === 0) return null

  const currency = stay.waehrung ?? 'EUR'

  const content = (
    <>
      {isExpandedDetails && hasBookingDetails && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {stay.platznummer && (
            <span>
              Platz <strong className="text-foreground">{stay.platznummer}</strong>
            </span>
          )}
          {stay.buchungsnummer && <span>Buchung: {stay.buchungsnummer}</span>}
          {stay.buchungsstatus && (
            <span>
              {BUCHUNGSSTATUS_LABELS[stay.buchungsstatus as Buchungsstatus] ??
                stay.buchungsstatus}
            </span>
          )}
          {stay.preis_gesamt != null && Number.isFinite(stay.preis_gesamt) && (
            <span className="font-medium text-foreground tabular-nums">
              {formatBookingMoney(stay.preis_gesamt, currency)}
            </span>
          )}
          {Boolean(stay.buchung_abreise_extra_tag) && (
            <span className="inline-flex items-center rounded-full bg-accent-orange/15 text-accent-orange px-2 py-0.5 text-[10px] font-medium">
              +1 Tag Abreise
            </span>
          )}
        </div>
      )}

      {!isExpandedDetails &&
        (stay.platznummer || stay.buchungsnummer || stay.buchungsstatus) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
          {stay.platznummer && (
            <span>
              Platz <strong className="text-foreground">{stay.platznummer}</strong>
            </span>
          )}
          {stay.buchungsnummer && <span>Buchung: {stay.buchungsnummer}</span>}
          {stay.buchungsstatus && (
            <span>
              {BUCHUNGSSTATUS_LABELS[stay.buchungsstatus as Buchungsstatus] ??
                stay.buchungsstatus}
            </span>
          )}
          {stay.kontakt_platz && <span>Kontakt: {stay.kontakt_platz}</span>}
        </div>
      )}

      {emails.length > 0 && !isExpandedDetails && (
        <div className="flex flex-wrap gap-2 mb-2">
          {emails.map((em) => (
            <span
              key={em.id}
              className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] border"
            >
              <Mail className="h-3 w-3" />
              {EMAIL_TYP_LABELS[em.email_typ]}
              {em.gmail_suchlink && (
                <a
                  href={em.gmail_suchlink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-heading hover:underline inline-flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
          ))}
        </div>
      )}

      <div className={cn('flex flex-wrap gap-2', isExpandedDetails && 'hidden')}>
        {platzplanUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            asChild
          >
            <a href={platzplanUrl} target="_blank" rel="noopener noreferrer">
              Platzplan
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
        {stay.platznummer && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => void copyPlatznummer()}
          >
            <Copy className="mr-1 h-3 w-3" />
            Platznr.
          </Button>
        )}
        {canEdit && !isExpandedDetails && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs ml-auto"
            onClick={() => setOpen((o) => !o)}
          >
            Buchung {open ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
          </Button>
        )}
      </div>

      {showReadonlyDetails && <BookingDetailsReadonly stay={stay} />}

      {showEditForm && (
        <div className={cn('mt-3 space-y-3 border-t pt-3', !isExpandedDetails && 'mt-3')}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Platznummer</Label>
              <Input
                value={form.platznummer ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, platznummer: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Buchungsnummer</Label>
              <Input
                value={form.buchungsnummer ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, buchungsnummer: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={form.buchungsstatus ?? '_none'}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    buchungsstatus: v === '_none' ? null : (v as Buchungsstatus),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
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
              <Label className="text-xs">Unterkunftstyp</Label>
              <Input
                value={form.unterkunftstyp ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, unterkunftstyp: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Check-in</Label>
              <Input
                value={form.checkin_zeit ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, checkin_zeit: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Check-out</Label>
              <Input
                value={form.checkout_zeit ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, checkout_zeit: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Zugangscode</Label>
              <Input
                value={form.zugangscode ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, zugangscode: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Kontakt Platz</Label>
              <Input
                value={form.kontakt_platz ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, kontakt_platz: e.target.value }))}
                placeholder="Telefon, E-Mail am Platz"
              />
            </div>
            <div>
              <Label className="text-xs">Preis gesamt</Label>
              <CurrencyInput
                value={form.preis_gesamt}
                currency={form.waehrung}
                onChange={(preis_gesamt) => setForm((f) => ({ ...f, preis_gesamt }))}
              />
            </div>
            <div>
              <Label className="text-xs">Anzahlung</Label>
              <CurrencyInput
                value={form.anzahlung_betrag}
                currency={form.waehrung}
                onChange={(anzahlung_betrag) => setForm((f) => ({ ...f, anzahlung_betrag }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notizen Buchung</Label>
            <Input
              value={form.notizen_buchung ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notizen_buchung: e.target.value }))}
            />
          </div>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? 'Speichern…' : 'Buchung speichern'}
          </Button>
        </div>
      )}
    </>
  )

  if (isExpandedDetails) {
    return (
      <>
        <div className="text-sm space-y-3">{content}</div>
        {bottomToast}
      </>
    )
  }

  return (
    <>
    <div className="mt-2 rounded-lg border border-dashed border-subtle bg-muted/20 px-3 py-2 text-sm">
      {content}
    </div>
    {bottomToast}
    </>
  )
}
