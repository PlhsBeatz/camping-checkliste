import { NextRequest, NextResponse } from 'next/server'
import { getDB, getCampingPhotosR2, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { normalizeImportBundle, importBackupBundle } from '@/lib/data-backup'
import { isZipMagic, parseBackupZip } from '@/lib/data-backup/backup-zip'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const contentType = request.headers.get('content-type') || ''

    let dryRun = false
    let bundle: Awaited<ReturnType<typeof normalizeImportBundle>>['bundle']
    let normWarnings: string[] = []
    let r2FilesFromZip: Map<string, Uint8Array> | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      dryRun = form.get('dryRun') === 'true'
      const file = form.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'Datei fehlt' }, { status: 400 })
      }
      const buf = new Uint8Array(await file.arrayBuffer())
      if (isZipMagic(buf)) {
        try {
          const parsed = parseBackupZip(buf)
          normWarnings = [...parsed.parseWarnings, ...parsed.warningsFromZip]
          const n = normalizeImportBundle(parsed.rawBundle)
          bundle = n.bundle
          normWarnings.push(...n.warnings)
          if (parsed.r2Files.size > 0) r2FilesFromZip = parsed.r2Files
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 400 }
          )
        }
      } else {
        let raw: unknown
        try {
          raw = JSON.parse(new TextDecoder('utf-8', { fatal: false }).decode(buf))
        } catch (e) {
          return NextResponse.json(
            { error: `Kein ZIP und kein gültiges JSON: ${e instanceof Error ? e.message : String(e)}` },
            { status: 400 }
          )
        }
        try {
          const n = normalizeImportBundle(raw)
          bundle = n.bundle
          normWarnings = n.warnings
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 400 }
          )
        }
      }
    } else {
      let body: Record<string, unknown>
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
      }

      dryRun = body.dryRun === true
      const rawBundle = body.bundle
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
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const r2Bucket = await getCampingPhotosR2(env)
    const result = await importBackupBundle(db, bundle, {
      dryRun,
      mode: 'mergeById',
      r2Bucket,
      r2FilesFromZip,
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
