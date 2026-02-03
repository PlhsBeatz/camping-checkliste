import { NextRequest, NextResponse } from 'next/server'
import { 
  getMitreisende, 
  getMitreisende ForVacation,
  createMitreisender, 
  updateMitreisender, 
  deleteMitreisender,
  setMitreisende ForVacation
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
    const env = (process.env as unknown) as { DB: D1Database }
    
    if (!env.DB) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    let mitreisende
    if (vacationId) {
      mitreisende = await getMitreisende ForVacation(env.DB, vacationId)
    } else {
      mitreisende = await getMitreisende(env.DB)
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
    const env = (process.env as unknown) as { DB: D1Database }
    
    if (!env.DB) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { name, user_id, is_default_member } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    const id = await createMitreisender(env.DB, name, user_id, is_default_member)
    
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
    const env = (process.env as unknown) as { DB: D1Database }
    
    if (!env.DB) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { id, name, user_id, is_default_member, vacationId, mitreisende Ids } = body

    // Setzen der Mitreisenden für einen Urlaub
    if (vacationId && mitreisende Ids) {
      const success = await setMitreisende ForVacation(env.DB, vacationId, mitreisende Ids)
      if (!success) {
        return NextResponse.json({ success: false, error: 'Failed to set mitreisende for vacation' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    // Aktualisieren eines einzelnen Mitreisenden
    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'ID and name are required' }, { status: 400 })
    }

    const success = await updateMitreisender(env.DB, id, name, user_id, is_default_member)
    
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
    const env = (process.env as unknown) as { DB: D1Database }
    
    if (!env.DB) {
      return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 })
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 })
    }

    const success = await deleteMitreisender(env.DB, id)
    
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
