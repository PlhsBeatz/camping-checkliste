import type { Buchungsstatus, CampingStayEmailTyp, ParsedBookingFields } from './booking-types'

export type BookingAmountExtraction = {
  preis_gesamt: number | null
  anzahlung_betrag: number | null
}

const TOTAL_LABEL =
  /(?:Endsumme|Gesamtbetrag|Gesamt(?:preis|betrag)|Summe(?:\s+total)?|Total(?:\s+amount)?|Amount\s+due|Balance\s+due)[:\s]*([^\n]{1,40})/i

const DEPOSIT_LABEL =
  /(?:Anzahlung|Deposit|Down\s+payment|Vorauszahlung|Akontozahlung|Teilzahlung)[:\s]*([^\n]{1,40})/i

const PAYMENT_AMOUNT_LABEL =
  /(?:^|\n)\s*(?:Betrag|Amount(?:\s+paid)?|Gezahlt|Zahlungsbetrag)\s*:\s*([^\n]{1,40})/im

const ONLINE_PAYMENT_LINE =
  /online\s+(?:zahlung|payment)|zahlungseingang|payment\s+received|zahlungsbestätigung/i

const MONEY_TOKEN = /-?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|-?\d+[.,]\d{2}/g

/** Parst Geldbeträge (DE/EN, optional negatives Vorzeichen). */
export function parseMoneyAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  s = s.replace(/[€$£]|EUR|USD|CHF/gi, '').trim()

  const negative = /^-/.test(s) || /\s-\s/.test(s)
  s = s.replace(/^-/, '').replace(/\s+/g, '')

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized: string

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = s.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = s.replace(/,/g, '')
    }
  } else if (lastComma >= 0) {
    normalized = s.replace(',', '.')
  } else {
    normalized = s
  }

  const n = parseFloat(normalized)
  if (!Number.isFinite(n) || n <= 0) return null
  return negative ? -n : n
}

function firstMoneyInFragment(fragment: string): number | null {
  const match = fragment.match(MONEY_TOKEN)
  if (!match?.[0]) return null
  return parseMoneyAmount(match[0])
}

function labeledAmount(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern)
  if (!m?.[1]) return null
  const amount = firstMoneyInFragment(m[1])
  return amount != null ? Math.abs(amount) : null
}

function amountsOnLine(line: string): number[] {
  const out: number[] = []
  for (const m of line.matchAll(MONEY_TOKEN)) {
    const n = parseMoneyAmount(m[0])
    if (n != null) out.push(n)
  }
  return out
}

function extractOnlinePaymentAmount(text: string): number | null {
  for (const line of text.split('\n')) {
    if (!ONLINE_PAYMENT_LINE.test(line)) continue
    const amounts = amountsOnLine(line)
    if (amounts.length === 0) continue
    const negatives = amounts.filter((a) => a < 0)
    if (negatives.length > 0) {
      const largest = negatives.reduce((best, a) =>
        Math.abs(a) > Math.abs(best) ? a : best
      )
      return Math.abs(largest)
    }
    return Math.abs(amounts[amounts.length - 1]!)
  }
  return null
}

/** Zahlungsinfo ohne Buchungsbestätigung (z. B. Südsee-Camp „Payment information“). */
export function isPaymentOnlyContext(subject: string, text: string): boolean {
  const combined = `${subject}\n${text}`.toLowerCase()
  if (/payment\s+information|zahlungsinformation|zahlungsbestätigung|payment\s+received|zahlungseingang/i.test(combined)) {
    return true
  }
  if (/keine\s+buchungsbestätigung|not\s+a\s+booking\s+confirmation|no\s+booking\s+confirmation/i.test(combined)) {
    return true
  }
  if (/^payment information/i.test(subject.trim())) return true
  return false
}

/**
 * Extrahiert Gesamt- und Anzahlungsbeträge aus E-Mail-/PDF-Text.
 * Formatunabhängig: Tabellenzeilen, Labels, Zahlungsbestätigungen.
 */
export function extractBookingAmounts(
  text: string,
  opts?: { subject?: string; emailTyp?: CampingStayEmailTyp | null }
): BookingAmountExtraction {
  const subject = opts?.subject ?? ''
  const paymentOnly =
    opts?.emailTyp === 'zahlungsbestaetigung' || isPaymentOnlyContext(subject, text)

  let preis_gesamt = labeledAmount(text, TOTAL_LABEL)
  let anzahlung_betrag =
    labeledAmount(text, DEPOSIT_LABEL) ?? extractOnlinePaymentAmount(text)

  if (paymentOnly) {
    const paymentAmount = labeledAmount(text, PAYMENT_AMOUNT_LABEL)
    if (paymentAmount != null) anzahlung_betrag = paymentAmount
  }

  if (!paymentOnly && anzahlung_betrag == null) {
    anzahlung_betrag = extractOnlinePaymentAmount(text)
  }

  if (paymentOnly && preis_gesamt != null && anzahlung_betrag != null) {
    if (Math.abs(preis_gesamt - anzahlung_betrag) < 0.01) preis_gesamt = null
  }

  return { preis_gesamt, anzahlung_betrag }
}

function inferBuchungsstatusFromAmounts(
  parsed: ParsedBookingFields,
  paymentOnly: boolean
): Buchungsstatus | null | undefined {
  if (parsed.buchungsstatus === 'storniert') return parsed.buchungsstatus
  const total = parsed.preis_gesamt
  const paid = parsed.anzahlung_betrag
  if (paid != null && total != null && paid >= total - 0.009) return 'bezahlt'
  if (paymentOnly && paid != null && paid > 0 && (total == null || paid < total - 0.009)) {
    return null
  }
  return parsed.buchungsstatus
}

/**
 * Reichert Parser-/KI-Felder mit Betragsextraktion an (gemeinsame Schicht).
 */
export function enrichParsedBookingAmounts(
  parsed: ParsedBookingFields,
  ctx: { subject: string; text: string }
): ParsedBookingFields {
  const paymentOnly =
    parsed.email_typ === 'zahlungsbestaetigung' ||
    isPaymentOnlyContext(ctx.subject, ctx.text)

  const extracted = extractBookingAmounts(ctx.text, {
    subject: ctx.subject,
    emailTyp: parsed.email_typ,
  })

  const out: ParsedBookingFields = { ...parsed }

  if (paymentOnly) {
    if (extracted.anzahlung_betrag != null) {
      out.anzahlung_betrag = extracted.anzahlung_betrag
      if (
        extracted.preis_gesamt == null &&
        out.preis_gesamt != null &&
        Math.abs(out.preis_gesamt - extracted.anzahlung_betrag) < 0.01
      ) {
        out.preis_gesamt = null
      }
    } else if (
      out.preis_gesamt != null &&
      (out.anzahlung_betrag == null || !Number.isFinite(out.anzahlung_betrag))
    ) {
      out.anzahlung_betrag = out.preis_gesamt
      out.preis_gesamt = extracted.preis_gesamt ?? null
    }
    if (extracted.preis_gesamt != null) out.preis_gesamt = extracted.preis_gesamt
    if (!out.email_typ || out.email_typ === 'buchungsbestaetigung') {
      out.email_typ = 'zahlungsbestaetigung'
    }
  } else {
    if (extracted.preis_gesamt != null) out.preis_gesamt = extracted.preis_gesamt
    if (extracted.anzahlung_betrag != null) {
      out.anzahlung_betrag = extracted.anzahlung_betrag
    }
  }

  const status = inferBuchungsstatusFromAmounts(out, paymentOnly)
  if (status !== undefined) out.buchungsstatus = status

  return out
}
