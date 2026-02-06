'use client'

import { useState } from 'react'
import { X, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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
      return (parts[0][0] + parts[1][0]).toUpperCase()
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
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed left-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-blue-900 text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">EINSTELLUNGEN</h2>
            <p className="text-xs text-blue-200">Konfiguration & Profile</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-blue-800"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Pack-Profil wählen */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Pack-Profil wählen
            </h3>
            
            {/* Zentral / Alle Option */}
            <button
              onClick={() => onProfileChange(null)}
              className={`w-full p-4 rounded-lg border-2 mb-3 transition-all ${
                selectedProfile === null
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-blue-900">Zentral / Alle</div>
                  <div className="text-xs text-blue-600">Standard & Gemeinsames</div>
                </div>
              </div>
            </button>

            {/* Individual Travelers */}
            <div className="grid grid-cols-2 gap-3">
              {mitreisende.map((m, index) => (
                <button
                  key={m.id}
                  onClick={() => onProfileChange(m.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedProfile === m.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${getAvatarColor(index)}`}>
                      {getInitials(m.name)}
                    </div>
                    <div className="text-sm font-medium text-gray-900">{m.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Ansicht */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Ansicht
            </h3>
            
            <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200">
              <Checkbox
                id="hide-packed"
                checked={hidePackedItems}
                onCheckedChange={(checked) => onHidePackedChange(checked as boolean)}
              />
              <Label 
                htmlFor="hide-packed" 
                className="text-sm font-medium cursor-pointer flex-1"
              >
                Gepacktes ausblenden
              </Label>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
