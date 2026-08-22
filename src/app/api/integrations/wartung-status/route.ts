import { NextRequest, NextResponse } from 'next/server'
import { getDB, getWartungStatusForIntegration, type CloudflareEnv } from '@/lib/db'
import { requireIntegrationAuth } from '@/lib/integration-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireIntegrationAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const data = await getWartungStatusForIntegration(db)
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
