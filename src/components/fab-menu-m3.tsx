'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Vertikales FAB-Menü nach Material Design 3 (Speed-Dial / FAB menu):
 * Primär-FAB 56×56, darüber kleine FABs 40×40 mit zugehörigem Textlabel,
 * Scrim beim Öffnen, Schließen per Scrim-Tap oder X-Icon.
 * @see https://m3.material.io/components/fab-menu/overview
 */
export type FabMenuM3Action = {
  id: string
  label: string
  icon: ReactNode
  onSelect: () => void
  disabled?: boolean
  disabledHint?: string
}

export type FabMenuM3Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: FabMenuM3Action[]
  /** Kurzbeschreibung des Menüs (z. B. „Neue Kategorie oder Label“) */
  ariaLabel: string
  className?: string
}

export function FabMenuM3({ open, onOpenChange, actions, ariaLabel, className }: FabMenuM3Props) {
  const menuId = `fab-menu-${useId().replace(/:/g, '_')}`
  const fabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
        fabRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  return (
    <>
      {open ? (
        <button
          type="button"
          tabIndex={-1}
          className="fixed inset-0 z-20 cursor-default bg-black/[0.32] motion-reduce:animate-none"
          aria-hidden
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div
        className={cn(
          'pointer-events-none fixed bottom-6 right-6 z-30 flex flex-col-reverse items-end gap-4',
          className
        )}
      >
        <button
          ref={fabRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          aria-label={open ? 'Menü schließen' : ariaLabel}
          onClick={() => onOpenChange(!open)}
          className={cn(
            'pointer-events-auto flex h-14 min-h-14 w-14 min-w-14 items-center justify-center rounded-full text-white',
            'shadow-[0_4px_8px_3px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.3)]',
            'bg-[rgb(45,79,30)] transition-[box-shadow,transform] duration-200 ease-out',
            'hover:shadow-[0_6px_10px_4px_rgba(0,0,0,0.15),0_2px_3px_rgba(0,0,0,0.3)]',
            'active:scale-[0.96] active:shadow-[0_2px_6px_2px_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.3)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(45,79,30)]'
          )}
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={2} aria-hidden />
          ) : (
            <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          )}
        </button>

        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            className="pointer-events-auto flex flex-col-reverse items-end gap-4"
          >
            {actions.map((action, index) => (
              <div
                key={action.id}
                role="none"
                className={cn(
                  'flex flex-row items-center justify-end gap-3',
                  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2',
                  'duration-200'
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <span
                  className={cn(
                    'max-w-[13rem] select-none text-right text-sm font-medium leading-5 tracking-[0.00625em] text-foreground',
                    action.disabled && 'text-muted-foreground'
                  )}
                >
                  {action.label}
                </span>
                <button
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  aria-disabled={action.disabled}
                  aria-describedby={
                    action.disabled && action.disabledHint ? `${menuId}-${action.id}-hint` : undefined
                  }
                  onClick={() => {
                    if (action.disabled) return
                    onOpenChange(false)
                    action.onSelect()
                  }}
                  className={cn(
                    'flex h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full',
                    'border border-black/[0.08] bg-white text-[rgb(45,79,30)]',
                    'shadow-[0_3px_4px_0_rgba(0,0,0,0.15),0_1px_3px_0_rgba(0,0,0,0.3)]',
                    'transition-[box-shadow,transform,background-color] duration-200 ease-out',
                    'hover:bg-neutral-50 hover:shadow-[0_4px_8px_3px_rgba(0,0,0,0.12)]',
                    'active:scale-[0.96]',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(45,79,30)]',
                    'disabled:pointer-events-none disabled:opacity-[0.38]'
                  )}
                  aria-label={action.label}
                >
                  <span className="flex h-6 w-6 items-center justify-center [&>svg]:h-[22px] [&>svg]:w-[22px]">
                    {action.icon}
                  </span>
                </button>
                {action.disabled && action.disabledHint ? (
                  <span id={`${menuId}-${action.id}-hint`} className="sr-only">
                    {action.disabledHint}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
