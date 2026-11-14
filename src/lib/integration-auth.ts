import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import {
  findIntegrationTokenByBearer,
  type IntegrationTokenPurpose,
} from '@/lib/integration-db'
import { requireAuth, requireSystemAdmin } from '@/lib/api-auth'

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  return token.length > 0 ? token : null
}

/** Bearer-Header oder (für Kalender-Abos) Query-Param `token`. */
export function extractIntegrationToken(request: NextRequest): string | null {
  const bearer = extractBearerToken(request)
  if (bearer) return bearer
  const fromQuery = request.nextUrl.searchParams.get('token')?.trim()
  return fromQuery && fromQuery.length > 0 ? fromQuery : null
}

export async function requireIntegrationAuth(
  request: NextRequest,
  options?: {
    allowQueryToken?: boolean
    /** Default `api` – Kalender-Token darf REST nicht nutzen und umgekehrt. */
    purpose?: IntegrationTokenPurpose
  }
): Promise<{ tokenId: string; tokenName: string; purpose: IntegrationTokenPurpose } | NextResponse> {
  const requiredPurpose = options?.purpose ?? 'api'
  const token = options?.allowQueryToken
    ? extractIntegrationToken(request)
    : extractBearerToken(request)
  if (!token) {
    return NextResponse.json(
      {
        error: options?.allowQueryToken
          ? 'Authorization: Bearer Token oder Query-Param token erforderlich'
          : 'Authorization: Bearer Token erforderlich',
      },
      { status: 401 }
    )
  }
  const env = process.env as unknown as CloudflareEnv
  const db = await getDB(env)
  const row = await findIntegrationTokenByBearer(db, token)
  if (!row) {
    return NextResponse.json({ error: 'Ungültiger oder widerrufener Token' }, { status: 401 })
  }
  if (row.purpose !== requiredPurpose) {
    return NextResponse.json(
      {
        error:
          requiredPurpose === 'calendar'
            ? 'Nur der Kalender-Token ist für diesen Endpunkt gültig'
            : 'Kalender-Token ist für die REST-API nicht gültig',
      },
      { status: 401 }
    )
  }
  return { tokenId: row.id, tokenName: row.name, purpose: row.purpose }
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
  const adminErr = requireSystemAdmin(auth.userContext)
  if (adminErr) return adminErr
  return { mode: 'admin' }
}
