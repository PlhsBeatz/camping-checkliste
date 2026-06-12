import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireSystemAdmin } from '@/lib/api-auth'
import {
  createIntegrationToken,
  listIntegrationTokens,
  revokeIntegrationToken,
} from '@/lib/integration-db'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireSystemAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const tokens = await listIntegrationTokens(db)
    return NextResponse.json({ success: true, data: tokens })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireSystemAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as { name?: string }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const created = await createIntegrationToken(db, name)
    if (!created) {
      return NextResponse.json({ error: 'Token konnte nicht erstellt werden' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          name,
          token_prefix: created.prefix,
          token: created.token,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireSystemAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await revokeIntegrationToken(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Token nicht gefunden oder bereits widerrufen' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
