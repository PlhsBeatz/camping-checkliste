/**
 * Authentifizierung mit PBKDF2 (Cloudflare Workers-kompatibel) und JWT
 */

import * as jose from 'jose'
import { cookies } from 'next/headers'

const SALT_LENGTH = 16
const ITERATIONS = 100_000
const KEY_LENGTH = 32
const JWT_SECRET_ENV = 'JWT_SECRET'
const COOKIE_NAME = 'auth-token'
const TOKEN_AGE_SEC = 7 * 24 * 60 * 60 // 7 Tage

export type UserRole = 'admin' | 'kind' | 'gast'

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  mitreisender_id: string | null
}

export interface JWTPayload {
  sub: string // user id
  email: string
  role: UserRole
  mitreisender_id?: string | null
  exp?: number
  iat?: number
}

/** Passwort hashen mit PBKDF2-SHA256 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LENGTH * 8
  )
  const hash = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const saltHex = Array.from(salt)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${ITERATIONS}:${saltHex}:${hash}`
}

/** Passwort gegen gespeicherten Hash prüfen */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [iterStr, saltHex, storedHashPart] = storedHash.split(':')
  if (!iterStr || !saltHex || !storedHashPart) return false
  const iterations = parseInt(iterStr, 10)
  if (isNaN(iterations) || iterations < 1000) return false

  const salt = new Uint8Array(saltHex.length / 2)
  for (let i = 0; i < salt.length; i++) {
    salt[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16)
  }

  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LENGTH * 8
  )
  const hash = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return timingSafeEqual(hash, storedHashPart)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function getJwtSecret(): Uint8Array {
  const secret = process.env[JWT_SECRET_ENV]
  if (!secret || secret.length < 32) {
    throw new Error(
      `JWT_SECRET muss gesetzt sein (mind. 32 Zeichen). Setze z.B. in .dev.vars oder wrangler secret.`
    )
  }
  return new TextEncoder().encode(secret)
}

/** JWT erstellen */
export async function createToken(user: SessionUser): Promise<string> {
  const secret = getJwtSecret()
  const jwt = await new jose.SignJWT({
    email: user.email,
    role: user.role,
    mitreisender_id: user.mitreisender_id
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_AGE_SEC + 's')
    .sign(secret)
  return jwt
}

/** JWT verifizieren und Payload zurückgeben */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jose.jwtVerify(token, secret)
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      mitreisender_id: (payload.mitreisender_id as string | null) ?? null,
      exp: payload.exp,
      iat: payload.iat
    }
  } catch {
    return null
  }
}

/** Token aus Request-Cookie lesen */
export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, v] = c.trim().split('=')
      return [k?.trim(), v?.trim()]
    })
  )
  return cookies[COOKIE_NAME] ?? null
}

/** Session aus Request ermitteln */
export async function getSession(request: Request): Promise<SessionUser | null> {
  const token = getTokenFromRequest(request)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    mitreisender_id: payload.mitreisender_id ?? null
  }
}

/** Session aus Next.js cookies (Server Components) */
export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token).then(p =>
    p
      ? {
          id: p.sub,
          email: p.email,
          role: p.role,
          mitreisender_id: p.mitreisender_id ?? null
        }
      : null
  )
}

export { COOKIE_NAME, TOKEN_AGE_SEC }
