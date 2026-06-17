'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Edit2, MoreVertical, Trash2, Users, X } from 'lucide-react'

interface BulkSelectionBarProps {
  count: number
  onCancel: () => void
  onAssign?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function BulkSelectionBar({
  count,
  onCancel,
  onAssign,
  onEdit,
  onDelete,
}: BulkSelectionBarProps) {
  const hasSelection = count > 0

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-subtle bg-card/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-1.5 px-2 py-2.5 sm:px-4 max-w-3xl mx-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="shrink-0"
          aria-label="Auswahl beenden"
        >
          <X className="h-5 w-5" />
        </Button>
        <span className="flex-1 text-sm font-medium truncate min-w-0">
          {hasSelection ? (
            <>
              {count} {count === 1 ? 'Eintrag' : 'Einträge'}
            </>
          ) : (
            <span className="text-muted-foreground">Einträge auswählen</span>
          )}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={!hasSelection || !onEdit}
          className={cn('shrink-0 gap-1 px-2 sm:px-3', !onEdit && 'hidden')}
        >
          <Edit2 className="h-4 w-4" />
          <span className="hidden sm:inline">Bearbeiten</span>
        </Button>
        {onAssign && (
          <Button
            type="button"
            size="sm"
            onClick={onAssign}
            disabled={!hasSelection}
            className="shrink-0 gap-1 px-2 sm:px-3 bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white"
          >
            <Users className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Zuordnen</span>
          </Button>
        )}
        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={!hasSelection}
                aria-label="Weitere Aktionen"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {count} {count === 1 ? 'Eintrag' : 'Einträge'} löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
