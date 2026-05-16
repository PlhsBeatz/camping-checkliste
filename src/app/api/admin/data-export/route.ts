import { NextRequest, NextResponse } from 'next/server'
import { getDB, getCampingPhotosR2, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { buildBackupBundle, type BackupPreset, type ExportOptions } from '@/lib/data-backup'

function parsePresets(v: unknown): BackupPreset[] | undefined {
  if (!Array.isArray(v)) return undefined
  const allowed: BackupPreset[] = [
    'referenceCore',
    'equipment',
    'referenceStammdaten',
    'vacations',
    'places',
    'toolsChecklists',
    'auth',
  ]
  const out: BackupPreset[] = []
  for (const x of v) {
    if (typeof x === 'string' && (allowed as string[]).includes(x)) out.push(x as BackupPreset)
  }
  return out.length ? out : undefined
}

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

    const options: ExportOptions = {
      presets: parsePresets(body.presets),
      vacationIds: Array.isArray(body.vacationIds)
        ? body.vacationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : undefined,
      autoClosure: body.autoClosure === false ? false : true,
      includeAuth: body.includeAuth === true,
      includeR2Photos: body.includeR2Photos === true,
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const r2Bucket = await getCampingPhotosR2(env)
    const { bundle, warnings } = await buildBackupBundle(db, options, { r2Bucket })

    return NextResponse.json({ success: true, data: bundle, warnings })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
