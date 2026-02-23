'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Menu, KeyRound, Copy, Share2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface UserRow {
  id: string
  email: string
  role: string
  mitreisender_id: string | null
  mitreisender_name?: string | null
}

export default function BenutzerPage() {
  const { canAccessConfig, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<{
    email: string
    temporaryPassword: string
  } | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)

  useEffect(() => {
    if (!loading && !canAccessConfig) router.replace('/')
  }, [loading, canAccessConfig, router])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users')
        const data = (await res.json()) as { success?: boolean; users?: UserRow[] }
        if (data.success && Array.isArray(data.users)) setUsers(data.users)
      } catch {
        setUsers([])
      } finally {
        setLoadingUsers(false)
      }
    }
    if (canAccessConfig) fetchUsers()
  }, [canAccessConfig])

  useEffect(() => {
    if (showNavSidebar) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNavSidebar])

  const handleResetPassword = async (userId: string) => {
    setResettingUserId(userId)
    setResetResult(null)
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      const data = (await res.json()) as {
        success?: boolean
        temporaryPassword?: string
        email?: string
        error?: string
      }
      if (data.success && data.temporaryPassword != null) {
        setResetResult({
          email: data.email ?? '',
          temporaryPassword: data.temporaryPassword
        })
      } else {
        alert(data.error ?? 'Passwort konnte nicht zurückgesetzt werden')
      }
    } catch {
      alert('Fehler beim Zurücksetzen')
    } finally {
      setResettingUserId(null)
    }
  }

  const copyPassword = () => {
    if (!resetResult) return
    navigator.clipboard?.writeText(resetResult.temporaryPassword).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    })
  }

  const sharePassword = () => {
    if (!resetResult) return
    const text = `Neues Passwort für ${resetResult.email}:\n\n${resetResult.temporaryPassword}\n\nBitte nach dem ersten Login unter „Mein Profil“ → „Passwort ändern“ ein eigenes Passwort setzen.`
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Passwort zurückgesetzt',
        text
      }).catch(() => {
        navigator.clipboard?.writeText(text)
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 2000)
      })
    } else {
      navigator.clipboard?.writeText(text)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    }
  }

  const closeResetDialog = () => {
    setResetResult(null)
  }

  if (!canAccessConfig) return null

  return (
    <div className="min-h-screen flex bg-[rgb(250,250,249)]">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />
      <div className={cn('flex-1 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          <div className="sticky top-0 z-10 flex items-center gap-4 bg-[rgb(250,250,249)] pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowNavSidebar(true)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                Benutzer
              </h1>
              <p className="text-sm text-gray-600">Passwort zurücksetzen und Konten verwalten</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alle Benutzer</CardTitle>
              <CardDescription>
                Hier können Sie für jeden Benutzer ein neues Passwort setzen. Der Benutzer erhält ein
                temporäres Passwort und muss es beim nächsten Login ändern.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <p className="text-gray-600 py-4">Lade Benutzer…</p>
              ) : users.length === 0 ? (
                <p className="text-gray-600 py-4">Keine Benutzer gefunden.</p>
              ) : (
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-white border border-gray-200"
                    >
                      <div>
                        <p className="font-medium">{u.email}</p>
                        <p className="text-sm text-gray-500">
                          {u.role}
                          {u.mitreisender_name ? ` · ${u.mitreisender_name}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(u.id)}
                        disabled={!!resettingUserId}
                        className="flex items-center gap-2"
                      >
                        <KeyRound className="h-4 w-4" />
                        {resettingUserId === u.id ? 'Wird zurückgesetzt…' : 'Passwort zurücksetzen'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!resetResult} onOpenChange={(open) => !open && closeResetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passwort zurückgesetzt</DialogTitle>
            <DialogDescription>
              Das temporäre Passwort für <strong>{resetResult?.email}</strong> wurde erstellt. Der
              Benutzer muss sich damit anmelden und unter „Mein Profil“ → „Passwort ändern“ ein neues
              Passwort setzen.
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-100 p-4 font-mono text-sm break-all select-all">
                {resetResult.temporaryPassword}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={copyPassword} variant="outline" className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  {copyFeedback ? 'Kopiert!' : 'Kopieren'}
                </Button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <Button onClick={sharePassword} variant="outline" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Teilen
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
