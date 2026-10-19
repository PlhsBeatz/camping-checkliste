'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfigPageLayout } from '@/components/config-page-layout'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schemaNormal = z
  .object({
    currentPassword: z.string().min(1, 'Aktuelles Passwort erforderlich'),
    newPassword: z.string().min(6, 'Mindestens 6 Zeichen'),
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['newPasswordConfirm'],
  })

const schemaMustChange = z
  .object({
    newPassword: z.string().min(6, 'Mindestens 6 Zeichen'),
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: 'Passwörter stimmen nicht überein',
    path: ['newPasswordConfirm'],
  })

type FormNormal = z.infer<typeof schemaNormal>
type FormMustChange = z.infer<typeof schemaMustChange>

export default function PasswortAendernPage() {
  const { user, loading, refetch } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const mustChange = user?.must_change_password === true

  const formNormal = useForm<FormNormal>({
    resolver: zodResolver(schemaNormal),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
  })
  const formMustChange = useForm<FormMustChange>({
    resolver: zodResolver(schemaMustChange),
    defaultValues: { newPassword: '', newPasswordConfirm: '' },
  })

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const onSubmitNormal = async (data: FormNormal) => {
    setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Passwort konnte nicht geändert werden')
      return
    }
    await refetch()
    router.push('/einstellungen/konto')
    router.refresh()
  }

  const onSubmitMustChange = async (data: FormMustChange) => {
    setError(null)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: data.newPassword }),
    })
    const json = (await res.json()) as { success?: boolean; error?: string }
    if (!res.ok || !json.success) {
      setError(json.error ?? 'Passwort konnte nicht geändert werden')
      return
    }
    await refetch()
    router.push('/einstellungen')
    router.refresh()
  }

  return (
    <ConfigPageLayout requireConfig={false}>
      <main className="max-w-md">
        <Card className="border-subtle">
          <CardHeader>
            <CardTitle className="text-base">
              {mustChange ? 'Neues Passwort festlegen' : 'Passwort ändern'}
            </CardTitle>
            {mustChange && (
              <p className="text-sm text-muted-foreground">
                Ihr Passwort wurde zurückgesetzt. Bitte legen Sie ein neues Passwort fest.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {mustChange ? (
              <form
                onSubmit={formMustChange.handleSubmit(onSubmitMustChange)}
                className="space-y-4"
              >
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
                  {formMustChange.formState.isSubmitting
                    ? 'Wird gespeichert…'
                    : 'Passwort speichern'}
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
                  <Button type="submit" disabled={formNormal.formState.isSubmitting}>
                    {formNormal.formState.isSubmitting
                      ? 'Wird gespeichert…'
                      : 'Passwort ändern'}
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/einstellungen/konto">Abbrechen</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </ConfigPageLayout>
  )
}
