'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { optimierungFotoSrc } from '@/components/optimierung-shared'
import type { OptimierungFoto } from '@/lib/db'

export function OptimierungPhotoLightbox({
  fotos,
  openId,
  onClose,
  onChangeId,
}: {
  fotos: OptimierungFoto[]
  openId: string | null
  onClose: () => void
  onChangeId?: (id: string) => void
}) {
  const index = useMemo(() => {
    if (!openId) return -1
    return fotos.findIndex((f) => f.id === openId)
  }, [fotos, openId])

  const goPrev = useCallback(() => {
    if (index <= 0) return
    const prev = fotos[index - 1]
    if (prev) onChangeId?.(prev.id)
  }, [fotos, index, onChangeId])

  const goNext = useCallback(() => {
    if (index < 0 || index >= fotos.length - 1) return
    const next = fotos[index + 1]
    if (next) onChangeId?.(next.id)
  }, [fotos, index, onChangeId])

  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, goPrev, goNext])

  return (
    <Dialog
      open={openId != null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        hideCloseButton
        className="fixed inset-0 left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center border-0 bg-black/90 p-3 shadow-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">Foto</DialogTitle>
        {openId ? (
          <div className="relative flex max-h-[90dvh] items-center justify-center">
            <button
              type="button"
              aria-label="Schließen"
              onClick={onClose}
              className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>
            {fotos.length > 1 ? (
              <button
                type="button"
                aria-label="Vorheriges Foto"
                disabled={index <= 0}
                onClick={goPrev}
                className="absolute left-1 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/55 disabled:opacity-25"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimierungFotoSrc(openId)}
              alt=""
              className="max-h-[90dvh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            {fotos.length > 1 ? (
              <button
                type="button"
                aria-label="Nächstes Foto"
                disabled={index < 0 || index >= fotos.length - 1}
                onClick={goNext}
                className="absolute right-1 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/55 disabled:opacity-25"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            ) : null}
            {fotos.length > 1 && index >= 0 ? (
              <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                {index + 1} / {fotos.length}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
