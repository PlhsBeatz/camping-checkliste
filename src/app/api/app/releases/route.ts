import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { APP_VERSION } from '@/lib/app-version'
import {
  APP_RELEASES_PAGE_SIZE,
  fetchGitHubReleaseByTag,
  fetchGitHubReleases,
  findReleaseForAppVersion,
  normalizeVersionTag,
} from '@/lib/github-feedback'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    if (!process.env.GITHUB_TOKEN?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Releases sind nicht konfiguriert (GITHUB_TOKEN fehlt).',
        },
        { status: 503 }
      )
    }

    const pageParam = Number(request.nextUrl.searchParams.get('page') || '1')
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1
    const perPage = APP_RELEASES_PAGE_SIZE

    const list = await fetchGitHubReleases({ page, perPage })

    // Aktuelles Release gezielt laden (kann älter sein als Seite 1)
    let current = page === 1 ? await fetchGitHubReleaseByTag(APP_VERSION) : null
    if (page === 1 && !current) {
      current = findReleaseForAppVersion(list.releases, APP_VERSION)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          appVersion: APP_VERSION,
          appVersionNormalized: normalizeVersionTag(APP_VERSION),
          current,
          releases: list.releases,
          page: list.page,
          perPage: list.perPage,
          hasMore: list.hasMore,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=120',
        },
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('GET /api/app/releases', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
