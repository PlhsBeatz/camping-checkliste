'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ChevronDown,
  ChevronRight,
  Tent
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function NavigationSidebar({ isOpen, onClose }: NavigationSidebarProps) {
  const pathname = usePathname()
  const [configExpanded, setConfigExpanded] = useState(false)

  const menuItems = [
    {
      icon: 'checklist',
      label: 'AKTUELLE PACKLISTE',
      href: '/',
      active: pathname === '/'
    },
    {
      icon: 'event',
      label: 'MEINE URLAUBE',
      href: '/urlaube',
      active: pathname.startsWith('/urlaube')
    },
    {
      icon: 'inventory_2',
      label: 'AUSRÜSTUNG',
      href: '/ausruestung',
      active: pathname.startsWith('/ausruestung')
    }
  ]

  const configItems = [
    { label: 'KATEGORIEN', href: '/kategorien' },
    { label: 'TAGS & LABELS', href: '/tags' },
    { label: 'MITREISENDE', href: '/mitreisende' },
    { label: 'TRANSPORTMITTEL', href: '/transportmittel' }
  ]

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen w-[280px] bg-white z-50 transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo & Version */}
        <div className="p-6 bg-[rgb(250,250,249)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[rgb(45,79,30)] rounded-lg flex items-center justify-center flex-shrink-0">
              <Tent className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[rgb(45,79,30)] leading-tight">CAMPPACK</h1>
              <p className="text-xs text-[rgb(45,79,30)]/60">v 0.3 PRO</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {/* Main Menu Items */}
          <div className="px-3 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose()}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  item.active
                    ? "bg-[rgb(45,79,30)] text-white"
                    : "text-gray-700 hover:bg-[rgb(250,250,249)]"
                )}
              >
                <span className="material-icons text-xl">{item.icon}</span>
                <span className="text-xs tracking-wide">{item.label}</span>
                {item.active && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Configuration Dropdown */}
          <div className="mt-4 px-3">
            <button
              onClick={() => setConfigExpanded(!configExpanded)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[rgb(250,250,249)] rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-icons text-xl">settings</span>
                <span className="text-xs tracking-wide">KONFIGURATION</span>
              </div>
              {configExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Config Submenu */}
            {configExpanded && (
              <div className="mt-1 ml-11 space-y-1">
                {configItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.disabled ? '#' : item.href}
                    onClick={(e) => {
                      if (item.disabled) {
                        e.preventDefault()
                        return
                      }
                      onClose()
                    }}
                    className={cn(
                      "block px-4 py-2 text-xs tracking-wide rounded-lg transition-colors",
                      item.disabled
                        ? "text-gray-400 cursor-not-allowed"
                        : pathname === item.href
                        ? "text-[rgb(45,79,30)] font-medium bg-[rgb(250,250,249)]"
                        : "text-gray-600 hover:bg-[rgb(250,250,249)] hover:text-gray-900"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Status Indicator */}
        <div className="p-6 bg-[rgb(250,250,249)] border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="tracking-wide">ONLINE & SYNCHRONISIERT</span>
          </div>
        </div>
      </aside>

      {/* Add Material Icons font if not already included */}
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
    </>
  )
}
