'use client'

import { useEffect, useRef } from 'react'
import { TempPromoteEquipmentDialog } from '@/components/temp-promote-equipment-dialog'
import { useTempPromoteEquipment } from '@/hooks/use-temp-promote-equipment'

/**
 * Lazy-mountbarer Host für den Heute-Hub: lädt Katalog/Prefill erst bei requestId.
 * Wird per dynamic() eingebunden, damit der Hub-Chunk schlank bleibt.
 */
export function TempPromoteEquipmentHost({
  requestId,
  onRequestClear,
  onCompleted,
}: {
  requestId: string | null
  onRequestClear: () => void
  onCompleted: () => void | Promise<void>
}) {
  const { opening, openingId, openForSuggestionId, dialogState } = useTempPromoteEquipment({
    onCompleted,
  })
  const seq = useRef(0)
  const openRef = useRef(openForSuggestionId)
  openRef.current = openForSuggestionId
  const clearRef = useRef(onRequestClear)
  clearRef.current = onRequestClear

  useEffect(() => {
    if (!requestId) return
    const mySeq = ++seq.current
    const id = requestId
    void (async () => {
      try {
        await openRef.current(id)
      } finally {
        if (seq.current === mySeq) clearRef.current()
      }
    })()
  }, [requestId])

  return (
    <>
      {(opening || openingId) && (
        <span className="sr-only" aria-live="polite">
          Ausrüstungs-Dialog wird vorbereitet…
        </span>
      )}
      <TempPromoteEquipmentDialog state={dialogState} />
    </>
  )
}
