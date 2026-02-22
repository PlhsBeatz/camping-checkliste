'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppLogo } from '@/components/app-logo'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(6, 'Mindestens 6 Zeichen'),
  passwordConfirm: z.string()
}).refine(data => data.password === data.passwordConfirm, {
  message: 'Passwörter stimmen nicht überein',
  path: ['passwordConfirm']
})

type FormData = z.infer<typeof schema>

export default function EinladungPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const [invitation, setInvitation] = useState<{
    mitreisender_name: string
    role: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  useEffect(() => {
    if (!token) return
    fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then((data: unknown) => {
        const d = data as { success?: boolean; mitreisender_name?: string; role?: string; error?: string }
        if (d.success && d.mitreisender_name) {
          setInvitation({
            mitreisender_name: d.mitreisender_name,
            role: d.role ?? ''
          })
        } else {
          setError(d.error ?? 'Einladung ungültig')
        }
      })
      .catch(() => setError('Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [token])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        email: data.email,
        password: data.password
      })
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Registrierung fehlgeschlagen')
      return
    }
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[rgb(250,250,249)]">
        <p className="text-gray-600">Lade Einladung…</p>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[rgb(250,250,249)] p-4 gap-4">
        <p className="text-red-600 text-center">{error}</p>
        <Button asChild variant="outline">
          <a href="/login">Zur Anmeldung</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[rgb(250,250,249)] p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <AppLogo size="default" variant="centered" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-[rgb(45,79,30)]">Einladung annehmen</h2>
            <p className="text-gray-600 mt-1">
              Konto erstellen für: <strong>{invitation?.mitreisender_name}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@beispiel.de"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
            <Input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              {...register('passwordConfirm')}
            />
            {errors.passwordConfirm && (
              <p className="text-sm text-red-600">{errors.passwordConfirm.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Wird erstellt…' : 'Konto erstellen und anmelden'}
          </Button>
        </form>
      </div>
    </div>
  )
}
