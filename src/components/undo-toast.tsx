'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const SWIPE_DISMISS_THRESHOLD = 72
const SWIPE_DRAG_LOCK_PX = 8

export interface UndoToastProps {
  isVisible: boolean
  /** Packliste: Kurzname des Gegenstands; wird zu „… als gepackt markiert“. */
  itemName?: string
  /** Wenn gesetzt, wird dieser Text statt der Packlisten-Formulierung angezeigt (z. B. Checkliste). */
  message?: string
  /** Ohne Callback wird nur die Meldung angezeigt (z. B. nach Speichern). */
  onUndo?: () => void
  onDismiss: () => void
  duration?: number
}

export function UndoToast({
  isVisible,
  itemName,
  message,
  onUndo,
  onDismiss,
  duration = 5000
}: UndoToastProps) {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef<number | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const didSwipeRef = useRef(false)

  useEffect(() => {
    if (!isVisible) return
    
    const timer = setTimeout(() => {
      onDismiss()
    }, duration)
    
    return () => clearTimeout(timer)
  }, [isVisible, duration, onDismiss])

  useEffect(() => {
    if (!isVisible) {
      setDragX(0)
      setIsDragging(false)
      startXRef.current = null
      pointerIdRef.current = null
      didSwipeRef.current = false
    }
  }, [isVisible])

  const dismissWithSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const exitX = direction === 'left' ? -window.innerWidth : window.innerWidth
      setDragX(exitX)
      window.setTimeout(onDismiss, 180)
    },
    [onDismiss]
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-undo-action]')) return

    event.stopPropagation()
    startXRef.current = event.clientX
    pointerIdRef.current = event.pointerId
    didSwipeRef.current = false
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current == null || pointerIdRef.current !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - startXRef.current
    if (Math.abs(deltaX) >= SWIPE_DRAG_LOCK_PX) {
      didSwipeRef.current = true
    }
    setDragX(deltaX)
    event.stopPropagation()
  }

  const finishSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startXRef.current == null || pointerIdRef.current !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - startXRef.current
    startXRef.current = null
    pointerIdRef.current = null
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (Math.abs(deltaX) >= SWIPE_DISMISS_THRESHOLD) {
      dismissWithSwipe(deltaX < 0 ? 'left' : 'right')
      event.stopPropagation()
      return
    }

    setDragX(0)
    event.stopPropagation()
  }

  const stopTouchPropagation = (event: React.TouchEvent) => {
    event.stopPropagation()
  }

  if (!isVisible) return null

  const line =
    message != null && message !== ''
      ? message
      : itemName != null && itemName !== ''
        ? `${itemName} als gepackt markiert`
        : ''

  const showUndo = typeof onUndo === 'function'

  return (
    <div
      data-undo-toast
      className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 md:left-auto md:right-6 md:max-w-md"
      onTouchStart={stopTouchPropagation}
      onTouchMove={stopTouchPropagation}
      onTouchEnd={stopTouchPropagation}
      onTouchCancel={stopTouchPropagation}
    >
      <div
        className={cn(
          'bg-primary text-primary-foreground rounded-lg shadow-xl p-4 flex items-center border border-primary-foreground/10 touch-pan-y cursor-grab active:cursor-grabbing',
          showUndo ? 'justify-between' : 'justify-start'
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          opacity: Math.max(0.35, 1 - Math.abs(dragX) / 280),
          transition: isDragging ? 'none' : 'transform 0.18s ease, opacity 0.18s ease',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSwipe}
        onPointerCancel={finishSwipe}
      >
        <div className={cn('flex-1', showUndo && 'pr-4')}>
          <p className="text-sm font-medium">
            {line}
          </p>
        </div>
        {showUndo && (
          <Button
            variant="ghost"
            size="sm"
            data-undo-action
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onUndo!()
              onDismiss()
            }}
            className={cn(
              "bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide",
              "px-4 py-2 rounded-md transition-colors duration-200",
              "flex items-center gap-2 shrink-0"
            )}
          >
            <Undo2 className="h-4 w-4" />
            Rückgängig
          </Button>
        )}
      </div>
    </div>
  )
}

type BottomToastState = {
  message: string
  onUndo?: () => void
} | null

/** Einheitlicher Bottom-Toast (mit optionalem Rückgängig) für Erfolgsmeldungen. */
export function useBottomToast(): {
  showBottomToast: (message: string, onUndo?: () => void) => void
  dismissBottomToast: () => void
  bottomToast: ReactNode
} {
  const [state, setState] = useState<BottomToastState>(null)

  const showBottomToast = useCallback((message: string, onUndo?: () => void) => {
    setState({ message, onUndo })
  }, [])

  const dismissBottomToast = useCallback(() => {
    setState(null)
  }, [])

  const bottomToast =
    state != null ? (
      <UndoToast
        isVisible
        message={state.message}
        onUndo={state.onUndo}
        onDismiss={dismissBottomToast}
      />
    ) : null

  return { showBottomToast, dismissBottomToast, bottomToast }
}
