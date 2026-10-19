'use client'

import Link from 'next/link'
import { KeyRound, LogOut } from 'lucide-react'
import { ConfigPageLayout } from '@/components/config-page-layout'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function MeinKontoPage() {
  const { user, logout } = useAuth()

  return (
    <ConfigPageLayout requireConfig={false}>
      <div className="space-y-6">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Zugangsdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">E-Mail</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rolle</p>
              <p className="font-medium capitalize">{user?.role}</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto hover:bg-secondary hover:text-secondary-foreground"
            >
              <Link
                href="/einstellungen/passwort-aendern"
                className="flex items-center gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Passwort ändern
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-subtle">
          <CardHeader>
            <CardTitle>Sitzung beenden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hier können Sie sich von diesem Gerät abmelden. Offline zwischengespeicherte
              Daten bleiben auf dem Gerät, bis Sie die App-Daten löschen.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto hover:bg-secondary hover:text-secondary-foreground"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    </ConfigPageLayout>
  )
}
