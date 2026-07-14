'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const PUSH_DEVICE_SUBSCRIBED_EVENT = 'push-device-subscribed'

type PushDeviceActivatePromptProps = {
  /** Push im Profil grundsätzlich aktiviert */
  accountPushEnabled: boolean
  /** Dieser Browser hat ein aktives Push-Abo */
  deviceSubscribed: boolean
  pushSupported: boolean
  onActivate: () => Promise<boolean>
  activateError?: string | null
  /** Profil: ausführlich. banner: kompakt auf der Startseite */
  variant?: 'profile' | 'banner'
  className?: string
  onActivated?: () => void
}

/**
 * Zeigt „Push auf diesem Gerät aktivieren“, wenn das Konto Push will,
 * dieser Browser aber noch kein Abo hat.
 */
export function PushDeviceActivatePrompt({
  accountPushEnabled,
  deviceSubscribed,
  pushSupported,
  onActivate,
  activateError,
  variant = 'profile',
  className,
  onActivated,
}: PushDeviceActivatePromptProps) {
  const [activating, setActivating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  if (!accountPushEnabled || !pushSupported || deviceSubscribed) {
    return null
  }

  const displayError = localError ?? activateError

  const handleActivate = async () => {
    setActivating(true)
    setLocalError(null)
    const ok = await onActivate()
    if (ok) {
      window.dispatchEvent(new CustomEvent(PUSH_DEVICE_SUBSCRIBED_EVENT))
      onActivated?.()
    } else {
      setLocalError(activateError ?? 'Aktivierung fehlgeschlagen.')
    }
    setActivating(false)
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'mx-4 mb-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 text-sm flex flex-col sm:flex-row sm:items-center gap-3',
          className
        )}
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Smartphone className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-900 dark:text-amber-100">
            Push ist in deinem Profil aktiv, aber auf <strong>diesem Gerät</strong> noch nicht
            eingerichtet.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-300 dark:border-amber-700"
          disabled={activating}
          onClick={() => void handleActivate()}
        >
          {activating ? 'Wird eingerichtet…' : 'Jetzt aktivieren'}
        </Button>
        {displayError && (
          <p className="text-xs text-destructive sm:basis-full">{displayError}</p>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <Smartphone className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-50">
            Push auf diesem Gerät einrichten
          </p>
          <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
            In deinem Profil sind Benachrichtigungen aktiv (gilt für dein Konto). Dieses Gerät
            braucht noch ein eigenes Abo – der Browser fragt einmalig nach Erlaubnis.
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={activating}
        onClick={() => void handleActivate()}
        className="w-full sm:w-auto"
      >
        <Bell className="h-4 w-4 mr-2" />
        {activating ? 'Wird eingerichtet…' : 'Push auf diesem Gerät aktivieren'}
      </Button>
      {displayError && <p className="text-sm text-destructive">{displayError}</p>}
      <p className="text-xs text-muted-foreground">
        Einstellungen für alle Geräte unter{' '}
        <Link href="/profil" className="underline underline-offset-2">
          Profil → Benachrichtigungen
        </Link>
        .
      </p>
    </div>
  )
}
