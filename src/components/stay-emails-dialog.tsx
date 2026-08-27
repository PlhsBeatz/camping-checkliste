'use client'

import { ExternalLink, Mail } from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { GmailOpenLink } from '@/components/gmail-open-link'
import type { UrlaubCampingplatzEmail } from '@/lib/booking-types'
import { EMAIL_TYP_LABELS } from '@/lib/booking-types'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campingplatzName: string
  emails: UrlaubCampingplatzEmail[]
}

function formatEmailDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'd. MMM yyyy, HH:mm', { locale: de })
  } catch {
    return iso
  }
}

export function StayEmailsDialog({
  open,
  onOpenChange,
  campingplatzName,
  emails,
}: Props) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="E-Mails"
      description={campingplatzName}
      contentClassName="max-w-lg max-h-[85vh] overflow-y-auto"
    >
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Noch keine E-Mails mit diesem Aufenthalt verknüpft.
        </p>
      ) : (
        <ul className="space-y-3 pb-2">
          {emails.map((em) => (
            <li
              key={em.id}
              className="rounded-lg border border-subtle bg-card p-3 space-y-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-brand-heading">
                  <Mail className="h-4 w-4 shrink-0" />
                  {EMAIL_TYP_LABELS[em.email_typ]}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatEmailDate(em.empfangen_am)}
                </span>
              </div>
              {em.betreff && (
                <p className="font-medium text-foreground leading-snug">{em.betreff}</p>
              )}
              {em.absender && (
                <p className="text-xs text-muted-foreground truncate">{em.absender}</p>
              )}
              {em.inhalt_text && (
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {em.inhalt_text}
                </p>
              )}
              {em.gmail_suchlink && (
                <GmailOpenLink
                  webHref={em.gmail_suchlink}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-heading hover:underline"
                >
                  In Gmail öffnen
                  <ExternalLink className="h-3.5 w-3.5" />
                </GmailOpenLink>
              )}
            </li>
          ))}
        </ul>
      )}
    </ResponsiveModal>
  )
}

/** Grüner Aktions-Button (Camping-App-Stil) */
export function stayActionButtonClass(disabled = false) {
  return disabled
    ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
    : 'bg-[rgb(45,79,30)] text-white hover:bg-[rgb(45,79,30)]/90 hover:text-white shadow-sm'
}
