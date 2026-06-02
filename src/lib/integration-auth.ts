import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { findIntegrationTokenByBearer } from '@/lib/integration-db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  return token.length > 0 ? token : null
}

export async function requireIntegrationAuth(
  request: NextRequest
): Promise<{ tokenId: string; tokenName: string } | NextResponse> {
  const bearer = extractBearerToken(request)
  if (!bearer) {
    return NextResponse.json({ error: 'Authorization: Bearer Token erforderlich' }, { status: 401 })
  }
  const env = process.env as unknown as CloudflareEnv
  const db = await getDB(env)
  const row = await findIntegrationTokenByBearer(db, bearer)
  if (!row) {
    return NextResponse.json({ error: 'Ungültiger oder widerrufener Token' }, { status: 401 })
  }
  return { tokenId: row.id, tokenName: row.name }
}

export async function requireAdminOrIntegrationAuth(
  request: NextRequest
): Promise<{ mode: 'admin' } | { mode: 'token'; tokenId: string; tokenName: string } | NextResponse> {
  const bearer = extractBearerToken(request)
  if (bearer) {
    const tokenAuth = await requireIntegrationAuth(request)
    if (tokenAuth instanceof NextResponse) return tokenAuth
    return { mode: 'token', tokenId: tokenAuth.tokenId, tokenName: tokenAuth.tokenName }
  }
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const adminErr = requireAdmin(auth.userContext)
  if (adminErr) return adminErr
  return { mode: 'admin' }
}
