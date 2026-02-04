'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Users } from 'lucide-react'
import { Mitreisender } from '@/lib/db'

interface MitreisendeManagerProps {
  vacationId: string | null
  onMitreisendeChange?: (mitreisende: Mitreisender[]) => void
}

export function MitreisendeManager({ vacationId, onMitreisendeChange }: MitreisendeManagerProps) {
  const [allMitreisende, setAllMitreisende] = useState<Mitreisender[]>([])
  const [vacationMitreisende, setVacationMitreisende] = useState<string[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newMitreisenderName, setNewMitreisenderName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Lade alle Mitreisenden
  useEffect(() => {
    const fetchAllMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende')
        const data = await res.json()
        if (data.success) {
          setAllMitreisende(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
      }
    }
    fetchAllMitreisende()
  }, [])

  // Lade Mitreisende für den aktuellen Urlaub
  useEffect(() => {
    if (!vacationId) return
    
    const fetchVacationMitreisende = async () => {
      try {
        const res = await fetch(`/api/mitreisende?vacationId=${vacationId}`)
        const data = await res.json()
        if (data.success) {
          const ids = data.data.map((m: Mitreisender) => m.id)
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
    if (!vacationId) return

    const newSelection = vacationMitreisende.includes(mitreisenderId)
      ? vacationMitreisende.filter(id => id !== mitreisenderId)
      : [...vacationMitreisende, mitreisenderId]

    setVacationMitreisende(newSelection)

    // Speichere die Auswahl
    try {
      const res = await fetch('/api/mitreisende', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacationId,
          mitreisendeIds: newSelection
        })
      })
      const data = await res.json()
      if (data.success && onMitreisendeChange) {
        const selectedMitreisende = allMitreisende.filter(m => newSelection.includes(m.id))
        onMitreisendeChange(selectedMitreisende)
      }
    } catch (error) {
      console.error('Failed to update vacation mitreisende:', error)
    }
  }

  const handleCreateMitreisender = async () => {
    if (!newMitreisenderName.trim()) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/mitreisende', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMitreisenderName,
          is_default_member: false
        })
      })
      const data = await res.json()
      if (data.success) {
        const newMitreisender: Mitreisender = {
          id: data.data.id,
          name: newMitreisenderName,
          is_default_member: false,
          created_at: new Date().toISOString()
        }
        setAllMitreisende([...allMitreisende, newMitreisender])
        setNewMitreisenderName('')
        setShowAddDialog(false)
        
        // Automatisch zur Urlaubsauswahl hinzufügen
        if (vacationId) {
          await handleToggleMitreisender(data.data.id)
        }
      } else {
        alert('Fehler beim Erstellen des Mitreisenden: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create mitreisender:', error)
      alert('Fehler beim Erstellen des Mitreisenden')
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Mitreisende
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddDialog(!showAddDialog)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Neu
        </Button>
      </div>

      {showAddDialog && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
          <Label htmlFor="new-mitreisender">Neuer Mitreisender</Label>
          <div className="flex gap-2">
            <Input
              id="new-mitreisender"
              value={newMitreisenderName}
              onChange={(e) => setNewMitreisenderName(e.target.value)}
              placeholder="Name eingeben..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateMitreisender()
                }
              }}
            />
            <Button
              type="button"
              onClick={handleCreateMitreisender}
              disabled={isLoading || !newMitreisenderName.trim()}
            >
              Hinzufügen
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
        {allMitreisende.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Noch keine Mitreisenden angelegt
          </p>
        ) : (
          allMitreisende.map((mitreisender) => (
            <div
              key={mitreisender.id}
              className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`mitreisender-${mitreisender.id}`}
                  checked={vacationMitreisende.includes(mitreisender.id)}
                  onCheckedChange={() => handleToggleMitreisender(mitreisender.id)}
                  disabled={!vacationId}
                />
                <label
                  htmlFor={`mitreisender-${mitreisender.id}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {mitreisender.name}
                  {mitreisender.is_default_member && (
                    <span className="ml-2 text-xs text-yellow-600 font-normal">⭐ Standard</span>
                  )}
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      {!vacationId && allMitreisende.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Wählen Sie zuerst einen Urlaub aus, um Mitreisende zuzuordnen
        </p>
      )}
    </div>
  )
}
