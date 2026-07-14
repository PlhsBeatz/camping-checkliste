'use client'

import { useState } from 'react'
import type { Rastplatz } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pencil,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  MoreVertical,
  MapPin,
} from 'lucide-react'
import { merkmalLabel } from '@/lib/rastplatz-merkmale'
import { openRastplatzInAdac, openRastplatzInGoogleMaps } from '@/lib/maps-export'
import type { RastplatzBewertungFilter, RastplatzFilterState } from '@/lib/rastplatz-filter'

interface RastplaetzeTableProps {
  items: Rastplatz[]
  filter: RastplatzFilterState
  onFilterChange: (patch: Partial<RastplatzFilterState>) => void
  onEdit: (item: Rastplatz) => void
  onDelete: (item: Rastplatz) => void
}

export function RastplaetzeTable({
  items,
  filter,
  onFilterChange,
  onEdit,
  onDelete,
}: RastplaetzeTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const { search, filterBewertung, filterKategorie } = filter

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Suchen…"
          value={search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="sm:flex-1"
        />
        <Select
          value={filterBewertung}
          onValueChange={(v) =>
            onFilterChange({ filterBewertung: v as RastplatzBewertungFilter })
          }
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Bewertung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="empfehlung">Empfehlung</SelectItem>
            <SelectItem value="no_go">No-Go</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterKategorie}
          onValueChange={(v) => onFilterChange({ filterKategorie: v })}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="rastplatz">Rastplatz</SelectItem>
            <SelectItem value="tankstelle">Tankstelle</SelectItem>
            <SelectItem value="parkplatz">Parkplatz</SelectItem>
            <SelectItem value="autohof">Autohof</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
            <SelectItem value="sonstiges">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{items.length} Einträge</p>

      <div className="space-y-2">
        {items.map((r) => (
          <div
            key={r.id}
            className="bg-card rounded-xl border border-subtle shadow-sm px-4 py-3 flex gap-3 items-start"
          >
            <div className="mt-0.5 shrink-0">
              {r.bewertung === 'empfehlung' ? (
                <ThumbsUp className="h-5 w-5 text-green-700" />
              ) : (
                <ThumbsDown className="h-5 w-5 text-red-700" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-sm text-muted-foreground">
                {[r.kategorie, r.ort, r.land].filter(Boolean).join(' · ')}
              </div>
              {r.merkmale.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.merkmale.map((m) => (
                    <span
                      key={m}
                      className="text-xs bg-muted border border-subtle rounded px-1.5 py-0.5"
                    >
                      {merkmalLabel(m)}
                    </span>
                  ))}
                </div>
              )}
              {r.bemerkungen && (
                <p className="text-sm mt-1 text-foreground/80 line-clamp-2">{r.bemerkungen}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu
                open={openMenuId === r.id}
                onOpenChange={(o) => setOpenMenuId(o ? r.id : null)}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpenMenuId(null)
                      openRastplatzInGoogleMaps(r)
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Google Maps öffnen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpenMenuId(null)
                      void openRastplatzInAdac(r)
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    ADAC öffnen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpenMenuId(null)
                      onEdit(r)
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpenMenuId(null)
                      onDelete(r)
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {filterBewertung === 'empfehlung'
              ? 'Keine Empfehlungen gefunden.'
              : filterBewertung === 'no_go'
                ? 'Keine No-Gos gefunden.'
                : 'Keine Rastplätze gefunden.'}
          </p>
        )}
      </div>
    </div>
  )
}
