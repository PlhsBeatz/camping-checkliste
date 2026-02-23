'use client'

import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, KeyRound } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

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
    <div className="min-h-screen flex">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />
      <div className={cn('flex-1 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center gap-4">
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
                  Mein Profil
                </h1>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kontodaten</CardTitle>
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
        </div>
      </div>
    </div>
  )
}
