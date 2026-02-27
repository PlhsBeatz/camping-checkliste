'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Users, ChevronDown } from 'lucide-react'
import { Mitreisender } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { getCachedMitreisende } from '@/lib/offline-sync'
import { cacheMitreisende } from '@/lib/offline-db'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MitreisendeManagerProps {
  vacationId: string | null
  onMitreisendeChange?: (mitreisende: Mitreisender[]) => void
}

export function MitreisendeManager({ vacationId, onMitreisendeChange }: MitreisendeManagerProps) {
  const [allMitreisende, setAllMitreisende] = useState<Mitreisender[]>([])
  const [vacationMitreisende, setVacationMitreisende] = useState<string[]>([])
  const [showAdditionalPicker, setShowAdditionalPicker] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Lade alle Mitreisenden
  useEffect(() => {
    const fetchAllMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende')
        const data = (await res.json()) as ApiResponse<Mitreisender[]>
        if (data.success && data.data) {
          setAllMitreisende(data.data)
          await cacheMitreisende(data.data)

          // Wenn kein vacationId (= Erstell-Modus), wähle Standard-Mitreisende vor
          if (!vacationId && !initialLoadDone && data.data) {
            const defaultIds = data.data
              .filter((m) => m.is_default_member)
              .map((m) => m.id)
            setVacationMitreisende(defaultIds)
            if (onMitreisendeChange) {
              const defaultMitreisende = data.data.filter((m) => m.is_default_member)
              onMitreisendeChange(defaultMitreisende)
            }
            setInitialLoadDone(true)
          }
        }
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedMitreisende()
          if (cached.length > 0) {
            setAllMitreisende(cached)
            if (!vacationId && !initialLoadDone) {
              const defaultIds = cached.filter((m) => m.is_default_member).map((m) => m.id)
              setVacationMitreisende(defaultIds)
              if (onMitreisendeChange) {
                onMitreisendeChange(cached.filter((m) => m.is_default_member))
              }
              setInitialLoadDone(true)
            }
          }
        }
      }
    }
    fetchAllMitreisende()
  }, [vacationId, initialLoadDone, onMitreisendeChange])

  // Lade Mitreisende für den aktuellen Urlaub (nur im Edit-Modus)
  useEffect(() => {
    if (!vacationId) return
    
    const fetchVacationMitreisende = async () => {
      try {
        const res = await fetch(`/api/mitreisende?vacationId=${vacationId}`)
        const data = (await res.json()) as ApiResponse<Mitreisender[]>
        if (data.success && data.data) {
          const ids = data.data.map((m) => m.id)
          setVacationMitreisende(ids)
          if (onMitreisendeChange) {
            onMitreisendeChange(data.data)
          }
        }
      } catch (error) {
        console.error('Failed to fetch vacation mitreisende:', error)
      }
    }
    fetchVacationMitreisende()
  }, [vacationId, onMitreisendeChange])

  const handleToggleMitreisender = async (mitreisenderId: string) => {
    const newSelection = vacationMitreisende.includes(mitreisenderId)
      ? vacationMitreisende.filter(id => id !== mitreisenderId)
      : [...vacationMitreisende, mitreisenderId]

    setVacationMitreisende(newSelection)

    // Wenn vacationId vorhanden (Edit-Modus), speichere sofort
    if (vacationId) {
      try {
        const res = await fetch('/api/mitreisende', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacationId,
            mitreisendeIds: newSelection
          })
        })
        const data = (await res.json()) as ApiResponse<boolean>
        if (data.success && onMitreisendeChange) {
          const selectedMitreisende = allMitreisende.filter(m => newSelection.includes(m.id))
          onMitreisendeChange(selectedMitreisende)
        }
      } catch (error) {
        console.error('Failed to update vacation mitreisende:', error)
      }
    } else {
      // Im Erstell-Modus nur lokal speichern
      if (onMitreisendeChange) {
        const selectedMitreisende = allMitreisende.filter(m => newSelection.includes(m.id))
        onMitreisendeChange(selectedMitreisende)
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Mitreisende
        </Label>
        <DropdownMenu open={showAdditionalPicker} onOpenChange={setShowAdditionalPicker}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                allMitreisende.filter((m) => !m.is_default_member).length === 0
              }
            >
              Weitere auswählen
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {allMitreisende.filter((m) => !m.is_default_member).length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                Keine weiteren Mitreisenden vorhanden.
              </div>
            ) : (
              allMitreisende
                .filter((m) => !m.is_default_member)
                .map((m) => {
                  const checked = vacationMitreisende.includes(m.id)
                  return (
                    <DropdownMenuItem
                      key={m.id}
                      onSelect={(e) => {
                        e.preventDefault()
                        void handleToggleMitreisender(m.id)
                      }}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => void handleToggleMitreisender(m.id)}
                        className="h-3 w-3"
                      />
                      <span className="text-sm">{m.name}</span>
                    </DropdownMenuItem>
                  )
                })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
        {allMitreisende.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Noch keine Mitreisenden angelegt
          </p>
        ) : (
          [...allMitreisende]
            .filter((m) => m.is_default_member)
            .map((mitreisender) => (
              <div
                key={mitreisender.id}
                className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`mitreisender-${mitreisender.id}`}
                    checked={vacationMitreisende.includes(mitreisender.id)}
                    onCheckedChange={() => handleToggleMitreisender(mitreisender.id)}
                  />
                  <label
                    htmlFor={`mitreisender-${mitreisender.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {mitreisender.name}
                  </label>
                </div>
              </div>
            ))
        )}
      </div>

      {!vacationId && allMitreisende.length > 0 && (
        <p className="text-xs text-muted-foreground">
          💡 Standard-Mitreisende sind automatisch ausgewählt
        </p>
      )}
    </div>
  )
}
