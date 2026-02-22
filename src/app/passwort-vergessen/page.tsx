import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tent } from 'lucide-react'

export default function PasswortVergessenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[rgb(250,250,249)] p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[rgb(45,79,30)] rounded-xl flex items-center justify-center">
            <Tent className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[rgb(45,79,30)]">Passwort vergessen</h1>
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
