'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import type { VacationCampingStay } from '@/lib/db'
import type { UrlaubCampingplatzEmail } from '@/lib/booking-types'
import { BUCHUNGSSTATUS_LABELS, type Buchungsstatus } from '@/lib/booking-types'
import { formatBookingMoney } from '@/lib/booking-format'
import { campingplatzListThumbnailSrc } from '@/lib/campingplatz-photo-url'
import { buildPlatzplanUrl } from '@/lib/platzplan-url'
import { CampingStayBookingPanel } from '@/components/camping-stay-booking-panel'
import { StayEmailsDialog, stayActionButtonClass } from '@/components/stay-emails-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  stay: VacationCampingStay
  emails?: UrlaubCampingplatzEmail[]
  canEdit?: boolean
  onSaved?: () => void
  formatDateRange: (start: string | null, end: string | null) => string
  nights: number
}

export function VacationStayCard({
  stay,
  emails = [],
  canEdit = false,
  onSaved,
  formatDateRange,
  nights,
}: Props) {
  const [open, setOpen] = useState(false)
  const [emailsOpen, setEmailsOpen] = useState(false)
  const cp = stay.campingplatz
  const photoUrl = campingplatzListThumbnailSrc(cp)
  const platzplanUrl = buildPlatzplanUrl(cp, stay.platznummer)

  const hasBookingSummary =
    Boolean(stay.platznummer || stay.buchungsnummer || stay.buchungsstatus) ||
    stay.preis_gesamt != null ||
    Boolean(stay.buchung_abreise_extra_tag)

  const isExpandable = hasBookingSummary || emails.length > 0 || canEdit

  const actionBtnClass = cn(
    'h-9 w-full sm:flex-1 sm:min-w-0 text-xs sm:text-sm font-medium border-0',
    stayActionButtonClass()
  )

  return (
    <>
      <div
        className={cn(
          'rounded-xl border border-subtle shadow-sm bg-card overflow-hidden',
          cp.is_archived && 'opacity-60 bg-muted/60'
        )}
      >
        <button
          type="button"
          className={cn(
            'w-full text-left px-3 py-2 flex gap-3 items-start transition-colors',
            isExpandable && 'hover:bg-muted cursor-pointer',
            !isExpandable && 'cursor-default'
          )}
          onClick={() => isExpandable && setOpen((o) => !o)}
          aria-expanded={isExpandable ? open : undefined}
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] leading-tight text-muted-foreground px-1 text-center">
                Kein Bild
              </span>
            )}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <span className="font-semibold text-sm truncate block">{cp.name}</span>
            <div className="text-xs text-gray-600">
              {cp.ort}, {cp.land}
              {cp.bundesland && ` (${cp.bundesland})`}
            </div>
            <div className="text-xs font-medium text-brand-heading">
              {formatDateRange(stay.start_datum, stay.end_datum)}
              {nights > 0 && ` · ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}`}
            </div>
            {hasBookingSummary && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground pt-0.5">
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
                    {formatBookingMoney(stay.preis_gesamt, stay.waehrung)}
                  </span>
                )}
                {Boolean(stay.buchung_abreise_extra_tag) && (
                  <span className="inline-flex items-center rounded-full bg-accent-orange/15 text-accent-orange px-1.5 py-0.5 text-[10px] font-medium">
                    +1 Tag
                  </span>
                )}
              </div>
            )}
            {!hasBookingSummary && canEdit && (
              <p className="text-xs text-muted-foreground pt-0.5">Buchung hinzufügen…</p>
            )}
          </div>
          {isExpandable && (
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground mt-1 transition-transform',
                open && 'rotate-180'
              )}
              aria-hidden
            />
          )}
        </button>

        {open && isExpandable && (
          <div className="border-t border-subtle px-3 py-3 space-y-3 bg-muted/15">
            <div
              className="flex flex-col sm:flex-row gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button type="button" className={actionBtnClass} asChild>
                <Link href={`/campingplaetze/${cp.id}`}>Campingplatz</Link>
              </Button>
              {platzplanUrl && (
                <Button type="button" className={actionBtnClass} asChild>
                  <a href={platzplanUrl} target="_blank" rel="noopener noreferrer">
                    Platzplan
                  </a>
                </Button>
              )}
              <Button
                type="button"
                className={actionBtnClass}
                onClick={() => setEmailsOpen(true)}
              >
                E-Mails ({emails.length})
              </Button>
            </div>
            <CampingStayBookingPanel
              stay={stay}
              emails={emails}
              canEdit={canEdit}
              onSaved={onSaved}
              variant="expanded-details"
            />
          </div>
        )}
      </div>

      <StayEmailsDialog
        open={emailsOpen}
        onOpenChange={setEmailsOpen}
        campingplatzName={cp.name}
        emails={emails}
      />
    </>
  )
}
