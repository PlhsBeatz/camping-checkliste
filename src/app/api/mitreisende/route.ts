import { NextRequest, NextResponse } from 'next/server'
import { 
  getDB,
  getMitreisende, 
  getMitreisendeForVacation,
  createMitreisender, 
  updateMitreisender, 
  deleteMitreisender,
  setMitreisendeForVacation,
  CloudflareEnv
} from '@/lib/db'

export const runtime = 'edge'

/**
 * GET /api/mitreisende
 * Abrufen aller Mitreisenden oder Mitreisenden für einen bestimmten Urlaub
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    let mitreisende
    if (vacationId) {
      mitreisende = await getMitreisendeForVacation(db, vacationId)
    } else {
      mitreisende = await getMitreisende(db)
    }

    return NextResponse.json({ success: true, data: mitreisende })
  } catch (error) {
    console.error('Error in GET /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * POST /api/mitreisende
 * Erstellen eines neuen Mitreisenden
 */
export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = await request.json()
    const { name, userId, user_id, isDefaultMember, is_default_member } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    // Support both camelCase and snake_case
    const finalUserId = userId || user_id
    const finalIsDefault = isDefaultMember !== undefined ? isDefaultMember : is_default_member

    const id = await createMitreisender(db, name, finalUserId, finalIsDefault)
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Failed to create mitreisender' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Error in POST /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * PUT /api/mitreisende
 * Aktualisieren eines Mitreisenden oder Setzen der Mitreisenden für einen Urlaub
 */
export async function PUT(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = await request.json()
    const { id, name, userId, user_id, isDefaultMember, is_default_member, vacationId, mitreisendeIds } = body

    // Setzen der Mitreisenden für einen Urlaub
    if (vacationId && mitreisendeIds) {
      const success = await setMitreisendeForVacation(db, vacationId, mitreisendeIds)
      if (!success) {
        return NextResponse.json({ success: false, error: 'Failed to set mitreisende for vacation' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    // Aktualisieren eines einzelnen Mitreisenden
    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'ID and name are required' }, { status: 400 })
    }

    // Support both camelCase and snake_case
    const finalUserId = userId || user_id
    const finalIsDefault = isDefaultMember !== undefined ? isDefaultMember : is_default_member

    const success = await updateMitreisender(db, id, name, finalUserId, finalIsDefault)
    
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to update mitreisender' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * DELETE /api/mitreisende
 * Löschen eines Mitreisenden
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 })
    }

    const success = await deleteMitreisender(db, id)
    
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete mitreisender' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
