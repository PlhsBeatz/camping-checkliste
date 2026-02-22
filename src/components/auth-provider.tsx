'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from 'react'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'kind' | 'gast'
  mitreisender_id: string | null
  permissions: string[]
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  refetch: () => Promise<void>
  canAccessConfig: boolean
  canSelectOtherProfiles: boolean
  /** Kind mit Berechtigung: Gepackt-Anzeige erfordert Eltern-Bestätigung */
  gepacktRequiresParentApproval: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = (await res.json()) as { success?: boolean; user?: AuthUser }
      if (res.ok && data.success && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    window.location.href = '/login'
  }, [])

  const canAccessConfig = user?.role === 'admin'
  const canSelectOtherProfiles = user?.role === 'admin'
  const gepacktRequiresParentApproval = !canAccessConfig && (user?.permissions?.includes('gepackt_erfordert_elternkontrolle') ?? false)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        refetch: fetchUser,
        canAccessConfig,
        canSelectOtherProfiles,
        gepacktRequiresParentApproval
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
