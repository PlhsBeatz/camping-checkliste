import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getEquipmentItem,
  createEquipmentItem,
  updateEquipmentItem,
  replaceEquipmentInVorlagen,
  applyEquipmentFaelligkeitDisposition,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import type { MengenRegel } from '@/lib/packing-quantity'
import type { EquipmentFaelligkeitDisposition } from '@/lib/db-wartung'

interface ReplaceBody {
  source_id?: string
  /** Optional: Client-ID des Nachfolgers für Offline-Ersetzen */
  successor_id?: string
  replace_in_templates?: boolean
  wartung_disposition?: Extract<
    EquipmentFaelligkeitDisposition,
    'keep' | 'transfer' | 'archive_and_create'
  >
  was?: string
  kategorie_id?: string
  transport_id?: string | null
  einzelgewicht?: number
  standard_anzahl?: number
  status?: string
  details?: string
  is_standard?: boolean
  erst_abreisetag_gepackt?: boolean
  mitreisenden_typ?: 'pauschal' | 'alle' | 'ausgewaehlte'
  standard_mitreisende?: string[]
  in_pauschale_inbegriffen?: boolean
  mengenregel?: MengenRegel | null
  tags?: string[]
  links?: string[]
  anschaffungsdatum?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as ReplaceBody
    if (!body.source_id || !body.was || !body.kategorie_id) {
      return NextResponse.json(
        { error: 'source_id, was und kategorie_id sind erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const source = await getEquipmentItem(db, body.source_id)
    if (!source) {
      return NextResponse.json({ error: 'Quell-Gegenstand nicht gefunden' }, { status: 404 })
    }

    const created = await createEquipmentItem(db, {
      id: typeof body.successor_id === 'string' && body.successor_id.trim()
        ? body.successor_id.trim()
        : undefined,
      was: body.was,
      kategorie_id: body.kategorie_id,
      transport_id: body.transport_id,
      einzelgewicht: body.einzelgewicht,
      standard_anzahl: body.standard_anzahl,
      status: body.status || 'Normal',
      details: body.details,
      is_standard: body.is_standard,
      erst_abreisetag_gepackt: body.erst_abreisetag_gepackt,
      mitreisenden_typ: body.mitreisenden_typ,
      standard_mitreisende: body.standard_mitreisende,
      in_pauschale_inbegriffen: body.in_pauschale_inbegriffen,
      mengenregel: body.mengenregel,
      tags: body.tags,
      links: body.links,
      anschaffungsdatum: body.anschaffungsdatum,
    })
    if (!created) {
      return NextResponse.json({ error: 'Nachfolger konnte nicht angelegt werden' }, { status: 500 })
    }

    const retired = await updateEquipmentItem(db, source.id, {
      status: 'Ausgemustert',
      ersetzt_durch_id: created.id,
    })
    if (!retired) {
      return NextResponse.json(
        { error: 'Nachfolger angelegt, Ausmustern des alten Eintrags fehlgeschlagen' },
        { status: 500 }
      )
    }

    const disposition = body.wartung_disposition ?? 'keep'
    const wartungOk = await applyEquipmentFaelligkeitDisposition(db, source.id, disposition, {
      successorId: created.id,
      successorAnschaffungsdatum: created.anschaffungsdatum,
    })
    if (!wartungOk) {
      return NextResponse.json(
        { error: 'Ersetzen gespeichert, Fälligkeiten konnten nicht angepasst werden' },
        { status: 500 }
      )
    }

    if (body.replace_in_templates !== false) {
      await replaceEquipmentInVorlagen(db, source.id, created.id)
    }

    const successor = await getEquipmentItem(db, created.id)
    return NextResponse.json({
      success: true,
      data: { source: retired, successor: successor ?? created },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
