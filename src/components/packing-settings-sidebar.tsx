'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { USER_COLORS } from '@/lib/user-colors'

interface Mitreisender {
  id: string
  name: string
  is_default_member: boolean
  farbe?: string | null
}

interface PackingSettingsSidebarProps {
  isOpen: boolean
  onClose: () => void
  mitreisende: Mitreisender[]
  selectedProfile: string | null
  onProfileChange: (profileId: string | null) => void
  hidePackedItems: boolean
  onHidePackedChange: (hide: boolean) => void
  listDisplayMode: 'alles' | 'packliste'
  onListDisplayModeChange: (mode: 'alles' | 'packliste') => void
}

export function PackingSettingsSidebar({
  isOpen,
  onClose,
  mitreisende,
  selectedProfile,
  onProfileChange,
  hidePackedItems,
  onHidePackedChange,
  listDisplayMode,
  onListDisplayModeChange
}: PackingSettingsSidebarProps) {
  // Generate avatar initials and colors
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getAvatarStyle = (person: Mitreisender, index: number) => {
    if (person.farbe) {
      const preset = USER_COLORS.find((c) => c.bg === person.farbe)
      return { backgroundColor: person.farbe, color: preset?.fg ?? '#ffffff' }
    }
    const c = USER_COLORS[index % USER_COLORS.length]!
    return { backgroundColor: c.bg, color: c.fg }
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
          "fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out",
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header - Dark Green */}
        <div className="p-6 bg-[rgb(45,79,30)] text-white">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">WER PACKT?</h2>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 -mr-2"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">
            Gewähltes Profil steuert das Abhaken der persönlichen Gegenstände.
          </p>
        </div>

        {/* Content - White Background */}
        <div className="p-6 space-y-4">
          {/* Anzeige-Modus: Alles / Packliste */}
          <div>
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
              Anzeige
            </div>
            <div className="flex rounded-lg border-2 border-gray-200 p-0.5 bg-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => onListDisplayModeChange('alles')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-colors',
                  listDisplayMode === 'alles'
                    ? 'bg-white text-[rgb(45,79,30)] shadow-sm rounded-md'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Alles
              </button>
              <button
                type="button"
                onClick={() => onListDisplayModeChange('packliste')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-colors',
                  listDisplayMode === 'packliste'
                    ? 'bg-white text-[rgb(45,79,30)] shadow-sm rounded-md'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Packliste
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {listDisplayMode === 'alles'
                ? 'Alle Einträge inkl. „Immer gepackt"'
                : 'Ohne „Immer gepackt" (Wohnwagen-Dauerausstattung)'}
            </p>
          </div>

          {/* Zentral / Alle Option */}
          <button
            onClick={() => onProfileChange(null)}
            className={cn(
              "w-full p-4 rounded-xl border-2 transition-all",
              selectedProfile === null
                ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
                <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgb(45,79,30)', color: '#ffffff' }}
              >
                <span className="material-icons">groups</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Zentral / Alle</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">GEMEINSAMES GUT</div>
              </div>
            </div>
          </button>

          {/* Mitreisende Grid */}
          {mitreisende.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {mitreisende.map((person, index) => (
                <button
                  key={person.id}
                  onClick={() => onProfileChange(person.id)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                    selectedProfile === person.id
                      ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={getAvatarStyle(person, index)}
                  >
                    {getInitials(person.name)}
                  </div>
                  <span className="text-sm font-medium text-gray-900 text-center">
                    {person.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Gepacktes ausblenden */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Label 
                htmlFor="hide-packed" 
                className="text-sm font-medium text-gray-700 uppercase tracking-wide cursor-pointer"
              >
                GEPACKTES AUSBLENDEN
              </Label>
              <Checkbox
                id="hide-packed"
                checked={hidePackedItems}
                onCheckedChange={onHidePackedChange}
                className="data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Material Icons font if not already included */}
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
    </>
  )
}
