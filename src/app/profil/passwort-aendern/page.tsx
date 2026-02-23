'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schemaNormal = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort erforderlich'),
  newPassword: z.string().min(6, 'Mindestens 6 Zeichen'),
  newPasswordConfirm: z.string()
}).refine((d) => d.newPassword === d.newPasswordConfirm, {
  message: 'Passwörter stimmen nicht überein',
  path: ['newPasswordConfirm']
})

const schemaMustChange = z.object({
  newPassword: z.string().min(6, 'Mindestens 6 Zeichen'),
  newPasswordConfirm: z.string()
}).refine((d) => d.newPassword === d.newPasswordConfirm, {
  message: 'Passwörter stimmen nicht überein',
  path: ['newPasswordConfirm']
})

type FormNormal = z.infer<typeof schemaNormal>
type FormMustChange = z.infer<typeof schemaMustChange>

export default function PasswortAendernPage() {
  const { user, loading, refetch } = useAuth()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mustChange = user?.must_change_password === true

  const formNormal = useForm<FormNormal>({
    resolver: zodResolver(schemaNormal),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' }
  })
  const formMustChange = useForm<FormMustChange>({
    resolver: zodResolver(schemaMustChange),
    defaultValues: { newPassword: '', newPasswordConfirm: '' }
  })

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

  const onSubmitNormal = async (data: FormNormal) => {
    setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      })
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Passwort konnte nicht geändert werden')
      return
    }
    await refetch()
    router.push('/profil')
    router.refresh()
  }

  const onSubmitMustChange = async (data: FormMustChange) => {
    setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: data.newPassword })
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Passwort konnte nicht geändert werden')
      return
    }
    await refetch()
    router.push('/profil')
    router.refresh()
  }

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
                  Passwort ändern
                </h1>
              </div>
            </div>
          </div>

        <main className="max-w-md">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-base">
                {mustChange ? 'Neues Passwort festlegen' : 'Passwort ändern'}
              </CardTitle>
              {mustChange && (
                <p className="text-sm text-gray-600">
                  Ihr Passwort wurde zurückgesetzt. Bitte legen Sie ein neues Passwort fest.
                </p>
              )}
            </CardHeader>
            <CardContent>
              {mustChange ? (
                <form onSubmit={formMustChange.handleSubmit(onSubmitMustChange)} className="space-y-4">
                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Neues Passwort</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      {...formMustChange.register('newPassword')}
                    />
                    {formMustChange.formState.errors.newPassword && (
                      <p className="text-sm text-red-600">
                        {formMustChange.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPasswordConfirm">Passwort bestätigen</Label>
                    <Input
                      id="newPasswordConfirm"
                      type="password"
                      autoComplete="new-password"
                      {...formMustChange.register('newPasswordConfirm')}
                    />
                    {formMustChange.formState.errors.newPasswordConfirm && (
                      <p className="text-sm text-red-600">
                        {formMustChange.formState.errors.newPasswordConfirm.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={formMustChange.formState.isSubmitting}
                  >
                    {formMustChange.formState.isSubmitting ? 'Wird gespeichert…' : 'Passwort speichern'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={formNormal.handleSubmit(onSubmitNormal)} className="space-y-4">
                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      {...formNormal.register('currentPassword')}
                    />
                    {formNormal.formState.errors.currentPassword && (
                      <p className="text-sm text-red-600">
                        {formNormal.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Neues Passwort</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      {...formNormal.register('newPassword')}
                    />
                    {formNormal.formState.errors.newPassword && (
                      <p className="text-sm text-red-600">
                        {formNormal.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPasswordConfirm">Passwort bestätigen</Label>
                    <Input
                      id="newPasswordConfirm"
                      type="password"
                      autoComplete="new-password"
                      {...formNormal.register('newPasswordConfirm')}
                    />
                    {formNormal.formState.errors.newPasswordConfirm && (
                      <p className="text-sm text-red-600">
                        {formNormal.formState.errors.newPasswordConfirm.message}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={formNormal.formState.isSubmitting}
                    >
                      {formNormal.formState.isSubmitting ? 'Wird gespeichert…' : 'Passwort ändern'}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/profil">Abbrechen</Link>
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </main>
        </div>
      </div>
    </div>
  )
}
