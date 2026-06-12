'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode
} from 'react'
import type { UserRole } from '@/lib/user-roles'
import { isAdminRole, isSystemAdminRole } from '@/lib/user-roles'
import { getCachedAuthUser, scheduleChecklistenPrefetch, subscribeToOnlineStatus } from '@/lib/offline-sync'
import { cacheAuthUser, clearAuthUser } from '@/lib/offline-db'
import type { Personentyp } from '@/lib/db'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  mitreisender_id: string | null
  personentyp?: Personentyp | null
  gruppe_id?: string | null
  permissions: string[]
  must_change_password?: boolean
  is_system_admin?: boolean
  is_admin?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  fromCache: boolean
  logout: () => Promise<void>
  refetch: () => Promise<void>
  canAccessConfig: boolean
  canAccessSystemAdmin: boolean
  canSelectOtherProfiles: boolean
  gepacktRequiresParentApproval: boolean
  canEditPauschalEntries: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  const fetchUser = useCallback(async () => {
    let cacheLoaded = false
    try {
      const cached = await getCachedAuthUser()
      if (cached) {
        setUser(cached)
        setFromCache(true)
        cacheLoaded = true
      }
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch('/api/auth/me')
      const data = (await res.json()) as { success?: boolean; user?: AuthUser }
      if (res.ok && data.success && data.user) {
        setUser(data.user)
        setFromCache(false)
        try {
          await cacheAuthUser(data.user)
        } catch (err) {
          console.warn('Auth-Cache schreiben fehlgeschlagen:', err)
        }
        scheduleChecklistenPrefetch()
      } else if (res.ok) {
        setUser(null)
        setFromCache(false)
        try {
          await clearAuthUser()
        } catch {
          /* ignore */
        }
      }
    } catch {
      if (!cacheLoaded) {
        setUser(null)
        setFromCache(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    let init = true
    let lastOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    return subscribeToOnlineStatus((online) => {
      if (init) {
        init = false
        lastOnline = online
        return
      }
      if (online && !lastOnline) {
        scheduleChecklistenPrefetch()
      }
      lastOnline = online
    })
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    try {
      await clearAuthUser()
    } catch {
      /* ignore */
    }
    setUser(null)
    setFromCache(false)
    window.location.href = '/login'
  }, [])

  const canAccessConfig = isAdminRole(user?.role ?? 'standard')
  const canAccessSystemAdmin = isSystemAdminRole(user?.role ?? 'standard')
  const canSelectOtherProfiles = useMemo(() => {
    if (!user) return false
    if (isAdminRole(user.role)) return true
    return user.role === 'standard' && user.personentyp === 'erwachsen'
  }, [user])

  const gepacktRequiresParentApproval = useMemo(() => {
    if (!user || isAdminRole(user.role)) return false
    if (user.personentyp !== 'kind') return false
    return user.permissions?.includes('gepackt_erfordert_elternkontrolle') ?? false
  }, [user])

  const canEditPauschalEntries =
    canAccessConfig || (user?.permissions?.includes('can_edit_pauschal_entries') ?? false)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        fromCache,
        logout,
        refetch: fetchUser,
        canAccessConfig,
        canAccessSystemAdmin,
        canSelectOtherProfiles,
        gepacktRequiresParentApproval,
        canEditPauschalEntries,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
