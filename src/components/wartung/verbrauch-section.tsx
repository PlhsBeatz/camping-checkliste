'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { VerbrauchMessung, Vacation } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { formatKg, verbrauchGesamtKg } from '@/lib/verbrauch-format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

function formatZeitraum(start: string | null | undefined, ende: string | null | undefined): string {
  if (!start && !ende) return '—'
  const s = start?.slice(0, 10) ?? '…'
  const e = ende?.slice(0, 10) ?? '…'
  return `${s} – ${e}`
}

export function VerbrauchSection({
  messungen,
  vacations,
  canAdmin,
  onMessungCreated,
  onMessungDeleted,
  onRefresh,
}: {
  messungen: VerbrauchMessung[]
  vacations: Vacation[]
  canAdmin: boolean
  onMessungCreated: (item: VerbrauchMessung) => void
  onMessungDeleted: (id: string) => void
  onRefresh: () => void
}) {
  const [urlaubId, setUrlaubId] = useState('')
  const [wertStart, setWertStart] = useState('')
  const [wertEnde, setWertEnde] = useState('')
  const [notizen, setNotizen] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const selectedVacation = vacations.find((v) => v.id === urlaubId)

  const handleCreate = async () => {
    if (!urlaubId || !wertStart || !wertEnde) return
    setSaving(true)
    try {
      const res = await fetch('/api/verbrauch-messungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typ: 'gas',
          urlaub_id: urlaubId,
          messdatum_start: selectedVacation?.startdatum ?? null,
          messdatum_ende: selectedVacation?.enddatum ?? null,
          wert_start: Number(wertStart),
          wert_ende: Number(wertEnde),
          einheit: 'kg',
          notizen: notizen || null,
        }),
      })
      const data = (await res.json()) as ApiResponse<VerbrauchMessung>
      if (res.ok && data.success && data.data) {
        onMessungCreated(data.data)
        setWertStart('')
        setWertEnde('')
        setNotizen('')
      } else {
        onRefresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const id = deleteId
    setDeleteId(null)
    onMessungDeleted(id)
    try {
      const res = await fetch(`/api/verbrauch-messungen/${id}`, { method: 'DELETE' })
      if (!res.ok) onRefresh()
    } catch {
      onRefresh()
    }
  }

  return (
    <div className="space-y-4">
      {canAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gasverbrauch erfassen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Urlaub</Label>
              <Select value={urlaubId} onValueChange={setUrlaubId}>
                <SelectTrigger>
                  <SelectValue placeholder="Urlaub wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {vacations.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.titel} ({v.startdatum?.slice(0, 10)} – {v.enddatum?.slice(0, 10)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gewicht Anfang (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={wertStart}
                  onChange={(e) => setWertStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gewicht Ende (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={wertEnde}
                  onChange={(e) => setWertEnde(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notizen</Label>
              <Textarea value={notizen} onChange={(e) => setNotizen(e.target.value)} rows={2} />
            </div>
            <Button
              onClick={() => void handleCreate()}
              disabled={saving || !urlaubId || !wertStart || !wertEnde}
            >
              <Plus className="mr-1 h-4 w-4" />
              Messung speichern
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {messungen.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Messungen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urlaub</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead className="text-right">Anfang (kg)</TableHead>
                  <TableHead className="text-right">Ende (kg)</TableHead>
                  <TableHead className="text-right">Verbrauch (kg)</TableHead>
                  <TableHead className="text-right">kg/Tag</TableHead>
                  <TableHead>Kommentar</TableHead>
                  {canAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {messungen.map((m) => {
                  const gesamt =
                    m.wert_start != null && m.wert_ende != null
                      ? verbrauchGesamtKg(m.wert_start, m.wert_ende)
                      : m.verbrauch_gesamt
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.urlaub_titel ?? 'Ohne Urlaub'}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatZeitraum(m.messdatum_start, m.messdatum_ende)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatKg(m.wert_start, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatKg(m.wert_ende, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatKg(gesamt, 1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatKg(m.verbrauch_pro_tag, 2)}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-muted-foreground">
                        {m.notizen?.trim() ? m.notizen : '—'}
                      </TableCell>
                      {canAdmin && (
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Messung löschen?"
        description="Diese Verbrauchsmessung wird unwiderruflich gelöscht."
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
