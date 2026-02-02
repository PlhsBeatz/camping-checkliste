import { NextRequest, NextResponse } from 'next/server'
import { getCategoriesWithMainCategories } from '@/lib/db'
import { CloudflareEnv } from '@/lib/db'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const categories = await getCategoriesWithMainCategories(env.DB)

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch categories'
      },
      { status: 500 }
    )
  }
}
