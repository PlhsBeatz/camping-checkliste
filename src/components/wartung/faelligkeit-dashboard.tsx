'use client'

import { useMemo, useState } from 'react'
import type { Faelligkeit, FaelligkeitDashboard } from '@/lib/db'
import { FaelligkeitStatusIndicator } from '@/components/wartung/faelligkeit-ampel-badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { computeAlterJahre } from '@/lib/faelligkeit-status'
import {
  FAELLIGKEIT_TIME_BLOCK_LABELS,
  flattenFaelligkeitDashboard,
  groupFaelligkeitenByDuePeriod,
  type FaelligkeitTimeBlock,
} from '@/lib/faelligkeit-time-groups'
import { CheckCircle2, History, MoreVertical, Pencil, Trash2 } from 'lucide-react'

function TimeBlockHeading({ block, count }: { block: FaelligkeitTimeBlock; count: number }) {
  return (
    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
      {FAELLIGKEIT_TIME_BLOCK_LABELS[block]}
      <span className="font-normal normal-case tracking-normal text-muted-foreground/80">
        {' '}
        · {count}
      </span>
    </h3>
  )
}

function FaelligkeitCard({
  item,
  canAdmin,
  openMenuId,
  setOpenMenuId,
  onQuittieren,
  onHistorie,
  onEdit,
  onDelete,
}: {
  item: Faelligkeit
  canAdmin: boolean
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onQuittieren: (item: Faelligkeit) => void
  onHistorie: (item: Faelligkeit) => void
  onEdit: (item: Faelligkeit) => void
  onDelete: (item: Faelligkeit) => void
}) {
  const alter =
    item.typ === 'alter_anzeige' && item.bezug_datum && !item.gueltig_bis
      ? computeAlterJahre(item.bezug_datum)
      : null

  const showQuittieren = item.quittierung_erforderlich || item.sicherheitsrelevant

  return (
    <div className="bg-card rounded-xl border border-subtle shadow-sm px-4 py-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <FaelligkeitStatusIndicator status={item.ampel_status ?? 'ok'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-brand-heading">{item.name}</span>
          </div>
          {(item.equipment_was || item.transport_name) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[item.equipment_was, item.transport_name].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-1.5 text-sm text-muted-foreground">
            {item.naechste_faelligkeit && (
              <span>Fällig: {item.naechste_faelligkeit.slice(0, 10)}</span>
            )}
            {alter != null && (
              <span>
                {item.naechste_faelligkeit ? ' · ' : ''}
                Alter: ca. {alter} Jahre
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex flex-col items-end gap-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu
          open={openMenuId === item.id}
          onOpenChange={(o) => setOpenMenuId(o ? item.id : null)}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Aktionen">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {showQuittieren && canAdmin && (
              <DropdownMenuItem
                onSelect={() => {
                  setOpenMenuId(null)
                  onQuittieren(item)
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Quittieren
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                setOpenMenuId(null)
                onHistorie(item)
              }}
            >
              <History className="h-4 w-4 mr-2" />
              Historie
            </DropdownMenuItem>
            {canAdmin && (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    setOpenMenuId(null)
                    onEdit(item)
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => {
                    setOpenMenuId(null)
                    onDelete(item)
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function FaelligkeitDashboardView({
  dashboard,
  filterTransportId,
  filterEquipmentId,
  canAdmin,
  onQuittieren,
  onHistorie,
  onEdit,
  onDelete,
}: {
  dashboard: FaelligkeitDashboard
  filterTransportId?: string | null
  filterEquipmentId?: string | null
  canAdmin: boolean
  onQuittieren: (item: Faelligkeit) => void
  onHistorie: (item: Faelligkeit) => void
  onEdit: (item: Faelligkeit) => void
  onDelete: (item: Faelligkeit) => void
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const filteredDashboard = useMemo(() => {
    if (!filterTransportId && !filterEquipmentId) return dashboard
    const match = (item: Faelligkeit) =>
      (!filterTransportId || item.transport_id === filterTransportId) &&
      (!filterEquipmentId || item.equipment_id === filterEquipmentId)
    return {
      ueberfaellig: dashboard.ueberfaellig.filter(match),
      bald_faellig: dashboard.bald_faellig.filter(match),
      ok: dashboard.ok.filter(match),
      nur_info: dashboard.nur_info.filter(match),
    }
  }, [dashboard, filterTransportId, filterEquipmentId])

  const all = flattenFaelligkeitDashboard(filteredDashboard)
  const groups = groupFaelligkeitenByDuePeriod(all)

  if (all.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {filterTransportId || filterEquipmentId
          ? 'Keine Fälligkeiten für diese Zuordnung.'
          : 'Noch keine Fälligkeiten erfasst.'}
        {!filterTransportId && !filterEquipmentId && canAdmin &&
          ' Legen Sie einen Eintrag an oder wählen Sie eine Vorlage.'}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map(({ block, items }) => (
        <section key={block}>
          <TimeBlockHeading block={block} count={items.length} />
          <div className="space-y-2">
            {items.map((item) => (
              <FaelligkeitCard
                key={item.id}
                item={item}
                canAdmin={canAdmin}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                onQuittieren={onQuittieren}
                onHistorie={onHistorie}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
