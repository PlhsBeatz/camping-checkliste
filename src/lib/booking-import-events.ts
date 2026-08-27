export const BOOKING_IMPORT_CHANGED_EVENT = 'camping-booking-import-changed'

export function notifyBookingImportChanged(count?: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(BOOKING_IMPORT_CHANGED_EVENT, {
      detail: count != null ? { count } : undefined,
    })
  )
}
