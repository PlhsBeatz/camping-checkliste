'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from 'react'
import { getCachedAuthUser } from '@/lib/offline-sync'
import { cacheAuthUser, clearAuthUser } from '@/lib/offline-db'

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'kind' | 'gast'
  mitreisender_id: string | null
  permissions: string[]
  /** Nach Admin-Passwort-Reset: Passwort muss geändert werden */
  must_change_password?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  /** Wird true gesetzt, wenn `user` aus dem Offline-Cache stammt und nicht frisch vom Server. */
  fromCache: boolean
  logout: () => Promise<void>
  refetch: () => Promise<void>
  canAccessConfig: boolean
  canSelectOtherProfiles: boolean
  /** Kind mit Berechtigung: Gepackt-Anzeige erfordert Eltern-Bestätigung */
  gepacktRequiresParentApproval: boolean
  /** Kind/Gast darf pauschale Einträge bearbeiten/sehen (wenn Berechtigung gesetzt) */
  canEditPauschalEntries: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  const fetchUser = useCallback(async () => {
    let cacheLoaded = false
    // 1) Optimistisch aus IndexedDB-Cache laden, damit die App offline sofort
    //    den letzten bekannten User hat.
    try {
      const cached = await getCachedAuthUser()
      if (cached) {
        setUser(cached)
        setFromCache(true)
        cacheLoaded = true
      }
    } catch {
      // egal, Server ist Quelle der Wahrheit
    }

    // 2) Im Hintergrund vom Server holen.
    try {
      const res = await fetch('/api/auth/me')
      const data = (await res.json()) as { success?: boolean; user?: AuthUser }
      if (res.ok && data.success && data.user) {
        setUser(data.user)
        setFromCache(false)
        // 3) Cache aktualisieren.
        try {
          await cacheAuthUser(data.user)
        } catch (err) {
          console.warn('Auth-Cache schreiben fehlgeschlagen:', err)
        }
      } else if (res.ok) {
        // Server sagt explizit "nicht eingeloggt" → Cache leeren.
        setUser(null)
        setFromCache(false)
        try {
          await clearAuthUser()
        } catch {
          /* ignore */
        }
      }
      // Bei !res.ok behalten wir den Cache-User, da das auf einen Server-Fehler hindeuten kann.
    } catch {
      // Netzwerkfehler → wenn wir einen Cache-User haben, behalten wir ihn.
      // Ohne Cache: bleibt user=null.
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

  const logout = useCallback(async () => {
    // Best-effort Logout: auch wenn der Server-Call fehlschlägt, lokal ausloggen.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* ignore – Cookie kann offline nicht serverseitig gelöscht werden */
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

  const canAccessConfig = user?.role === 'admin'
  const canSelectOtherProfiles = user?.role === 'admin'
  const gepacktRequiresParentApproval = !canAccessConfig && (user?.permissions?.includes('gepackt_erfordert_elternkontrolle') ?? false)
  const canEditPauschalEntries = canAccessConfig || (user?.permissions?.includes('can_edit_pauschal_entries') ?? false)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        fromCache,
        logout,
        refetch: fetchUser,
        canAccessConfig,
        canSelectOtherProfiles,
        gepacktRequiresParentApproval,
        canEditPauschalEntries
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
