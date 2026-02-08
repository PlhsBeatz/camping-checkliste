'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ListChecks, 
  Calendar, 
  Package, 
  Settings, 
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
      icon: ListChecks,
      label: 'AKTUELLE PACKLISTE',
      href: '/',
      active: pathname === '/'
    },
    {
      icon: Calendar,
      label: 'MEINE URLAUBE',
      href: '/urlaube',
      active: pathname.startsWith('/urlaube')
    },
    {
      icon: Package,
      label: 'AUSRÜSTUNG',
      href: '/ausruestung',
      active: pathname.startsWith('/ausruestung')
    }
  ]

  const configItems = [
    { label: 'Kategorien', href: '/kategorien' },
    { label: 'Tags & Labels', href: '/tags' },
    { label: 'Mitreisende', href: '/mitreisende' },
    { label: 'Transportmittel', href: '/transportmittel', disabled: true }
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
          "fixed top-0 left-0 h-full w-[280px] bg-sidebar text-sidebar-foreground z-50 transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo & Version */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Tent className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-sidebar-foreground">CAMPPACK</h1>
              <p className="text-xs text-sidebar-foreground/60">v 0.3 PRO</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {/* Main Menu Items */}
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onClose()}
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
                item.active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Separator */}
          <div className="my-4 border-t border-sidebar-border" />

          {/* Configuration Dropdown */}
          <div>
            <button
              onClick={() => setConfigExpanded(!configExpanded)}
              className="flex items-center justify-between w-full px-6 py-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <span>KONFIGURATION</span>
              </div>
              {configExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Config Submenu */}
            {configExpanded && (
              <div className="py-2">
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
                      "block px-12 py-2 text-sm transition-colors",
                      item.disabled
                        ? "text-sidebar-foreground/30 cursor-not-allowed"
                        : pathname === item.href
                        ? "text-sidebar-primary font-medium"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
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
        <div className="p-6 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
            <div className="w-2 h-2 bg-sidebar-primary rounded-full" />
            <span>ONLINE & SYNCHRONISIERT</span>
          </div>
        </div>
      </aside>
    </>
  )
}
