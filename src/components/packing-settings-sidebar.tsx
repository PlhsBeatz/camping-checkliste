'use client'

import { X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Mitreisender {
  id: string
  name: string
  is_default_member: boolean
}

interface PackingSettingsSidebarProps {
  isOpen: boolean
  onClose: () => void
  mitreisende: Mitreisender[]
  selectedProfile: string | null
  onProfileChange: (profileId: string | null) => void
  hidePackedItems: boolean
  onHidePackedChange: (hide: boolean) => void
}

export function PackingSettingsSidebar({
  isOpen,
  onClose,
  mitreisende,
  selectedProfile,
  onProfileChange,
  hidePackedItems,
  onHidePackedChange
}: PackingSettingsSidebarProps) {
  // Generate avatar initials and colors
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getAvatarColor = (index: number) => {
    const colors = [
      'bg-blue-200 text-blue-800',
      'bg-pink-200 text-pink-800',
      'bg-purple-200 text-purple-800',
      'bg-yellow-200 text-yellow-800',
      'bg-green-200 text-green-800',
      'bg-red-200 text-red-800',
    ]
    return colors[index % colors.length]
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar - Slide in from RIGHT */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-80 bg-sidebar text-sidebar-foreground shadow-xl z-50 transform transition-transform duration-300 ease-in-out",
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <h2 className="text-lg font-bold">WER PACKT?</h2>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-sidebar-accent -mr-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Explanation Text */}
          <p className="text-sm text-sidebar-foreground/70 leading-relaxed">
            Gewähltes Profil steuert das Abhaken der persönlichen Gegenstände.
          </p>
          
          {/* Zentral / Alle Option */}
          <button
            onClick={() => onProfileChange(null)}
            className={cn(
              "w-full p-4 rounded-lg border-2 transition-all",
              selectedProfile === null
                ? 'border-sidebar-primary bg-white/10'
                : 'border-sidebar-border bg-white/5 hover:border-sidebar-foreground/30'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-sidebar-primary flex items-center justify-center">
                <Users className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sidebar-foreground">Zentral / Alle</div>
                <div className="text-xs text-sidebar-foreground/60 uppercase tracking-wide">Gemeinsames Gut</div>
              </div>
            </div>
          </button>

          {/* Individual Travelers */}
          {mitreisende.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {mitreisende.map((m, index) => (
                <button
                  key={m.id}
                  onClick={() => onProfileChange(m.id)}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    selectedProfile === m.id
                      ? 'border-sidebar-primary bg-white/10'
                      : 'border-sidebar-border bg-white/5 hover:border-sidebar-foreground/30'
                  )}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${getAvatarColor(index)}`}>
                      {getInitials(m.name)}
                    </div>
                    <div className="text-sm font-medium text-sidebar-foreground">{m.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Separator */}
          <div className="border-t border-sidebar-border" />

          {/* Hide Packed Items Checkbox */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-sidebar-border bg-white/5">
            <Label 
              htmlFor="hide-packed" 
              className="text-sm font-medium cursor-pointer flex-1 text-sidebar-foreground"
            >
              GEPACKTES AUSBLENDEN
            </Label>
            <Checkbox
              id="hide-packed"
              checked={hidePackedItems}
              onCheckedChange={(checked) => onHidePackedChange(checked as boolean)}
              className="border-sidebar-foreground/30 data-[state=checked]:bg-sidebar-primary data-[state=checked]:border-sidebar-primary"
            />
          </div>
        </div>
      </div>
    </>
  )
}
