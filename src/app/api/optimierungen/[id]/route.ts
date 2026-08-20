import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  updateOptimierung,
  deleteOptimierung,
  getCampingPhotosR2,
  CloudflareEnv,
  type OptimierungStatus,
  type OptimierungBereich,
  type OptimierungPrioritaet,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { isOptimierungFaelligkeitModus } from '@/lib/optimierung-faelligkeit'

const STATUSES: OptimierungStatus[] = [
  'idee',
  'geplant',
  'in_arbeit',
  'erledigt',
  'verworfen',
]
const BEREICHE: OptimierungBereich[] = ['ausstattung', 'sonstiges']
const PRIOS: OptimierungPrioritaet[] = ['niedrig', 'mittel', 'hoch']

function isStatus(v: unknown): v is OptimierungStatus {
  return typeof v === 'string' && (STATUSES as string[]).includes(v)
}
function isBereich(v: unknown): v is OptimierungBereich {
  return typeof v === 'string' && (BEREICHE as string[]).includes(v)
}
function isPrio(v: unknown): v is OptimierungPrioritaet {
  return typeof v === 'string' && (PRIOS as string[]).includes(v)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }

    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const hasAny =
      o.titel !== undefined ||
      o.notiz !== undefined ||
      o.bereich !== undefined ||
      o.status !== undefined ||
      o.prioritaet !== undefined ||
      o.faelligkeit_modus !== undefined ||
      o.reihenfolge !== undefined ||
      o.links !== undefined
    if (!hasAny) {
      return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 })
    }

    if (o.titel !== undefined && (typeof o.titel !== 'string' || !o.titel.trim())) {
      return NextResponse.json({ error: 'titel darf nicht leer sein' }, { status: 400 })
    }
    if (o.bereich !== undefined && !isBereich(o.bereich)) {
      return NextResponse.json({ error: 'Ungültiger bereich' }, { status: 400 })
    }
    if (o.status !== undefined && !isStatus(o.status)) {
      return NextResponse.json({ error: 'Ungültiger status' }, { status: 400 })
    }
    if (o.prioritaet !== undefined && o.prioritaet !== null && !isPrio(o.prioritaet)) {
      return NextResponse.json({ error: 'Ungültige prioritaet' }, { status: 400 })
    }
    if (
      o.faelligkeit_modus !== undefined &&
      o.faelligkeit_modus !== null &&
      !isOptimierungFaelligkeitModus(o.faelligkeit_modus)
    ) {
      return NextResponse.json({ error: 'Ungültiger faelligkeit_modus' }, { status: 400 })
    }
    if (o.reihenfolge !== undefined && typeof o.reihenfolge !== 'number') {
      return NextResponse.json({ error: 'reihenfolge muss eine Zahl sein' }, { status: 400 })
    }

    let links: string[] | undefined
    if (o.links !== undefined) {
      if (!Array.isArray(o.links)) {
        return NextResponse.json({ error: 'links muss ein Array sein' }, { status: 400 })
      }
      links = o.links.filter((x): x is string => typeof x === 'string')
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await updateOptimierung(db, id, {
      titel: typeof o.titel === 'string' ? o.titel : undefined,
      notiz: o.notiz === null ? null : typeof o.notiz === 'string' ? o.notiz : undefined,
      bereich: isBereich(o.bereich) ? o.bereich : undefined,
      status: isStatus(o.status) ? o.status : undefined,
      prioritaet: o.prioritaet === null ? null : isPrio(o.prioritaet) ? o.prioritaet : undefined,
      faelligkeit_modus:
        o.faelligkeit_modus === null
          ? null
          : isOptimierungFaelligkeitModus(o.faelligkeit_modus)
            ? o.faelligkeit_modus
            : undefined,
      reihenfolge: typeof o.reihenfolge === 'number' ? o.reihenfolge : undefined,
      links,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { deleted, r2Keys } = await deleteOptimierung(db, id)
    if (!deleted) {
      return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
    }
    if (r2Keys.length > 0) {
      const bucket = await getCampingPhotosR2(env)
      if (bucket) {
        await Promise.all(r2Keys.map((key) => bucket.delete(key)))
      }
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
