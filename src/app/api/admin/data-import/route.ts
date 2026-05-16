import { NextRequest, NextResponse } from 'next/server'
import { getDB, getCampingPhotosR2, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { normalizeImportBundle, importBackupBundle } from '@/lib/data-backup'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }

    const dryRun = body.dryRun === true
    const rawBundle = body.bundle
    let normWarnings: string[] = []
    let bundle
    try {
      const n = normalizeImportBundle(rawBundle)
      bundle = n.bundle
      normWarnings = n.warnings
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const r2Bucket = await getCampingPhotosR2(env)
    const result = await importBackupBundle(db, bundle, {
      dryRun,
      mode: 'mergeById',
      r2Bucket,
    })
    result.warnings.unshift(...normWarnings)

    return NextResponse.json({
      success: result.errors.length === 0,
      data: result,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
