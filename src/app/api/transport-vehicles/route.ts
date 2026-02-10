import { NextRequest, NextResponse } from 'next/server'
import { getTransportVehicles } from '@/lib/db'
import { CloudflareEnv } from '@/lib/db'

export async function GET(_request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const vehicles = await getTransportVehicles(env.DB)

    return NextResponse.json({
      success: true,
      data: vehicles
    })
  } catch (error) {
    console.error('Error fetching transport vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transport vehicles'
      },
      { status: 500 }
    )
  }
}
