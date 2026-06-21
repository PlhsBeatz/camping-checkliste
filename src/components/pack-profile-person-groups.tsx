'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { getMitreisenderAvatarStyle } from '@/lib/user-colors'
import type { Mitreisender } from '@/lib/db'
import type { PackProfileGroup } from '@/lib/pack-profile-groups'

function ProfileGridButton({
  person,
  index,
  travelerNames,
  selectedProfile,
  onSelect,
  subdued = false,
}: {
  person: Mitreisender
  index: number
  travelerNames: string[]
  selectedProfile: string | null
  onSelect: (id: string) => void
  subdued?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person.id)}
      className={cn(
        'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
        subdued && 'opacity-90',
        selectedProfile === person.id
          ? 'border-[rgb(45,79,30)] bg-[rgb(45,79,30)]/5 dark:bg-[rgb(45,79,30)]/15'
          : 'border-border hover:border-muted-foreground/40'
      )}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
        style={getMitreisenderAvatarStyle(person, index)}
      >
        {getInitials(person.name, travelerNames)}
      </div>
      <span className="text-sm font-medium text-foreground text-center">{person.name}</span>
    </button>
  )
}

interface PackProfilePersonGroupsProps {
  ownGroup: Mitreisender[]
  otherGroups: PackProfileGroup[]
  selectedProfile: string | null
  onProfileSelect: (profileId: string) => void
  /** Eigene Gruppe als Abschnitt betiteln (Sidebar) */
  showOwnGroupLabel?: boolean
  ownGroupLabel?: string
}

export function PackProfilePersonGroups({
  ownGroup,
  otherGroups,
  selectedProfile,
  onProfileSelect,
  showOwnGroupLabel = false,
  ownGroupLabel = 'Mein Haushalt',
}: PackProfilePersonGroupsProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const allNames = [...ownGroup, ...otherGroups.flatMap((g) => g.members)].map((m) => m.name)

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      {ownGroup.length > 0 && (
        <div className="space-y-2">
          {showOwnGroupLabel && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
              {ownGroupLabel}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {ownGroup.map((person, index) => (
              <ProfileGridButton
                key={person.id}
                person={person}
                index={index}
                travelerNames={allNames}
                selectedProfile={selectedProfile}
                onSelect={onProfileSelect}
              />
            ))}
          </div>
        </div>
      )}

      {otherGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
            Weitere Haushalte
          </p>
          {otherGroups.map((group) => {
            const open = expandedGroups[group.id] ?? false
            return (
              <div
                key={group.id}
                className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {group.name}
                    <span className="ml-1.5 font-normal">({group.members.length})</span>
                  </span>
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {open && (
                  <div className="p-3 grid grid-cols-2 gap-3 border-t border-border/40 bg-card/50">
                    {group.members.map((person, index) => (
                      <ProfileGridButton
                        key={person.id}
                        person={person}
                        index={index}
                        travelerNames={allNames}
                        selectedProfile={selectedProfile}
                        onSelect={onProfileSelect}
                        subdued
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Kompakte Zeilenliste (Team-Übersicht) mit Gruppierung */
export function PackProfileGroupOverviewList({
  ownGroup,
  otherGroups,
  selectedProfile,
  onProfileSelect,
  renderRow,
}: {
  ownGroup: Mitreisender[]
  otherGroups: PackProfileGroup[]
  selectedProfile: string | null
  onProfileSelect?: (profileId: string) => void
  renderRow: (
    person: Mitreisender,
    index: number,
    opts: { isCurrent: boolean; subdued: boolean }
  ) => ReactNode
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-3">
      {ownGroup.length > 0 && (
        <ul className="space-y-2">
          {ownGroup.map((person, index) =>
            renderRow(person, index, {
              isCurrent: selectedProfile === person.id,
              subdued: false,
            })
          )}
        </ul>
      )}
      {otherGroups.map((group) => {
        const open = expandedGroups[group.id] ?? false
        return (
          <div key={group.id} className="rounded-lg border border-border/50 bg-muted/15">
            <button
              type="button"
              onClick={() =>
                setExpandedGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
              }
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hover:bg-muted/30"
            >
              <span>
                {group.name} ({group.members.length})
              </span>
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {open && (
              <ul className="space-y-2 px-2 pb-2 border-t border-border/40">
                {group.members.map((person, index) =>
                  renderRow(person, index, {
                    isCurrent: selectedProfile === person.id,
                    subdued: true,
                  })
                )}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
