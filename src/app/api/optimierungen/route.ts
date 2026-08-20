import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getOptimierungen,
  createOptimierung,
  reorderOptimierungen,
  recalculateAllOptimierungFaelligkeiten,
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const statusParam = request.nextUrl.searchParams.get('status')
    let statusFilter: OptimierungStatus | undefined
    if (statusParam) {
      if (!isStatus(statusParam)) {
        return NextResponse.json({ error: 'Ungültiger status-Filter' }, { status: 400 })
      }
      statusFilter = statusParam
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    // Nächster Urlaub / Saisonstart können sich mit der Zeit bzw. Urlaubsplanung ändern
    await recalculateAllOptimierungFaelligkeiten(db)
    const data = await getOptimierungen(db, statusFilter)
    return NextResponse.json({ success: true, data })
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }

    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const titel = typeof o.titel === 'string' ? o.titel.trim() : ''
    if (!titel) {
      return NextResponse.json({ error: 'titel ist erforderlich' }, { status: 400 })
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

    let links: string[] | undefined
    if (o.links !== undefined) {
      if (!Array.isArray(o.links)) {
        return NextResponse.json({ error: 'links muss ein Array sein' }, { status: 400 })
      }
      links = o.links.filter((x): x is string => typeof x === 'string')
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const id = await createOptimierung(db, {
      id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : undefined,
      titel,
      notiz: typeof o.notiz === 'string' ? o.notiz : null,
      bereich: isBereich(o.bereich) ? o.bereich : undefined,
      status: isStatus(o.status) ? o.status : undefined,
      prioritaet: o.prioritaet === null ? null : isPrio(o.prioritaet) ? o.prioritaet : undefined,
      faelligkeit_modus:
        o.faelligkeit_modus === null
          ? null
          : isOptimierungFaelligkeitModus(o.faelligkeit_modus)
            ? o.faelligkeit_modus
            : undefined,
      links,
    })
    if (!id) {
      return NextResponse.json(
        { error: 'Optimierung konnte nicht angelegt werden' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Reihenfolge der Optimierungen */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }

    const orderedIds =
      body &&
      typeof body === 'object' &&
      Array.isArray((body as { orderedIds?: unknown }).orderedIds)
        ? (body as { orderedIds: unknown[] }).orderedIds.filter(
            (x): x is string => typeof x === 'string'
          )
        : null
    if (!orderedIds || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds (string[]) erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await reorderOptimierungen(db, orderedIds)
    if (!ok) {
      return NextResponse.json({ error: 'Sortierung fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
