'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useBookingImportBadgeState } from '@/hooks/use-booking-import-badge'

const BookingImportBadgeContext = createContext(0)

export function BookingImportBadgeProvider({ children }: { children: ReactNode }) {
  const { canAccessConfig, loading } = useAuth()
  const enabled = canAccessConfig && !loading
  const count = useBookingImportBadgeState(enabled)

  return (
    <BookingImportBadgeContext.Provider value={enabled ? count : 0}>
      {children}
    </BookingImportBadgeContext.Provider>
  )
}

export function useBookingImportBadge() {
  return useContext(BookingImportBadgeContext)
}
