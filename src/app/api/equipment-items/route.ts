import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getEquipmentItems,
  getEquipmentItem,
  createEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
  getTagsForEquipment,
  getAllTagsForEquipment,
  applyEquipmentFaelligkeitDisposition,
  replaceTemporaryWithEquipmentInFuturePacklisten,
  CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import type { MengenRegel } from '@/lib/packing-quantity'
import { notifyPackingSyncChange } from '@/lib/packing-sync'

interface EquipmentItemBody {
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
  ausgemustert_am?: string | null
  ersetzt_durch_id?: string | null
  wartung_disposition?: 'keep' | 'archive'
}

interface PostEquipmentBody extends EquipmentItemBody {
  was: string
  kategorie_id: string
  /** Optional: Client-ID für Offline-Anlegen */
  id?: string
  /** Temp→Ausrüstung: auf zukünftigen Packlisten tauschen */
  replace_temp_in_future_packlists?: boolean
  /** Originalname der temporären Einträge (Match), falls umbenannt */
  temp_match_was?: string
  /** Original-Kategorie der temporären Einträge (Match) */
  temp_match_kategorie_id?: string
}

interface PutEquipmentBody extends EquipmentItemBody {
  id: string
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Get single equipment item with tags
      const item = await getEquipmentItem(db, id)
      if (!item) {
        return NextResponse.json({ error: 'Equipment item not found' }, { status: 404 })
      }
      
      // Load tags for this item
      const tags = await getTagsForEquipment(db, id)
      item.tags = tags
      
      return NextResponse.json({ success: true, data: item })
    } else {
      // Get all equipment items with tags (Batch-Loading)
      const items = await getEquipmentItems(db)
      const tagsMap = await getAllTagsForEquipment(db)
      for (const item of items) {
        item.tags = tagsMap.get(item.id) || []
      }
      const res = NextResponse.json({ success: true, data: items })
      // Cache am Edge (Worker) – reduziert CPU/Memory, vermeidet Error 1102
      res.headers.set(
        'Cache-Control',
        'public, max-age=300, s-maxage=300, stale-while-revalidate=600'
      )
      return res
    }
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
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as PostEquipmentBody

    const {
      id: clientId,
      was,
      kategorie_id,
      transport_id,
      einzelgewicht,
      standard_anzahl,
      status,
      details,
      is_standard,
      erst_abreisetag_gepackt,
      mitreisenden_typ,
      standard_mitreisende,
      in_pauschale_inbegriffen,
      mengenregel,
      tags,
      links,
      anschaffungsdatum,
      ausgemustert_am,
      replace_temp_in_future_packlists,
      temp_match_was,
      temp_match_kategorie_id,
    } = body

    if (!was || !kategorie_id) {
      return NextResponse.json({ 
        error: 'was and kategorie_id are required' 
      }, { status: 400 })
    }

    const item = await createEquipmentItem(db, {
      id: typeof clientId === 'string' && clientId.trim() ? clientId.trim() : undefined,
      was,
      kategorie_id,
      transport_id,
      einzelgewicht,
      standard_anzahl,
      status,
      details,
      is_standard,
      erst_abreisetag_gepackt,
      mitreisenden_typ,
      standard_mitreisende,
      in_pauschale_inbegriffen,
      mengenregel,
      tags,
      links,
      anschaffungsdatum,
      ausgemustert_am,
    })

    if (!item) {
      return NextResponse.json({ 
        error: 'Failed to create equipment item' 
      }, { status: 500 })
    }

    if (replace_temp_in_future_packlists === true) {
      const matchWas = String(temp_match_was ?? was).trim()
      const matchKat = String(temp_match_kategorie_id ?? kategorie_id).trim()
      if (matchWas && matchKat) {
        const vacationIds = await replaceTemporaryWithEquipmentInFuturePacklisten(
          db,
          matchWas,
          matchKat,
          item.id
        )
        if (vacationIds.length > 0) {
          try {
            const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
            for (const vacationId of vacationIds) {
              await notifyPackingSyncChange(cfEnv, vacationId)
            }
          } catch {
            /* ohne Worker-Kontext */
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as PutEquipmentBody

    const {
      id,
      was,
      kategorie_id,
      transport_id,
      einzelgewicht,
      standard_anzahl,
      status,
      details,
      is_standard,
      erst_abreisetag_gepackt,
      mitreisenden_typ,
      standard_mitreisende,
      in_pauschale_inbegriffen,
      mengenregel,
      tags,
      links,
      anschaffungsdatum,
      ausgemustert_am,
      wartung_disposition,
    } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const existing = await getEquipmentItem(db, id)
    const item = await updateEquipmentItem(db, id, {
      was,
      kategorie_id,
      transport_id,
      einzelgewicht,
      standard_anzahl,
      status,
      details,
      is_standard,
      erst_abreisetag_gepackt,
      mitreisenden_typ,
      standard_mitreisende,
      in_pauschale_inbegriffen,
      mengenregel,
      tags,
      links,
      anschaffungsdatum,
      ausgemustert_am,
    })

    if (!item) {
      return NextResponse.json({ 
        error: 'Failed to update equipment item' 
      }, { status: 500 })
    }

    if (
      existing &&
      existing.status !== 'Ausgemustert' &&
      item.status === 'Ausgemustert' &&
      (wartung_disposition === 'keep' || wartung_disposition === 'archive')
    ) {
      const ok = await applyEquipmentFaelligkeitDisposition(db, id, wartung_disposition)
      if (!ok) {
        return NextResponse.json(
          { error: 'Gegenstand gespeichert, Fälligkeiten konnten nicht angepasst werden' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true, data: item })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const success = await deleteEquipmentItem(db, id)

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to delete equipment item' 
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
