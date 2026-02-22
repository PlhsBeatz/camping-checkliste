import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

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

  const token = request.cookies.get('auth-token')?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyToken(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      res.cookies.delete('auth-token')
      return res
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete('auth-token')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
