'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UndoToastProps {
  isVisible: boolean
  itemName: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

export function UndoToast({
  isVisible,
  itemName,
  onUndo,
  onDismiss,
  duration = 5000
}: UndoToastProps) {
  useEffect(() => {
    if (!isVisible) return
    
    const timer = setTimeout(() => {
      onDismiss()
    }, duration)
    
    return () => clearTimeout(timer)
  }, [isVisible, duration, onDismiss])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 md:left-auto md:right-6 md:max-w-md">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-xl p-4 flex items-center justify-between border border-primary-foreground/10">
        <div className="flex-1 pr-4">
          <p className="text-sm font-medium">
            {itemName} als gepackt markiert
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onUndo()
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
      </div>
    </div>
  )
}
