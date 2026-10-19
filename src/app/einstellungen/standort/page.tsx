'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { ReiseGpsSettings } from '@/components/reise-gps-settings'
import { HomeAddressSettings } from '@/components/home-address-settings'

export default function StandortPage() {
  return (
    <ConfigPageLayout requireConfig={false}>
      <div className="space-y-6">
        <HomeAddressSettings />
        <ReiseGpsSettings />
      </div>
    </ConfigPageLayout>
  )
}
