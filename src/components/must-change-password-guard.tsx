'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

/**
 * Leitet eingeloggte User mit must_change_password auf die Passwort-Änderungsseite um.
 */
export function MustChangePasswordGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading || !user) return
    if (!user.must_change_password) return
    if (pathname === '/profil' || pathname?.startsWith('/profil/')) return
    router.replace('/profil/passwort-aendern')
  }, [user, loading, pathname, router])

  return <>{children}</>
}
