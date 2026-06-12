'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Mitreisender } from '@/lib/db'
import { buildPackProfileGroups } from '@/lib/pack-profile-groups'
import { PackProfilePersonGroups } from '@/components/pack-profile-person-groups'

interface PackingSettingsSidebarProps {
  isOpen: boolean
  onClose: () => void
  /** Alle Mitreisenden am Urlaub (für Gruppierung) */
  vacationMitreisende: Mitreisender[]
  ownGruppeId: string | null
  selectedProfile: string | null
  onProfileChange: (profileId: string | null) => void
  hidePackedItems: boolean
  onHidePackedChange: (hide: boolean) => void
  listDisplayMode: 'alles' | 'packliste'
  onListDisplayModeChange: (mode: 'alles' | 'packliste') => void
  /** False für Kinder: „Zentral/Alle“-Option ausblenden */
  showAlleOption?: boolean
  /** Untertitel für Zentral/Alle (z. B. nur eigene Gruppe) */
  alleOptionHint?: string
  profilesLoading?: boolean
}

export function PackingSettingsSidebar({
  isOpen,
  onClose,
  vacationMitreisende,
  ownGruppeId,
  selectedProfile,
  onProfileChange,
  hidePackedItems,
  onHidePackedChange,
  listDisplayMode,
  onListDisplayModeChange,
  showAlleOption = true,
  alleOptionHint = 'Übersicht',
  profilesLoading = false,
}: PackingSettingsSidebarProps) {
  const { ownGroup, otherGroups } = useMemo(
    () => buildPackProfileGroups(vacationMitreisende, ownGruppeId),
    [vacationMitreisende, ownGruppeId]
  )

  const ownGroupName =
    ownGroup.find((m) => m.gruppe_id === ownGruppeId)?.gruppe_name ??
    ownGroup[0]?.gruppe_name ??
    'Meine Gruppe'

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed right-0 top-0 h-full w-80 bg-card shadow-xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
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

        <ScrollArea type="scroll" className="flex-1 min-h-0 bg-card pack-settings-sidebar-scroll">
          <div className="p-6 space-y-4 overscroll-contain">
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

          {showAlleOption && (
            <button
              type="button"
              onClick={() => onProfileChange(null)}
              className={cn(
                'w-full p-4 rounded-xl border-2 transition-all',
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
                  <div className="text-xs text-muted-foreground tracking-wide">{alleOptionHint}</div>
                </div>
              </div>
            </button>
          )}

          {profilesLoading && vacationMitreisende.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Profile werden geladen…
            </p>
          )}

          {vacationMitreisende.length > 0 && (
            <PackProfilePersonGroups
              ownGroup={ownGroup}
              otherGroups={otherGroups}
              selectedProfile={selectedProfile}
              onProfileSelect={onProfileChange}
              showOwnGroupLabel={otherGroups.length > 0}
              ownGroupLabel={ownGroupName}
            />
          )}

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
        </ScrollArea>
      </div>

      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
    </>
  )
}
