'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'

export default function DarstellungPage() {
  return (
    <ConfigPageLayout requireConfig={false}>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Darstellung</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle className="max-w-xs" />
        </CardContent>
      </Card>
    </ConfigPageLayout>
  )
}
