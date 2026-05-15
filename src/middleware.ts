import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  verifyToken,
  createToken,
  COOKIE_NAME,
  getAuthCookieOptions,
  shouldRotateAuthToken
} from '@/lib/auth'

const PUBLIC_PATHS = [
  '/login',
  '/passwort-vergessen',
  '/einladung',
  '/bootstrap', // Ersteinrichtung (nur bei 0 Usern)
  '/api/auth', // Alle Auth-Routen (login, me, invite, etc.) – geschützte Routen prüfen selbst
  '/api/init' // DB-Initialisierung (optional öffentlich für Setup)
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return true
  if (pathname.startsWith('/_next') || pathname.startsWith('/icon') || pathname.startsWith('/icons/') || pathname === '/manifest.json' || pathname === '/apple-icon') return true
  if (pathname === '/' || pathname === '') return false
  if (pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyToken(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      res.cookies.delete(COOKIE_NAME)
      return res
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete(COOKIE_NAME)
    return res
  }

  const res = NextResponse.next()
  const nowSec = Math.floor(Date.now() / 1000)
  if (shouldRotateAuthToken(payload, nowSec)) {
    const newToken = await createToken({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      mitreisender_id: payload.mitreisender_id ?? null
    })
    res.cookies.set(COOKIE_NAME, newToken, getAuthCookieOptions())
  }
  return res
}

export const config = {
  /**
   * Gesamtes `/_next/*` ausschließen (nicht nur static/image): Dev/Webpack/HMR und alle Build-Chunks
   * dürfen nie durch Auth-Middleware laufen — sonst Redirect/HTML statt Asset → kaputtes CSS/JS.
   */
  matcher: ['/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
