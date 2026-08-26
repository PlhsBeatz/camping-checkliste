import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireIntegrationAuth } from '@/lib/integration-auth'
import { createBookingImportPending } from '@/lib/booking-db'
import { stripHtml } from '@/lib/booking-email-parser'

/** Webhook für weitergeleitete Buchungs-E-Mails (Integration-Token oder Apps Script). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireIntegrationAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      betreff?: string
      subject?: string
      absender?: string
      from?: string
      inhalt?: string
      text?: string
      html?: string
      message_id?: string
    }

    const betreff = body.betreff ?? body.subject ?? ''
    const absender = body.absender ?? body.from ?? null
    const raw = body.inhalt ?? body.text ?? (body.html ? stripHtml(body.html) : '')
    if (!raw.trim()) {
      return NextResponse.json(
        { success: false, error: 'Kein E-Mail-Inhalt' },
        { status: 400 }
      )
    }

    const pending = await createBookingImportPending(db, {
      quelle: 'webhook',
      betreff,
      absender,
      inhalt_text: raw,
      message_id: body.message_id ?? null,
    })

    if (!pending) {
      return NextResponse.json(
        { success: false, error: 'Import fehlgeschlagen' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: { id: pending.id } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
