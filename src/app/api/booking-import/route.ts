import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, getCampingStaysForVacation, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  confirmBookingImport,
  countPendingBookingImports,
  createBookingImportPending,
  dismissBookingImport,
  getBookingImportPending,
  listPendingBookingImports,
} from '@/lib/booking-db'
import { parseBookingEmail, mergeParsedFields } from '@/lib/booking-email-parser'
import { suggestStayMatch } from '@/lib/booking-stay-matcher'
import type { CampingStayEmailTyp, ParsedBookingFields, StayBookingFields } from '@/lib/booking-types'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const pending = await getBookingImportPending(db, id)
      if (!pending) {
        return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
      }
      const storedParsed: ParsedBookingFields | null = pending.parsed_fields_json
        ? (JSON.parse(pending.parsed_fields_json) as ParsedBookingFields)
        : null
      const freshParsed = parseBookingEmail(
        pending.inhalt_text ?? '',
        pending.betreff ?? ''
      )
      const parsed = mergeParsedFields(storedParsed, freshParsed)
      const suggestion = await suggestStayMatch(db, parsed, {
        betreff: pending.betreff,
        absender: pending.absender,
      })
      const vacations = await getVacations(db)
      const stays =
        suggestion?.urlaub_id != null
          ? await getCampingStaysForVacation(db, suggestion.urlaub_id)
          : []
      return NextResponse.json({
        success: true,
        data: { pending, parsed, suggestion, vacations, stays },
      })
    }

    const count = await countPendingBookingImports(db)
    const list = await listPendingBookingImports(db)
    return NextResponse.json({ success: true, data: { count, list } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      action?: string
      betreff?: string
      inhalt?: string
      pending_id?: string
      urlaub_id?: string
      stay_id?: string | null
      campingplatz_id?: string | null
      start_datum?: string | null
      end_datum?: string | null
      email_typ?: CampingStayEmailTyp
      booking?: StayBookingFields
    }

    if (body.action === 'dismiss' && body.pending_id) {
      const ok = await dismissBookingImport(db, body.pending_id)
      return NextResponse.json({ success: ok })
    }

    if (body.action === 'confirm' && body.pending_id && body.urlaub_id && body.booking) {
      const result = await confirmBookingImport(db, {
        pending_id: body.pending_id,
        urlaub_id: body.urlaub_id,
        stay_id: body.stay_id,
        campingplatz_id: body.campingplatz_id,
        start_datum: body.start_datum,
        end_datum: body.end_datum,
        email_typ: body.email_typ,
        booking: body.booking,
      })
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Import konnte nicht bestätigt werden' },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'analyze' && body.inhalt) {
      const parsed = parseBookingEmail(body.inhalt, body.betreff ?? '')
      const suggestion = await suggestStayMatch(db, parsed, {
        betreff: body.betreff,
      })
      return NextResponse.json({ success: true, data: { parsed, suggestion } })
    }

    if (body.inhalt) {
      const pending = await createBookingImportPending(db, {
        quelle: 'paste',
        betreff: body.betreff ?? null,
        inhalt_text: body.inhalt,
      })
      if (!pending) {
        return NextResponse.json(
          { success: false, error: 'Import konnte nicht angelegt werden' },
          { status: 500 }
        )
      }
      const storedParsed: ParsedBookingFields | null = pending.parsed_fields_json
        ? (JSON.parse(pending.parsed_fields_json) as ParsedBookingFields)
        : null
      const freshParsed = parseBookingEmail(
        pending.inhalt_text ?? '',
        pending.betreff ?? ''
      )
      const parsed = mergeParsedFields(storedParsed, freshParsed)
      const suggestion = await suggestStayMatch(db, parsed, {
        betreff: pending.betreff,
        absender: pending.absender,
      })
      return NextResponse.json({ success: true, data: { pending, parsed, suggestion } })
    }

    return NextResponse.json(
      { success: false, error: 'Ungültige Anfrage' },
      { status: 400 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
