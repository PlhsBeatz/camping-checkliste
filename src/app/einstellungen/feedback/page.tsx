'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { FeedbackPage } from '@/components/feedback-page'

export default function FeedbackEinstellungenPage() {
  return (
    <ConfigPageLayout requireConfig={false}>
      <FeedbackPage />
    </ConfigPageLayout>
  )
}
