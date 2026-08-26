'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
  type TransitionEvent,
} from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export type PhotoLightboxItem = { id: string }

/**
 * Vollbild-Fotoansicht mit Wischen (links/rechts zwischen Bildern, nach unten schließen).
 * Gemeinsam für Campingplätze und Optimierungen.
 */
export function PhotoLightbox({
  fotos,
  openId,
  onOpenIdChange,
  imageSrc,
}: {
  fotos: PhotoLightboxItem[]
  openId: string | null
  onOpenIdChange: (id: string | null) => void
  imageSrc: (fotoId: string) => string
}) {
  const lightboxTouchRef = useRef<{ x: number; y: number } | null>(null)
  const lightboxSwipeNavRef = useRef<'next' | 'prev' | null>(null)
  const lightboxGestureModeRef = useRef<'h' | 'v' | null>(null)
  const lightboxDismissFinishingRef = useRef(false)
  const lightboxWasOpenRef = useRef(false)
  const lightboxClosingRef = useRef(false)
  const fotosRef = useRef(fotos)
  const openIdRef = useRef(openId)
  const [lightboxImgTxPx, setLightboxImgTxPx] = useState(0)
  const [lightboxImgTxOn, setLightboxImgTxOn] = useState(true)
  /** Nach-unten-Wischen: vertikaler Offset + Verkleinerung (Lightbox schließen) */
  const [lightboxPullDy, setLightboxPullDy] = useState(0)
  const lightboxPullDyRef = useRef(0)

  openIdRef.current = openId

  const setLightboxFotoId = useCallback(
    (next: SetStateAction<string | null>) => {
      const resolved = typeof next === 'function' ? next(openIdRef.current) : next
      onOpenIdChange(resolved)
    },
    [onOpenIdChange]
  )

  const lightboxIndex = useMemo(() => {
    if (!openId) return -1
    return fotos.findIndex((f) => f.id === openId)
  }, [openId, fotos])

  const goLightboxPrev = useCallback(() => {
    setLightboxFotoId((id) => {
      if (!id) return null
      const i = fotos.findIndex((f) => f.id === id)
      if (i <= 0) return id
      const prev = fotos[i - 1]
      return prev?.id ?? id
    })
  }, [fotos, setLightboxFotoId])

  const goLightboxNext = useCallback(() => {
    setLightboxFotoId((id) => {
      if (!id) return null
      const i = fotos.findIndex((f) => f.id === id)
      if (i < 0 || i >= fotos.length - 1) return id
      const next = fotos[i + 1]
      return next?.id ?? id
    })
  }, [fotos, setLightboxFotoId])

  useEffect(() => {
    if (openId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goLightboxPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goLightboxNext()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openId, goLightboxPrev, goLightboxNext])

  useEffect(() => {
    fotosRef.current = fotos
  }, [fotos])

  const closeLightbox = useCallback(() => {
    if (lightboxClosingRef.current || openId == null) return
    if (
      typeof window !== 'undefined' &&
      (window.history.state as { photoLightbox?: boolean } | null)?.photoLightbox
    ) {
      lightboxClosingRef.current = true
      window.history.back()
    } else {
      setLightboxFotoId(null)
    }
  }, [openId, setLightboxFotoId])

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (!lightboxClosingRef.current && openIdRef.current == null) return
      e.stopImmediatePropagation()
      lightboxClosingRef.current = false
      setLightboxFotoId((cur) => (cur != null ? null : cur))
    }
    // Capture: Lightbox zuerst schließen, ohne darunterliegende Drawer/Dialoge mitzunehmen
    window.addEventListener('popstate', onPop, true)
    return () => window.removeEventListener('popstate', onPop, true)
  }, [setLightboxFotoId])

  useEffect(() => {
    const open = openId != null
    if (open && !lightboxWasOpenRef.current) {
      const prev =
        typeof window.history.state === 'object' && window.history.state != null
          ? window.history.state
          : {}
      window.history.pushState({ ...prev, photoLightbox: true }, '', window.location.href)
    }
    lightboxWasOpenRef.current = open
    if (!open) {
      lightboxClosingRef.current = false
      setLightboxImgTxPx(0)
      setLightboxImgTxOn(true)
      lightboxSwipeNavRef.current = null
      lightboxGestureModeRef.current = null
      lightboxDismissFinishingRef.current = false
      lightboxPullDyRef.current = 0
      setLightboxPullDy(0)
    }
  }, [openId])

  const lightboxViewportW = useCallback(
    () => (typeof window !== 'undefined' ? window.innerWidth : 400),
    []
  )

  const applyLightboxEnterFromSide = useCallback(
    (side: 'left' | 'right') => {
      const vw = lightboxViewportW()
      setLightboxImgTxOn(false)
      setLightboxImgTxPx(side === 'right' ? vw : -vw)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setLightboxImgTxOn(true)
          setLightboxImgTxPx(0)
        })
      })
    },
    [lightboxViewportW]
  )

  const onLightboxTransformTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'transform' || e.target !== e.currentTarget) return
      if (lightboxDismissFinishingRef.current) {
        lightboxDismissFinishingRef.current = false
        lightboxPullDyRef.current = 0
        setLightboxPullDy(0)
        closeLightbox()
        return
      }
      const nav = lightboxSwipeNavRef.current
      if (!nav) return
      lightboxSwipeNavRef.current = null
      const list = fotosRef.current
      const curId = openId
      if (!curId) return
      const i = list.findIndex((f) => f.id === curId)
      if (nav === 'next' && i >= 0 && i < list.length - 1) {
        const next = list[i + 1]
        if (next) setLightboxFotoId(next.id)
        applyLightboxEnterFromSide('right')
      } else if (nav === 'prev' && i > 0) {
        const prev = list[i - 1]
        if (prev) setLightboxFotoId(prev.id)
        applyLightboxEnterFromSide('left')
      }
    },
    [openId, applyLightboxEnterFromSide, closeLightbox, setLightboxFotoId]
  )

  return (
    <Dialog open={openId != null} onOpenChange={(open) => !open && closeLightbox()}>
      <DialogContent
        hideCloseButton
        className="fixed left-0 top-0 z-50 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 border-0 bg-transparent p-0 shadow-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:rounded-none"
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          closeLightbox()
        }}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Foto Vollansicht</DialogTitle>
        {openId ? (
          <div
            className="flex h-dvh w-screen flex-col"
            style={{
              backgroundColor: `rgba(0,0,0,${Math.max(
                0.05,
                0.92 *
                  (1 -
                    Math.min(
                      1,
                      lightboxPullDy /
                        (typeof window !== 'undefined' ? window.innerHeight * 0.68 : 640)
                    ))
              )})`,
            }}
            onClick={closeLightbox}
          >
            <button
              type="button"
              className="absolute right-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-md bg-[rgb(45,79,30)] text-white shadow-md outline-none ring-offset-2 ring-offset-black/90 transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Schließen"
              onClick={(e) => {
                e.stopPropagation()
                closeLightbox()
              }}
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <div
              className="flex flex-1 flex-col items-center justify-center px-2 pb-6 pt-14"
              onClick={closeLightbox}
            >
              <div
                className="relative flex max-h-full max-w-full items-center justify-center touch-none"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  const t = e.touches[0]
                  if (!t) return
                  lightboxTouchRef.current = { x: t.clientX, y: t.clientY }
                  lightboxSwipeNavRef.current = null
                  lightboxGestureModeRef.current = null
                  setLightboxImgTxOn(false)
                }}
                onTouchMove={(e) => {
                  const start = lightboxTouchRef.current
                  if (!start) return
                  const t = e.touches[0]
                  if (!t) return
                  const dx = t.clientX - start.x
                  const dy = t.clientY - start.y
                  const lockPx = 12

                  if (!lightboxGestureModeRef.current) {
                    if (Math.hypot(dx, dy) < lockPx) return
                    if (fotos.length < 2) {
                      lightboxGestureModeRef.current =
                        dy > 0 && dy >= Math.abs(dx) * 0.55 ? 'v' : 'h'
                    } else {
                      lightboxGestureModeRef.current =
                        Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
                    }
                  }

                  const mode = lightboxGestureModeRef.current
                  if (mode === 'v') {
                    const pull = Math.max(0, dy)
                    lightboxPullDyRef.current = pull
                    setLightboxPullDy(pull)
                    return
                  }
                  if (mode === 'h' && fotos.length >= 2) {
                    if (Math.abs(dx) < Math.abs(dy) && Math.abs(dy) > 12) return
                    setLightboxImgTxPx(dx)
                  }
                }}
                onTouchEnd={(e) => {
                  const start = lightboxTouchRef.current
                  lightboxTouchRef.current = null
                  const mode = lightboxGestureModeRef.current
                  lightboxGestureModeRef.current = null

                  if (mode === 'v') {
                    const vw = lightboxViewportW()
                    const vh = typeof window !== 'undefined' ? window.innerHeight : 640
                    const threshold = Math.min(110, vw * 0.22)
                    const pull = lightboxPullDyRef.current
                    if (pull > threshold) {
                      lightboxDismissFinishingRef.current = true
                      setLightboxImgTxOn(true)
                      lightboxPullDyRef.current = vh * 1.15
                      setLightboxPullDy(vh * 1.15)
                    } else {
                      setLightboxImgTxOn(true)
                      lightboxPullDyRef.current = 0
                      setLightboxPullDy(0)
                    }
                    setLightboxImgTxPx(0)
                    return
                  }

                  if (!start || fotos.length < 2) {
                    setLightboxImgTxOn(true)
                    setLightboxImgTxPx(0)
                    lightboxPullDyRef.current = 0
                    setLightboxPullDy(0)
                    return
                  }
                  const t = e.changedTouches[0]
                  if (!t) {
                    setLightboxImgTxOn(true)
                    setLightboxImgTxPx(0)
                    return
                  }
                  const dx = t.clientX - start.x
                  const dy = t.clientY - start.y
                  const vw = lightboxViewportW()
                  const threshold = Math.min(80, vw * 0.18)
                  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) {
                    setLightboxImgTxOn(true)
                    setLightboxImgTxPx(0)
                    return
                  }
                  if (dx < 0 && lightboxIndex >= 0 && lightboxIndex < fotos.length - 1) {
                    lightboxSwipeNavRef.current = 'next'
                    setLightboxImgTxOn(true)
                    setLightboxImgTxPx(-vw)
                    return
                  }
                  if (dx > 0 && lightboxIndex > 0) {
                    lightboxSwipeNavRef.current = 'prev'
                    setLightboxImgTxOn(true)
                    setLightboxImgTxPx(vw)
                    return
                  }
                  setLightboxImgTxOn(true)
                  setLightboxImgTxPx(0)
                }}
              >
                {fotos.length > 1 && (
                  <button
                    type="button"
                    aria-label="Vorheriges Foto"
                    disabled={lightboxIndex <= 0}
                    className="absolute left-1 top-1/2 z-[55] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md outline-none transition-opacity hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-25 md:left-3"
                    onClick={() => goLightboxPrev()}
                  >
                    <ChevronLeft className="h-7 w-7" strokeWidth={2} />
                  </button>
                )}
                <div
                  className="max-w-full overflow-visible"
                  style={{
                    transform: `translateX(${lightboxImgTxPx}px) translateY(${lightboxPullDy}px) scale(${Math.max(0.3, 1 - lightboxPullDy / 520)})`,
                    transition: lightboxImgTxOn
                      ? 'transform 0.32s cubic-bezier(0.25, 0.8, 0.25, 1)'
                      : 'none',
                    transformOrigin: 'center center',
                  }}
                  onTransitionEnd={onLightboxTransformTransitionEnd}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Vollbild, dynamische API-URL */}
                  <img
                    src={imageSrc(openId)}
                    alt=""
                    className="max-h-[calc(100dvh-5.5rem)] max-w-full rounded-lg object-contain select-none shadow-2xl"
                    draggable={false}
                  />
                </div>
                {fotos.length > 1 && (
                  <button
                    type="button"
                    aria-label="Nächstes Foto"
                    disabled={lightboxIndex < 0 || lightboxIndex >= fotos.length - 1}
                    className="absolute right-1 top-1/2 z-[55] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md outline-none transition-opacity hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-25 md:right-3"
                    onClick={() => goLightboxNext()}
                  >
                    <ChevronRight className="h-7 w-7" strokeWidth={2} />
                  </button>
                )}
                {fotos.length > 1 && lightboxIndex >= 0 && (
                  <p className="pointer-events-none absolute bottom-1 left-1/2 z-[55] -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                    {lightboxIndex + 1} / {fotos.length}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
