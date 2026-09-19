'use client'

import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { EQUIPMENT_CHIP_CHECKBOX_CLASS } from '@/components/equipment/individuelle-mitreisende-auswahl'
import type { TagGroupForEquipment } from '@/lib/equipment-form'
import { cn } from '@/lib/utils'

interface EquipmentTagsBlockProps {
  groups: TagGroupForEquipment[]
  selectedTagIds: string[]
  onToggleTag: (tagId: string, checked: boolean) => void
  idPrefix: string
  disabled?: boolean
}

export function EquipmentTagsBlock({
  groups,
  selectedTagIds,
  onToggleTag,
  idPrefix,
  disabled = false,
}: EquipmentTagsBlockProps) {
  return (
    <div className={cn('space-y-4', disabled && 'opacity-60')}>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Tags angelegt.</p>
      ) : (
        groups.map(({ kat, tags: catTags }) => (
          <div key={kat.id} className="space-y-2">
            <Label className="text-sm font-medium">{kat.titel}</Label>
            <div className="flex flex-wrap gap-2">
              {catTags.map((tag) => (
                <label
                  key={tag.id}
                  htmlFor={`${idPrefix}-tag-${tag.id}`}
                  className={cn(
                    'flex items-center gap-1.5 text-xs bg-background px-2 py-1 rounded border border-border/60',
                    disabled
                      ? 'cursor-not-allowed'
                      : 'cursor-pointer hover:bg-muted/80'
                  )}
                >
                  <Checkbox
                    id={`${idPrefix}-tag-${tag.id}`}
                    checked={selectedTagIds.includes(tag.id)}
                    disabled={disabled}
                    onCheckedChange={(c) => {
                      if (disabled) return
                      onToggleTag(tag.id, !!c)
                    }}
                    className={EQUIPMENT_CHIP_CHECKBOX_CLASS}
                  />
                  <span>{tag.titel}</span>
                </label>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
