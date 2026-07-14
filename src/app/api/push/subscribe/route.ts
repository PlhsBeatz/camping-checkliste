import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, upsertPushSubscription } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { getVapidConfigStatus } from '@/lib/web-push'

export async function GET() {
  const status = await getVapidConfigStatus()
  return NextResponse.json({
    success: true,
    data: {
      publicKey: status.publicKey ?? null,
      enabled: status.enabled,
      privateKeyConfigured: status.privateKeyConfigured,
      privateKeyParseFailed: status.privateKeyParseFailed,
      keyPairMatch: status.keyPairMatch,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = (await request.json()) as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { success: false, error: 'Ungültige Push-Subscription' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await upsertPushSubscription(db, auth.userContext.userId, {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    })

    if (!ok) {
      return NextResponse.json({ success: false, error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = (await request.json()) as { endpoint?: string }
    if (!body.endpoint) {
      return NextResponse.json({ success: false, error: 'endpoint required' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { deletePushSubscriptionByEndpoint } = await import('@/lib/db')
    await deletePushSubscriptionByEndpoint(db, body.endpoint)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
