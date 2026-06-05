'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'

export default function KonfigurationPage() {
  return (
    <ConfigPageLayout>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Hier verwalten Sie Stammdaten, Personen, Transportmittel sowie Datensicherung und
        Integrationen. Wählen Sie einen Bereich in der Navigation.
      </p>
    </ConfigPageLayout>
  )
}
