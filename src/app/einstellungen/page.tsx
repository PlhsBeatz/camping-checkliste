'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { useAuth } from '@/components/auth-provider'

export default function EinstellungenPage() {
  const { canAccessConfig } = useAuth()

  return (
    <ConfigPageLayout requireConfig={false}>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Darstellung, Benachrichtigungen, Standort und Konto – plus Infos zur App.
        {canAccessConfig
          ? ' Als Administrator verwalten Sie hier außerdem Stammdaten; Datensicherung und Integrationen sind nur für System-Administratoren verfügbar.'
          : null}
      </p>
    </ConfigPageLayout>
  )
}
