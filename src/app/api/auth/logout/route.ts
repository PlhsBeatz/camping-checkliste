import { NextResponse } from 'next/server'
import { COOKIE_NAME, getAuthCookieOptions } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  const cleared = { ...getAuthCookieOptions(), maxAge: 0 }
  response.cookies.set(COOKIE_NAME, '', cleared)
  return response
}
