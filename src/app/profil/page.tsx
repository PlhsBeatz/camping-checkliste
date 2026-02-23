'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, KeyRound } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function ProfilPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(250,250,249)]">
        <p className="text-gray-600">Wird geladen…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-[rgb(250,250,249)]">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setShowNavSidebar(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-[rgb(45,79,30)]">Mein Profil</h1>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-2xl">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">Kontodaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">E-Mail</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rolle</p>
                <p className="font-medium capitalize">{user.role}</p>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/profil/passwort-aendern" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Passwort ändern
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
