'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'

export default function KonfigurationPage() {
  return (
    <ConfigPageLayout>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Hier verwalten Sie Stammdaten, Personen und Transportmittel. Datensicherung und
        Integrationen sind nur für System-Administratoren verfügbar.
      </p>
    </ConfigPageLayout>
  )
}
