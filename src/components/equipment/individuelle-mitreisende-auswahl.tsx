'use client'

import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { sortMitreisendeNachRolleUndName } from '@/lib/mitreisenden-sort'
import type { MitreisendenZeile } from '@/lib/equipment-form'

/** shadcn-Checkbox, dunkelgrün, gleiche Größe wie zuvor (h-3 w-3) */
export const EQUIPMENT_CHIP_CHECKBOX_CLASS =
  'h-3 w-3 shrink-0 border-[rgb(45,79,30)] data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:text-white data-[state=checked]:border-[rgb(45,79,30)] [&_svg]:h-2.5 [&_svg]:w-2.5'

interface IndividuelleMitreisendeAuswahlProps {
  mitreisende: MitreisendenZeile[]
  standardMitreisendeIds: string[]
  onStandardMitreisendeChange: (next: string[]) => void
  extraOpen: boolean
  onExtraOpenChange: (open: boolean) => void
}

export function IndividuelleMitreisendeAuswahl({
  mitreisende,
  standardMitreisendeIds,
  onStandardMitreisendeChange,
  extraOpen,
  onExtraOpenChange,
}: IndividuelleMitreisendeAuswahlProps) {
  const standardMit = useMemo(
    () =>
      sortMitreisendeNachRolleUndName(mitreisende.filter((m) => m.urlaub_standard_mitnehmen)),
    [mitreisende]
  )
  const weitereMit = useMemo(
    () =>
      sortMitreisendeNachRolleUndName(mitreisende.filter((m) => !m.urlaub_standard_mitnehmen)),
    [mitreisende]
  )
  const kannEinklappen = standardMit.length > 0 && weitereMit.length > 0

  const toggleOne = (id: string, checked: boolean) => {
    if (checked) {
      if (!standardMitreisendeIds.includes(id))
        onStandardMitreisendeChange([...standardMitreisendeIds, id])
    } else {
      onStandardMitreisendeChange(standardMitreisendeIds.filter((x) => x !== id))
    }
  }

  const renderChips = (rows: MitreisendenZeile[]) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {rows.map((m) => (
        <label
          key={m.id}
          className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80"
        >
          <Checkbox
            checked={standardMitreisendeIds.includes(m.id)}
            onCheckedChange={(c) => toggleOne(m.id, !!c)}
            className={EQUIPMENT_CHIP_CHECKBOX_CLASS}
          />
          {m.name}
        </label>
      ))}
    </div>
  )

  const anzuzeigen = kannEinklappen ? standardMit : sortMitreisendeNachRolleUndName(mitreisende)

  return (
    <div>
      <Label>Mitreisende</Label>
      {renderChips(anzuzeigen)}
      {kannEinklappen && (
        <Collapsible open={extraOpen} onOpenChange={onExtraOpenChange}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 -ml-1'
              )}
            >
              <ChevronDown
                className={cn('h-3.5 w-3.5 shrink-0 transition-transform', extraOpen && 'rotate-180')}
              />
              {extraOpen ? 'Weniger anzeigen' : `Weitere (${weitereMit.length})`}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>{renderChips(weitereMit)}</CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
