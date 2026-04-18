'use client'

import { useMemo, useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  berechneAnzahl,
  type MengenRegel,
  type MengenRegelTyp,
  type SchwellwertStufe,
} from '@/lib/packing-quantity'

/**
 * Presets decken die häufigsten Camping-Szenarien ab und werden als Chips
 * über dem Regel-Editor angeboten – ein Klick füllt die Felder.
 */
const PRESETS: Array<{ label: string; build: () => MengenRegel }> = [
  { label: 'Pro Tag +2 Reserve, max 10', build: () => ({ typ: 'pro_tag', proTag: 1, reserve: 2, max: 10 }) },
  { label: 'Alle 3 Tage (max 4)', build: () => ({ typ: 'pro_n_tage', n: 3, max: 4 }) },
  { label: 'Wöchentlich 1', build: () => ({ typ: 'pro_woche', proWoche: 1 }) },
  { label: 'Ab 7 Tagen 1', build: () => ({ typ: 'schwellwert', stufen: [{ abTage: 0, menge: 0 }, { abTage: 7, menge: 1 }] }) },
]

const TYP_LABELS: Record<MengenRegelTyp, string> = {
  fest: 'Fest',
  pro_tag: 'Pro Tag (+ Reserve)',
  pro_n_tage: 'Pro angefangene N Tage',
  pro_woche: 'Pro angefangene Woche',
  schwellwert: 'Nach Reisedauer (Stufen)',
}

const PREVIEW_DAYS = [3, 7, 14]

interface MengenRegelEditorProps {
  value: MengenRegel | null
  onChange: (value: MengenRegel | null) => void
  /** Wenn true, ist der Kind-Override nicht sinnvoll und wird ausgeblendet (z.B. bei pauschal). */
  kindOverrideDisabled?: boolean
  /** Wird angezeigt statt der Anzahl, wenn kein dynamisches Verhalten aktiv. */
  festesAnzahlPlaceholder?: string
}

/**
 * Editor für dynamische Mengenregeln. Zeigt Typ-Auswahl, passende Felder,
 * optionalen Kind-Override und eine Live-Vorschau für mehrere Reisedauern.
 *
 * Kontrollierte Komponente: `value` ist die aktuelle Regel (oder null für
 * Standard-Verhalten „Fest"-Eingabefeld außerhalb).
 */
export function MengenRegelEditor({
  value,
  onChange,
  kindOverrideDisabled = false,
}: MengenRegelEditorProps) {
  const [showKind, setShowKind] = useState<boolean>(!!value?.kind)

  useEffect(() => {
    if (!value?.kind) return
    setShowKind(true)
  }, [value?.kind])

  const typ: MengenRegelTyp = value?.typ ?? 'fest'

  const handleTypChange = (nextTyp: MengenRegelTyp) => {
    if (nextTyp === typ) return
    onChange(defaultRegel(nextTyp))
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Mengenregel</Label>
        <p className="text-xs text-muted-foreground">
          Optional: Anzahl abhängig von Reisedauer und Kind/Erwachsener automatisch berechnen.
        </p>
      </div>

      {/* Preset-Chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.build())}
            className="text-xs px-2 py-1 rounded-full border border-border/60 bg-background hover:bg-muted"
          >
            {p.label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => {
              setShowKind(false)
              onChange(null)
            }}
            className="text-xs px-2 py-1 rounded-full border border-border/60 bg-background hover:bg-muted text-muted-foreground"
          >
            Regel entfernen
          </button>
        )}
      </div>

      {/* Typ-Auswahl */}
      <div>
        <Label className="text-xs">Regeltyp</Label>
        <Select value={typ} onValueChange={(v) => handleTypChange(v as MengenRegelTyp)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TYP_LABELS) as MengenRegelTyp[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYP_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Felder je nach Typ */}
      {value && <RegelFelder value={value} onChange={onChange} isKind={false} />}

      {/* Kind-Override */}
      {value && !kindOverrideDisabled && (
        <Collapsible open={showKind} onOpenChange={setShowKind}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between text-xs text-muted-foreground px-2 py-1.5 rounded hover:bg-muted/40"
            >
              <span className="flex items-center gap-1.5">
                {showKind ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Für Kinder abweichend
              </span>
              {value.kind && <span className="text-[10px] italic">aktiv</span>}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2 border-l-2 border-border/60 pl-3">
              <p className="text-[11px] text-muted-foreground">
                Nur die Felder setzen, die bei Kindern abweichen. Nicht gesetzte Werte nutzen die
                Erwachsenen-Regel.
              </p>
              <RegelFelder value={value} onChange={onChange} isKind={true} />
              {value.kind && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const { kind: _ignored, ...rest } = value
                    void _ignored
                    onChange(rest as MengenRegel)
                  }}
                >
                  Kind-Werte entfernen
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Live-Vorschau */}
      {value && <RegelVorschau regel={value} />}
    </div>
  )
}

function defaultRegel(typ: MengenRegelTyp): MengenRegel {
  switch (typ) {
    case 'fest':
      return { typ: 'fest', anzahl: 1 }
    case 'pro_tag':
      return { typ: 'pro_tag', proTag: 1, reserve: 0 }
    case 'pro_n_tage':
      return { typ: 'pro_n_tage', n: 3 }
    case 'pro_woche':
      return { typ: 'pro_woche', proWoche: 1 }
    case 'schwellwert':
      return { typ: 'schwellwert', stufen: [{ abTage: 0, menge: 0 }] }
  }
}

function RegelFelder({
  value,
  onChange,
  isKind,
}: {
  value: MengenRegel
  onChange: (v: MengenRegel) => void
  isKind: boolean
}) {
  // Im Kind-Modus werden Änderungen in value.kind geschrieben; sonst direkt.
  const update = (patch: Partial<MengenRegel>) => {
    if (!isKind) {
      onChange({ ...value, ...patch } as MengenRegel)
      return
    }
    const kindPatch = { ...(value.kind ?? {}), ...patch }
    onChange({ ...value, kind: kindPatch } as MengenRegel)
  }

  const effectiveValue = isKind ? ((value.kind ?? {}) as Partial<MengenRegel>) : value

  switch (value.typ) {
    case 'fest': {
      const v = effectiveValue as Partial<{ anzahl: number }>
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Anzahl"
            value={v.anzahl}
            placeholder={isKind ? `wie Erwachsene (${(value as Extract<MengenRegel, {typ:'fest'}>).anzahl})` : undefined}
            onChange={(n) => update({ anzahl: n } as Partial<MengenRegel>)}
            allowEmpty={isKind}
          />
        </div>
      )
    }
    case 'pro_tag': {
      const v = effectiveValue as Partial<{ proTag: number; reserve: number; max: number }>
      const base = value
      return (
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="pro Tag"
            step={0.5}
            value={v.proTag}
            placeholder={isKind ? `wie Erw. (${base.proTag})` : undefined}
            onChange={(n) => update({ proTag: n } as Partial<MengenRegel>)}
            allowEmpty={isKind}
          />
          <NumberField
            label="Reserve"
            value={v.reserve}
            placeholder={isKind ? `wie Erw. (${base.reserve})` : undefined}
            onChange={(n) => update({ reserve: n } as Partial<MengenRegel>)}
            allowEmpty={isKind}
          />
          <NumberField
            label="Max"
            value={v.max}
            placeholder={isKind ? `wie Erw.${base.max !== undefined ? ` (${base.max})` : ''}` : 'kein Max'}
            onChange={(n) => update({ max: n } as Partial<MengenRegel>)}
            allowEmpty
          />
        </div>
      )
    }
    case 'pro_n_tage': {
      const v = effectiveValue as Partial<{ n: number; max: number }>
      const base = value
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="alle N Tage 1"
            value={v.n}
            placeholder={isKind ? `wie Erw. (${base.n})` : undefined}
            onChange={(n) => update({ n } as Partial<MengenRegel>)}
            allowEmpty={isKind}
          />
          <NumberField
            label="Max"
            value={v.max}
            placeholder={isKind ? `wie Erw.${base.max !== undefined ? ` (${base.max})` : ''}` : 'kein Max'}
            onChange={(n) => update({ max: n } as Partial<MengenRegel>)}
            allowEmpty
          />
        </div>
      )
    }
    case 'pro_woche': {
      const v = effectiveValue as Partial<{ proWoche: number; max: number }>
      const base = value
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="pro Woche"
            value={v.proWoche}
            placeholder={isKind ? `wie Erw. (${base.proWoche})` : undefined}
            onChange={(n) => update({ proWoche: n } as Partial<MengenRegel>)}
            allowEmpty={isKind}
          />
          <NumberField
            label="Max"
            value={v.max}
            placeholder={isKind ? `wie Erw.${base.max !== undefined ? ` (${base.max})` : ''}` : 'kein Max'}
            onChange={(n) => update({ max: n } as Partial<MengenRegel>)}
            allowEmpty
          />
        </div>
      )
    }
    case 'schwellwert': {
      const stufen = isKind
        ? (effectiveValue as Partial<{ stufen: SchwellwertStufe[] }>).stufen ?? []
        : value.stufen
      const setStufen = (next: SchwellwertStufe[]) => {
        if (!isKind) {
          onChange({ ...value, stufen: next })
          return
        }
        onChange({ ...value, kind: { stufen: next } })
      }
      return (
        <div className="space-y-2">
          <Label className="text-xs">Stufen</Label>
          {stufen.length === 0 && isKind && (
            <p className="text-[11px] text-muted-foreground">Keine abweichenden Kind-Stufen – Erwachsenen-Stufen gelten.</p>
          )}
          {stufen.map((stufe, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <NumberField
                label={idx === 0 ? 'ab Tag' : undefined}
                value={stufe.abTage}
                onChange={(n) => {
                  const next = stufen.map((s, i) => (i === idx ? { ...s, abTage: n ?? 0 } : s))
                  setStufen(next)
                }}
              />
              <NumberField
                label={idx === 0 ? 'Menge' : undefined}
                value={stufe.menge}
                onChange={(n) => {
                  const next = stufen.map((s, i) => (i === idx ? { ...s, menge: n ?? 0 } : s))
                  setStufen(next)
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setStufen(stufen.filter((_, i) => i !== idx))}
                className="h-9 w-9"
                aria-label="Stufe entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const lastAb = stufen.length > 0 ? stufen[stufen.length - 1]!.abTage : 0
              setStufen([...stufen, { abTage: lastAb + 7, menge: 1 }])
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Stufe hinzufügen
          </Button>
        </div>
      )
    }
  }
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  step,
  allowEmpty,
}: {
  label?: string
  value: number | undefined
  onChange: (n: number | undefined) => void
  placeholder?: string
  step?: number
  allowEmpty?: boolean
}) {
  return (
    <div>
      {label && <Label className="text-xs">{label}</Label>}
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={step ?? 1}
        value={value === undefined || value === null ? '' : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(allowEmpty ? undefined : 0)
            return
          }
          const n = Number(raw)
          if (Number.isNaN(n)) return
          onChange(n)
        }}
      />
    </div>
  )
}

function RegelVorschau({ regel }: { regel: MengenRegel }) {
  const rows = useMemo(() => {
    return PREVIEW_DAYS.map((tage) => ({
      tage,
      erwachsener: berechneAnzahl(regel, tage, false),
      kind: regel.kind ? berechneAnzahl(regel, tage, true) : null,
    }))
  }, [regel])

  const hasKind = rows.some((r) => r.kind !== null)

  return (
    <div className="rounded-md bg-background border border-border/60 p-2">
      <div className="text-[11px] font-medium text-muted-foreground mb-1">Vorschau</div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 text-xs">
        <div className="text-muted-foreground">Tage</div>
        <div className="text-muted-foreground">Erwachsener</div>
        <div className="text-muted-foreground">{hasKind ? 'Kind' : ''}</div>
        {rows.map((r) => (
          <div key={r.tage} className="contents">
            <div>{r.tage}</div>
            <div className="font-medium">{r.erwachsener}</div>
            <div className="font-medium">{r.kind ?? (hasKind ? '—' : '')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
