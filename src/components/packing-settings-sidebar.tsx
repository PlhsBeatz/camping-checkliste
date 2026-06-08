'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn, getInitials } from '@/lib/utils'
import { getMitreisenderAvatarStyle } from '@/lib/user-colors'
import type { Mitreisender } from '@/lib/db'
import { sortMitreisendeNachRolleUndName } from '@/lib/mitreisenden-sort'

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
  /** False für Kinder: „Zentral/Alle“-Option ausblenden */
  showAlleOption?: boolean
  /** Mitreisende werden noch geladen (Cache/Netzwerk) */
  profilesLoading?: boolean
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
  onListDisplayModeChange,
  showAlleOption = true,
  profilesLoading = false,
}: PackingSettingsSidebarProps) {
  const travelerNames = mitreisende.map((m) => m.name)
  const sortedMitreisende = useMemo(
    () => sortMitreisendeNachRolleUndName(mitreisende),
    [mitreisende]
  )

  const getTravelerInitials = (name: string) => getInitials(name, travelerNames)

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
          "fixed right-0 top-0 h-full w-80 bg-card shadow-xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header - Dark Green */}
        <div className="p-6 bg-[rgb(45,79,30)] text-white flex-shrink-0">
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0 bg-card">
          {/* Anzeige-Modus: Alles / Packliste */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Anzeige
            </div>
            <div className="segment-toggle-track">
              <button
                type="button"
                onClick={() => onListDisplayModeChange('alles')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-colors',
                  listDisplayMode === 'alles'
                    ? 'bg-card text-brand-heading shadow-sm rounded-md'
                    : 'text-muted-foreground hover:text-foreground'
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
                    ? 'bg-card text-brand-heading shadow-sm rounded-md'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Packliste
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 min-h-[2.5rem] leading-tight">
              {listDisplayMode === 'alles'
                ? 'Alle Einträge inkl. „Immer gepackt"'
                : 'Ohne „Immer gepackt" (Wohnwagen-Dauerausstattung)'}
            </p>
          </div>

          {/* Zentral / Alle Option – nur für Admin */}
          {showAlleOption && (
          <button
            onClick={() => onProfileChange(null)}
            className={cn(
              "w-full p-4 rounded-xl border-2 transition-all",
              selectedProfile === null
                ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5 dark:bg-[rgb(45,79,30)]/15'
                : 'border-border hover:border-muted-foreground/40'
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
                <div className="font-semibold text-foreground">Zentral / Alle</div>
                <div className="text-xs text-muted-foreground tracking-wide">Übersicht</div>
              </div>
            </div>
          </button>
          )}

          {/* Mitreisende Grid */}
          {profilesLoading && sortedMitreisende.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Profile werden geladen…
            </p>
          )}
          {sortedMitreisende.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {sortedMitreisende.map((person, index) => (
                <button
                  key={person.id}
                  onClick={() => onProfileChange(person.id)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                    selectedProfile === person.id
                      ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5 dark:bg-[rgb(45,79,30)]/15'
                      : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={getMitreisenderAvatarStyle(person, index)}
                  >
                    {getTravelerInitials(person.name)}
                  </div>
                  <span className="text-sm font-medium text-foreground text-center">
                    {person.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Gepacktes ausblenden */}
          <div className="pt-4">
            <div className="flex items-center justify-between">
              <Label 
                htmlFor="hide-packed" 
                className="text-sm font-medium text-foreground uppercase tracking-wide cursor-pointer"
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
