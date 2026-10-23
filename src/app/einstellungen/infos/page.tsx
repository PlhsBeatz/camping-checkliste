'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { AppInfosPage } from '@/components/app-infos-page'

export default function InfosZurAppPage() {
  return (
    <ConfigPageLayout requireConfig={false}>
      <AppInfosPage />
    </ConfigPageLayout>
  )
}
