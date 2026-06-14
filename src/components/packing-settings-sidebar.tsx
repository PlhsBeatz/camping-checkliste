'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Mitreisender } from '@/lib/db'
import { buildPackProfileGroups } from '@/lib/pack-profile-groups'
import { PackProfilePersonGroups } from '@/components/pack-profile-person-groups'
import type { PauschalGruppenFilter } from '@/lib/pauschal-gruppen'

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
  /** False für Kinder: Übersicht-Option ausblenden */
  showAlleOption?: boolean
  /** Untertitel für Übersicht (z. B. nur eigene Gruppe) */
  alleOptionHint?: string
  profilesLoading?: boolean
  /** Mehrgruppen-Urlaub: Filter für pauschale Einträge */
  showPauschalGruppenFilter?: boolean
  pauschalGruppenFilter?: PauschalGruppenFilter
  onPauschalGruppenFilterChange?: (filter: PauschalGruppenFilter) => void
  unassignedPauschalCount?: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
      {children}
    </div>
  )
}

function SegmentToggle({
  options,
  multiline = false,
}: {
  options: Array<{
    id: string
    label: string
    active: boolean
    onClick: () => void
  }>
  /** Zweizeiliger Labeltext bei fester Button-Höhe (z. B. Pauschal-Filter) */
  multiline?: boolean
}) {
  return (
    <div className="segment-toggle-track">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={option.onClick}
          className={cn(
            'flex-1 min-w-0 px-1 transition-colors flex items-center justify-center',
            multiline ? 'h-10 py-0 text-[11px] leading-[1.15] font-medium' : 'py-2.5 text-sm font-medium',
            option.active
              ? 'bg-card text-brand-heading shadow-sm rounded-md'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span
            className={cn(
              'block w-full text-center',
              multiline ? 'line-clamp-2 break-words [overflow-wrap:anywhere]' : 'truncate'
            )}
          >
            {option.label}
          </span>
        </button>
      ))}
    </div>
  )
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
  showPauschalGruppenFilter = false,
  pauschalGruppenFilter = 'alle',
  onPauschalGruppenFilterChange,
  unassignedPauschalCount = 0,
}: PackingSettingsSidebarProps) {
  const { ownGroup, otherGroups } = useMemo(
    () => buildPackProfileGroups(vacationMitreisende, ownGruppeId),
    [vacationMitreisende, ownGruppeId]
  )

  const showUnassignedFilter = unassignedPauschalCount > 0

  const pauschalHelpText =
    pauschalGruppenFilter === 'alle'
      ? 'Alle pauschalen Einträge aller Haushalte'
      : pauschalGruppenFilter === 'eigene'
        ? 'Eigene und gemeinsame Einträge'
        : unassignedPauschalCount > 0
          ? `${unassignedPauschalCount} ohne Zuordnung – Badge tippen zum Zuweisen`
          : 'Keine offenen Zuordnungen'

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
          <div className="p-6 space-y-6 overscroll-contain">
            <div className="space-y-4">
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
                      <div className="font-semibold text-foreground">Übersicht</div>
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
                />
              )}
            </div>

            <div className="mt-6 pt-5 border-t-2 border-border/80 space-y-4 rounded-lg bg-muted/20 px-3 pb-3 -mx-1 dark:bg-muted/10">
              <SectionLabel>Ansicht</SectionLabel>

              {showPauschalGruppenFilter && onPauschalGruppenFilterChange && (
                <div>
                  <SectionLabel>Gemeinsame Einträge</SectionLabel>
                  <SegmentToggle
                    multiline
                    options={[
                      {
                        id: 'alle',
                        label: 'Alle Haushalte',
                        active: pauschalGruppenFilter === 'alle',
                        onClick: () => onPauschalGruppenFilterChange('alle'),
                      },
                      {
                        id: 'eigene',
                        label: 'Meine',
                        active: pauschalGruppenFilter === 'eigene',
                        onClick: () => onPauschalGruppenFilterChange('eigene'),
                      },
                      ...(showUnassignedFilter
                        ? [
                            {
                              id: 'offen',
                              label: `Nicht zugeordnet (${unassignedPauschalCount})`,
                              active: pauschalGruppenFilter === 'offen',
                              onClick: () => onPauschalGruppenFilterChange('offen'),
                            },
                          ]
                        : []),
                    ]}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5 min-h-[2.5rem] leading-tight">
                    {pauschalHelpText}
                  </p>
                </div>
              )}

              <div>
                <SectionLabel>Dauerausstattung anzeigen</SectionLabel>
                <SegmentToggle
                  options={[
                    {
                      id: 'show-dauer',
                      label: 'Anzeigen',
                      active: listDisplayMode === 'alles',
                      onClick: () => onListDisplayModeChange('alles'),
                    },
                    {
                      id: 'hide-dauer',
                      label: 'Ausblenden',
                      active: listDisplayMode === 'packliste',
                      onClick: () => onListDisplayModeChange('packliste'),
                    },
                  ]}
                />
                <p className="text-xs text-muted-foreground mt-1.5 min-h-[2.5rem] leading-tight">
                  {listDisplayMode === 'alles'
                    ? 'Alle Einträge inkl. „Immer gepackt"'
                    : 'Ohne „Immer gepackt" (Wohnwagen-Dauerausstattung)'}
                </p>
              </div>

              <div>
                <SectionLabel>Gepacktes</SectionLabel>
                <SegmentToggle
                  options={[
                    {
                      id: 'show-packed',
                      label: 'Anzeigen',
                      active: !hidePackedItems,
                      onClick: () => onHidePackedChange(false),
                    },
                    {
                      id: 'hide-packed',
                      label: 'Ausblenden',
                      active: hidePackedItems,
                      onClick: () => onHidePackedChange(true),
                    },
                  ]}
                />
                <p className="text-xs text-muted-foreground mt-1.5 min-h-[2.5rem] leading-tight">
                  {hidePackedItems
                    ? 'Bereits abgehakte Einträge werden ausgeblendet'
                    : 'Alle Einträge sichtbar, auch bereits abgehakte'}
                </p>
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
