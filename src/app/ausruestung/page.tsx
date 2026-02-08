'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { EquipmentTable } from '@/components/equipment-table'
import { Plus, Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { EquipmentItem, Category, MainCategory, TransportVehicle, Tag } from '@/lib/db'
import { cn } from '@/lib/utils'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

export default function AusruestungPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load equipment items
  useEffect(() => {
    const fetchEquipmentItems = async () => {
      try {
        const res = await fetch('/api/equipment-items')
        const data = await res.json()
        if (data.success) {
          setEquipmentItems(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch equipment items:', error)
      }
    }
    fetchEquipmentItems()
  }, [])

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (data.success) {
          setCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    fetchCategories()
  }, [])

  // Fetch Main Categories
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const res = await fetch('/api/main-categories')
        const data = await res.json()
        if (data.success) {
          setMainCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch main categories:', error)
      }
    }
    fetchMainCategories()
  }, [])

  // Fetch Transport Vehicles
  useEffect(() => {
    const fetchTransportVehicles = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = await res.json()
        if (data.success) {
          setTransportVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
      }
    }
    fetchTransportVehicles()
  }, [])

  // Fetch Tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags')
        const data = await res.json()
        if (data.success) {
          setTags(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      }
    }
    fetchTags()
  }, [])

  const handleEditEquipment = (item: EquipmentItem) => {
    // TODO: Implement edit dialog
    console.log('Edit equipment:', item)
  }

  const handleDeleteEquipment = async (equipmentId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Gegenstand löschen möchten?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/equipment-items?id=${equipmentId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setEquipmentItems(equipmentItems.filter(item => item.id !== equipmentId))
      } else {
        alert('Fehler beim Löschen des Gegenstands: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete equipment:', error)
      alert('Fehler beim Löschen des Gegenstands')
    } finally {
      setIsLoading(false)
    }
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
                  Ausrüstung
                </h1>
                <p className="text-muted-foreground mt-1">
                  Verwalten Sie Ihre Camping-Ausrüstung
                </p>
              </div>
            </div>

            {/* Add Equipment Button */}
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Gegenstand
            </Button>
          </div>

          {/* Equipment Table */}
          <Card>
            <CardHeader>
              <CardTitle>Ausrüstungsgegenstände</CardTitle>
              <CardDescription>
                {equipmentItems.length} Gegenstände in Ihrer Ausrüstung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EquipmentTable
                equipmentItems={equipmentItems}
                categories={categories}
                mainCategories={mainCategories}
                transportVehicles={transportVehicles}
                tags={tags}
                onEdit={handleEditEquipment}
                onDelete={handleDeleteEquipment}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
