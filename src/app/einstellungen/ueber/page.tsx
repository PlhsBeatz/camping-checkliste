'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { FeedbackAboutPage } from '@/components/feedback-about-page'

export default function UeberDieAppPage() {
  return (
    <ConfigPageLayout requireConfig={false}>
      <FeedbackAboutPage />
    </ConfigPageLayout>
  )
}
