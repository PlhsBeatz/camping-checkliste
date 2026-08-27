/**
 * Minimaler E-Mail-Ingest für den Worker – ohne schwere db.ts-/Matcher-Imports.
 * Verhindert Worker Error 1102 (CPU-Limit) bei Mails mit großen Anhängen.
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { parseBookingEmail, stripHtml, prepareBookingText } from './booking-email-parser'
import { decodeMimeHeaderValue } from './booking-email-headers'
import {
  BOOKING_EML_MAX_R2_BYTES,
  extractEmailBodies,
} from './booking-email-extract'

const MAX_TEXT_LEN = 8000

function truncateText(text: string | null | undefined): string | null {
  if (!text) return null
  const t = text.trim()
  if (t.length <= MAX_TEXT_LEN) return t
  return t.slice(0, MAX_TEXT_LEN)
}

export async function ingestBookingEmail(
  message: ForwardableEmailMessage,
  env: { DB: D1Database; CAMPING_PHOTOS?: R2Bucket }
): Promise<void> {
  try {
    const rawBuffer = await new Response(message.raw).arrayBuffer()
    const headerSubject = decodeMimeHeaderValue(message.headers.get('subject'))

    const { text, html, subject: extractedSubject } = await extractEmailBodies(
      rawBuffer,
      headerSubject
    )
    const subject = extractedSubject ?? headerSubject
    const plainBody = text || stripHtml(html)
    const inhalt = prepareBookingText(plainBody, subject)
    const messageId = message.headers.get('message-id')

    const parsed = parseBookingEmail(plainBody, subject)
    const id = crypto.randomUUID()
    const parsedJson = JSON.stringify(parsed)

    await env.DB.prepare(
      `INSERT INTO booking_import_pending (
        id, status, quelle, betreff, absender, empfangen_am, inhalt_text,
        message_id, parsed_fields_json, vorgeschlagener_urlaub_id
      ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        'email_forward',
        subject || null,
        message.from,
        new Date().toISOString(),
        truncateText(inhalt),
        messageId ?? null,
        parsedJson,
        null
      )
      .run()

    if (env.CAMPING_PHOTOS && rawBuffer.byteLength <= BOOKING_EML_MAX_R2_BYTES) {
      try {
        const key = `booking-eml/${id}.eml`
        await env.CAMPING_PHOTOS.put(key, rawBuffer, {
          httpMetadata: { contentType: 'message/rfc822' },
        })
        await env.DB.prepare(
          `UPDATE booking_import_pending SET r2_object_key = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(key, id)
          .run()
      } catch (e) {
        console.warn('R2 eml store failed:', e)
      }
    }
  } catch (error) {
    console.error('ingestBookingEmail failed:', error)
    throw error
  }
}
