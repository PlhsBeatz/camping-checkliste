import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/app-logo'

export default function PasswortVergessenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[rgb(250,250,249)] p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <AppLogo size="default" variant="centered" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-[rgb(45,79,30)]">Passwort vergessen</h2>
            <p className="text-gray-600 mt-2">
              Es ist keine Selbst-Service-Funktion für das Zurücksetzen des Passworts aktiv.
              Bitte wenden Sie sich an einen Administrator, damit dieser Ihr Passwort zurücksetzen kann.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login">Zurück zur Anmeldung</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
