'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { PushNotificationSettings } from '@/components/push-notification-settings'

export default function BenachrichtigungenPage() {
  return (
    <ConfigPageLayout requireConfig={false}>
      <PushNotificationSettings />
    </ConfigPageLayout>
  )
}
