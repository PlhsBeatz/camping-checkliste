import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, getPackingItems, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  ALL_INTEGRATION_EVENT_TYPES,
  createIntegrationWebhook,
  deleteIntegrationWebhook,
  generateWebhookSecret,
  listIntegrationWebhooks,
  updateIntegrationWebhook,
  type IntegrationEventType,
} from '@/lib/integration-db'
import { buildTripStatusPayload, findRelevantVacation } from '@/lib/trip-readiness'
import { deliverTestWebhook } from '@/lib/webhooks'

function parseEventTypes(v: unknown): IntegrationEventType[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.filter((e): e is IntegrationEventType =>
    (ALL_INTEGRATION_EVENT_TYPES as readonly string[]).includes(String(e))
  )
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const webhooks = await listIntegrationWebhooks(db)
    return NextResponse.json({ success: true, data: webhooks })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as {
      name?: string
      url?: string
      enabled_events?: IntegrationEventType[]
    }
    const name = body.name?.trim()
    const url = body.url?.trim()
    if (!name || !url) {
      return NextResponse.json({ error: 'name und url sind erforderlich' }, { status: 400 })
    }

    const signing_secret = generateWebhookSecret()
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const created = await createIntegrationWebhook(db, {
      name,
      url,
      signing_secret,
      enabled_events: parseEventTypes(body.enabled_events),
    })
    if (!created) {
      return NextResponse.json({ error: 'Webhook konnte nicht erstellt werden' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          name,
          url,
          signing_secret: created.signing_secret,
          enabled_events: parseEventTypes(body.enabled_events) ?? [...ALL_INTEGRATION_EVENT_TYPES],
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as {
      id?: string
      name?: string
      url?: string
      enabled?: boolean
      enabled_events?: IntegrationEventType[]
    }
    if (!body.id) {
      return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await updateIntegrationWebhook(db, body.id, {
      name: body.name,
      url: body.url,
      enabled: body.enabled,
      enabled_events: parseEventTypes(body.enabled_events),
    })
    if (!ok) {
      return NextResponse.json({ error: 'Webhook nicht gefunden oder keine Änderung' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await deleteIntegrationWebhook(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Webhook nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as { id?: string; action?: string }
    if (body.action !== 'test' || !body.id) {
      return NextResponse.json({ error: 'action=test und id erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const vacations = await getVacations(db)
    const vacation = findRelevantVacation(vacations)
    if (!vacation) {
      return NextResponse.json({ error: 'Kein Urlaub für Test-Event' }, { status: 404 })
    }
    const items = await getPackingItems(db, vacation.id)
    const payload = buildTripStatusPayload(vacation, items)
    const result = await deliverTestWebhook(db, body.id, payload)

    return NextResponse.json({ success: result.success, data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
