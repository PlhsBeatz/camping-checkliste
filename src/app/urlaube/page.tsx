'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { MitreisendeManager } from '@/components/mitreisende-manager'
import { Plus, Menu, Edit2, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Vacation, Mitreisender } from '@/lib/db'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function UrlaubePage() {
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewVacationDialog, setShowNewVacationDialog] = useState(false)
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null)
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  
  const [newVacationForm, setNewVacationForm] = useState({
    titel: '',
    startdatum: '',
    abfahrtdatum: '',
    enddatum: '',
    reiseziel_name: '',
    reiseziel_adresse: '',
    land_region: ''
  })

  // Fetch Vacations
  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = await res.json()
        if (data.success) {
          setVacations(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch vacations:', error)
      }
    }
    fetchVacations()
  }, [])

  const handleCreateVacation = async () => {
    if (!newVacationForm.titel || !newVacationForm.startdatum || !newVacationForm.enddatum || !newVacationForm.reiseziel_name) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus')
      return
    }

    setIsLoading(true)
    try {
      const method = editingVacationId ? 'PUT' : 'POST'
      const body = editingVacationId
        ? { ...newVacationForm, id: editingVacationId }
        : newVacationForm

      const res = await fetch('/api/vacations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        if (editingVacationId) {
          setVacations(vacations.map(v => v.id === editingVacationId ? data.data : v))
        } else {
          // New vacation created - assign selected travelers
          const newVacationId = data.data.id
          
          if (vacationMitreisende.length > 0) {
            // Assign selected travelers to the new vacation
            const selectedIds = vacationMitreisende.map(m => m.id)
            await fetch('/api/mitreisende', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vacationId: newVacationId,
                mitreisendeIds: selectedIds
              })
            })
          }
          
          setVacations([...vacations, data.data])
        }
        setShowNewVacationDialog(false)
        setEditingVacationId(null)
        setNewVacationForm({
          titel: '',
          startdatum: '',
          abfahrtdatum: '',
          enddatum: '',
          reiseziel_name: '',
          reiseziel_adresse: '',
          land_region: ''
        })
        setVacationMitreisende([])
      } else {
        alert('Fehler beim Speichern des Urlaubs: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to save vacation:', error)
      alert('Fehler beim Speichern des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditVacation = (vacation: Vacation) => {
    setEditingVacationId(vacation.id)
    setNewVacationForm({
      titel: vacation.titel,
      startdatum: vacation.startdatum,
      abfahrtdatum: vacation.abfahrtdatum || '',
      enddatum: vacation.enddatum,
      reiseziel_name: vacation.reiseziel_name,
      reiseziel_adresse: vacation.reiseziel_adresse || '',
      land_region: vacation.land_region || ''
    })
    setShowNewVacationDialog(true)
  }

  const handleCloseVacationDialog = () => {
    setShowNewVacationDialog(false)
    setEditingVacationId(null)
    setNewVacationForm({
      titel: '',
      startdatum: '',
      abfahrtdatum: '',
      enddatum: '',
      reiseziel_name: '',
      reiseziel_adresse: '',
      land_region: ''
    })
    setVacationMitreisende([])
  }

  const handleDeleteVacation = async (vacationId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Urlaub löschen möchten?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/vacations?id=${vacationId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setVacations(vacations.filter(v => v.id !== vacationId))
      } else {
        alert('Fehler beim Löschen des Urlaubs: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete vacation:', error)
      alert('Fehler beim Löschen des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectVacation = (vacationId: string) => {
    // Navigate to home page with selected vacation
    router.push(`/?vacation=${vacationId}`)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        "lg:ml-[280px]"
      )}>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Meine Urlaube
                </h1>
                <p className="text-muted-foreground mt-1">
                  Planen und verwalten Sie Ihre Reisen
                </p>
              </div>
            </div>

            {/* Add Vacation Button */}
            <Dialog open={showNewVacationDialog} onOpenChange={(open) => {
              if (!open) {
                handleCloseVacationDialog()
              } else {
                setShowNewVacationDialog(true)
              }
            }}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Urlaub
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingVacationId ? 'Urlaub bearbeiten' : 'Neuen Urlaub erstellen'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingVacationId ? 'Bearbeiten Sie die Details des Urlaubs' : 'Geben Sie die Details für Ihren neuen Urlaub ein'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="titel">Titel *</Label>
                    <Input
                      id="titel"
                      placeholder="z.B. Sommerurlaub 2024"
                      value={newVacationForm.titel}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, titel: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reiseziel">Reiseziel *</Label>
                    <Input
                      id="reiseziel"
                      placeholder="z.B. Schwarzwald"
                      value={newVacationForm.reiseziel_name}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, reiseziel_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reiseziel_adresse">Adresse</Label>
                    <Input
                      id="reiseziel_adresse"
                      placeholder="z.B. Campingplatz am See, 79822 Titisee"
                      value={newVacationForm.reiseziel_adresse}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, reiseziel_adresse: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="land_region">Land / Region</Label>
                    <Input
                      id="land_region"
                      placeholder="z.B. Deutschland, Baden-Württemberg"
                      value={newVacationForm.land_region}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, land_region: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="abfahrtdatum">Abreisedatum</Label>
                      <Input
                        id="abfahrtdatum"
                        type="date"
                        value={newVacationForm.abfahrtdatum}
                        onChange={(e) => setNewVacationForm({ ...newVacationForm, abfahrtdatum: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Wann starten Sie von zuhause?
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="startdatum">Startdatum *</Label>
                      <Input
                        id="startdatum"
                        type="date"
                        value={newVacationForm.startdatum}
                        onChange={(e) => setNewVacationForm({ ...newVacationForm, startdatum: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="enddatum">Enddatum *</Label>
                      <Input
                        id="enddatum"
                        type="date"
                        value={newVacationForm.enddatum}
                        onChange={(e) => setNewVacationForm({ ...newVacationForm, enddatum: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  {/* Mitreisenden-Verwaltung */}
                  <MitreisendeManager 
                    vacationId={editingVacationId}
                    onMitreisendeChange={setVacationMitreisende}
                  />
                  
                  <Button onClick={handleCreateVacation} disabled={isLoading} className="w-full">
                    {isLoading ? 'Wird gespeichert...' : editingVacationId ? 'Urlaub aktualisieren' : 'Urlaub erstellen'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Vacations List */}
          <div className="grid gap-4">
            {vacations.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub!
                  </p>
                </CardContent>
              </Card>
            ) : (
              vacations.map((vacation) => (
                <Card
                  key={vacation.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleSelectVacation(vacation.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>{vacation.titel}</CardTitle>
                        <CardDescription>
                          <div className="space-y-1 mt-2">
                            {vacation.reiseziel_name && <p>📍 {vacation.reiseziel_name}</p>}
                            {vacation.reiseziel_adresse && <p className="text-xs">   {vacation.reiseziel_adresse}</p>}
                            {vacation.land_region && <p>🌍 {vacation.land_region}</p>}
                            {vacation.abfahrtdatum && <p>🚗 Abreise: {vacation.abfahrtdatum}</p>}
                            <p>📅 {vacation.startdatum} bis {vacation.enddatum}</p>
                          </div>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditVacation(vacation)
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteVacation(vacation.id)
                          }}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectVacation(vacation.id)
                      }}
                    >
                      Packliste öffnen
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
