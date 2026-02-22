'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tent } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(1, 'Passwort erforderlich')
})

type FormData = z.infer<typeof schema>

function LoginForm() {
  const router = useRouter()
  const { refetch } = useAuth()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email, password: data.password })
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Login fehlgeschlagen')
      return
    }
    await refetch()
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[rgb(250,250,249)] p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[rgb(45,79,30)] rounded-xl flex items-center justify-center">
            <Tent className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[rgb(45,79,30)]">CAMPPACK</h1>
            <p className="text-sm text-gray-600">Anmelden</p>
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
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Wird angemeldet…' : 'Anmelden'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          <Link
            href="/passwort-vergessen"
            className="text-[rgb(45,79,30)] hover:underline"
          >
            Passwort vergessen?
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[rgb(250,250,249)]">
        <p className="text-gray-600">Wird geladen…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
