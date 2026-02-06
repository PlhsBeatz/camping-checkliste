'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Undo2 } from 'lucide-react'

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
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss()
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onDismiss])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-gray-900 text-white rounded-lg shadow-lg p-4 flex items-center justify-between max-w-md mx-auto">
        <div className="flex-1">
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
          className="text-blue-400 hover:text-blue-300 hover:bg-gray-800 ml-4"
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Rückgängig
        </Button>
      </div>
    </div>
  )
}
