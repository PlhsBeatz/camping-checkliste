import { useState, useEffect, useMemo } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trash2, Star, MoreVertical, Pencil, Mail, Copy, KeyRound, Share2 } from 'lucide-react'
import { Mitreisender, MitreisendenGruppe, Personentyp } from '@/lib/db'
import type { UserRole } from '@/lib/user-roles'
import { userRoleLabel, personentypLabel } from '@/lib/user-role-labels'
import { useAuth } from '@/components/auth-provider'
import type { ApiResponse } from '@/lib/api-types'
import {
  USER_COLORS,
  DEFAULT_USER_COLOR_BG,
  getMitreisenderAvatarStyle,
} from '@/lib/user-colors'
import { getInitials } from '@/lib/utils'
import { sortMitreisendeNachRolleUndName } from '@/lib/mitreisenden-sort'

function emptyTravelerForm(gruppeId: string) {
  return {
    name: '',
    gruppeId,
    personentyp: 'erwachsen' as Personentyp,
    farbe: DEFAULT_USER_COLOR_BG,
  }
}

function TravelerRow({
  traveler,
  initials,
  index,
  onEdit,
  onDelete,
  onInvite,
  onResetPassword,
  resettingUserId,
}: {
  traveler: Mitreisender
  initials: string
  index: number
  onEdit: (t: Mitreisender) => void
  onDelete: (id: string) => void
  onInvite: (t: Mitreisender) => void
  onResetPassword?: (t: Mitreisender) => void
  resettingUserId?: string | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 bg-card"
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={getMitreisenderAvatarStyle(traveler, index)}
        >
          {initials}
        </div>
        <div>
          <p className="font-medium">{traveler.name}</p>
          {traveler.user_id && (
            <p className="text-xs text-muted-foreground">
              {traveler.user_email ?? '–'}
              {traveler.user_role != null && ` · ${userRoleLabel(traveler.user_role)}`}
              {traveler.personentyp != null && ` · ${personentypLabel(traveler.personentyp)}`}
            </p>
          )}
        </div>
      </div>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!traveler.user_id && (
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false)
                onInvite(traveler)
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Einladung erstellen
            </DropdownMenuItem>
          )}
          {traveler.user_id && onResetPassword && (
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false)
                onResetPassword(traveler)
              }}
              disabled={resettingUserId === traveler.user_id}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {resettingUserId === traveler.user_id ? 'Wird zurückgesetzt…' : 'Passwort zurücksetzen'}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onEdit(traveler)
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onDelete(traveler.id)
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface TravelersManagerProps {
  travelers: Mitreisender[]
  gruppen?: MitreisendenGruppe[]
  onRefresh: () => void
  openNewTravelerTrigger?: boolean
  onOpenNewTravelerConsumed?: () => void
  openNewGroupTrigger?: boolean
  onOpenNewGroupConsumed?: () => void
}

export function TravelersManager({
  travelers,
  gruppen = [],
  onRefresh,
  openNewTravelerTrigger,
  onOpenNewTravelerConsumed,
  openNewGroupTrigger,
  onOpenNewGroupConsumed,
}: TravelersManagerProps) {
  const { canAccessConfig, canAccessSystemAdmin, user, refetch } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [editingTraveler, setEditingTraveler] = useState<Mitreisender | null>(null)
  const [deleteTravelerId, setDeleteTravelerId] = useState<string | null>(null)
  const [inviteTraveler, setInviteTraveler] = useState<Mitreisender | null>(null)
  const [inviteRole, setInviteRole] = useState<'admin' | 'standard'>('standard')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteBerechtigungen, setInviteBerechtigungen] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword: string } | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [resetPasswordConfirmTraveler, setResetPasswordConfirmTraveler] = useState<Mitreisender | null>(null)
  const [assignMeConfirmOpen, setAssignMeConfirmOpen] = useState(false)

  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<MitreisendenGruppe | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)
  const [groupForm, setGroupForm] = useState({
    name: '',
    urlaubStandardMitnehmen: false,
  })

  const [form, setForm] = useState({
    name: '',
    gruppeId: 'grp-familie',
    personentyp: 'erwachsen' as Personentyp,
    farbe: DEFAULT_USER_COLOR_BG,
  })
  const [formBerechtigungen, setFormBerechtigungen] = useState<string[]>([])
  const [formUserRole, setFormUserRole] = useState<UserRole | ''>('')

  const groupedTravelers = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; urlaubDefault: boolean; sortOrder: number; travelers: Mitreisender[] }
    >()
    for (const t of travelers) {
      const gid = t.gruppe_id ?? 'unknown'
      const gmeta = gruppen.find((g) => g.id === gid)
      const gname = t.gruppe_name ?? gmeta?.name ?? 'Ohne Haushalt'
      const urlaubDefault = gmeta?.urlaub_standard_mitnehmen ?? t.urlaub_standard_mitnehmen ?? false
      const sortOrder = gmeta?.sort_order ?? 999
      if (!map.has(gid)) {
        map.set(gid, { id: gid, name: gname, urlaubDefault, sortOrder, travelers: [] })
      }
      map.get(gid)!.travelers.push(t)
    }
    for (const g of gruppen) {
      if (!map.has(g.id)) {
        map.set(g.id, {
          id: g.id,
          name: g.name,
          urlaubDefault: g.urlaub_standard_mitnehmen,
          sortOrder: g.sort_order,
          travelers: [],
        })
      }
    }
    return [...map.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'de')
    )
  }, [travelers, gruppen])

  const sortedGruppen = useMemo(
    () =>
      gruppen.length > 0
        ? [...gruppen].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'de'))
        : groupedTravelers.map((g) => ({
            id: g.id,
            name: g.name,
            sort_order: g.sortOrder,
            ist_standard_familie: g.urlaubDefault,
            urlaub_standard_mitnehmen: g.urlaubDefault,
            created_at: '',
          })),
    [gruppen, groupedTravelers]
  )

  const defaultGruppeId = useMemo(() => {
    const preferred = sortedGruppen.find((g) => g.urlaub_standard_mitnehmen)?.id
    return preferred ?? sortedGruppen[0]?.id ?? 'grp-familie'
  }, [sortedGruppen])

  const gruppenForSelect = useMemo(() => {
    if (!form.gruppeId || sortedGruppen.some((g) => g.id === form.gruppeId)) {
      return sortedGruppen
    }
    const meta = gruppen.find((g) => g.id === form.gruppeId)
    const travelerMeta = travelers.find((t) => t.gruppe_id === form.gruppeId)
    return [
      ...sortedGruppen,
      {
        id: form.gruppeId,
        name: meta?.name ?? travelerMeta?.gruppe_name ?? 'Haushalt',
        sort_order: meta?.sort_order ?? 999,
        ist_standard_familie: meta?.ist_standard_familie ?? false,
        urlaub_standard_mitnehmen: meta?.urlaub_standard_mitnehmen ?? false,
        created_at: meta?.created_at ?? '',
      },
    ].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'de'))
  }, [sortedGruppen, form.gruppeId, gruppen, travelers])

  const BERECHTIGUNGEN_OPTIONS = [
    { key: 'can_edit_pauschal_entries', label: 'Pauschale Einträge bearbeiten' },
    { key: 'gepackt_erfordert_elternkontrolle', label: 'Gepackt erfordert Elternkontrolle' },
  ] as const

  const handleCreate = async () => {
    if (!form.name.trim()) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/mitreisende', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          gruppeId: form.gruppeId,
          personentyp: form.personentyp,
          farbe: form.farbe || null,
        }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setForm(emptyTravelerForm(defaultGruppeId))
        await onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create traveler:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingTraveler || !form.name.trim()) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/mitreisende', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTraveler.id,
          name: form.name,
          userId: editingTraveler.user_id ?? null,
          gruppeId: form.gruppeId,
          personentyp: form.personentyp,
          farbe: form.farbe || null,
        }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!data.success) {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
        return
      }
      if (editingTraveler.user_id && formUserRole && formUserRole !== editingTraveler.user_role) {
        const roleRes = await fetch(`/api/users/${editingTraveler.user_id}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: formUserRole }),
        })
        const roleData = (await roleRes.json()) as ApiResponse<unknown>
        if (!roleData.success) {
          alert('Mitreisender aktualisiert, aber Benutzer-Rolle konnte nicht geändert werden.')
        }
      }
      if (form.personentyp === 'kind') {
        const permRes = await fetch(`/api/mitreisende/${editingTraveler.id}/berechtigungen`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ berechtigungen: formBerechtigungen }),
        })
        const permData = (await permRes.json()) as ApiResponse<unknown>
        if (!permData.success) {
          alert('Mitreisender aktualisiert, aber Berechtigungen konnten nicht gespeichert werden.')
        }
      } else if (editingTraveler.user_id && formUserRole === 'standard') {
        const permRes = await fetch(`/api/mitreisende/${editingTraveler.id}/berechtigungen`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            berechtigungen: formBerechtigungen.filter((p) => p === 'can_edit_pauschal_entries'),
          }),
        })
        const permData = (await permRes.json()) as ApiResponse<unknown>
        if (!permData.success) {
          alert('Mitreisender aktualisiert, aber Berechtigungen konnten nicht gespeichert werden.')
        }
      }
      setShowDialog(false)
      setEditingTraveler(null)
      setForm(emptyTravelerForm(defaultGruppeId))
      setFormBerechtigungen([])
      setFormUserRole('')
      await onRefresh()
    } catch (error) {
      console.error('Failed to update traveler:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    setDeleteTravelerId(id)
  }

  const executeDeleteTraveler = async () => {
    if (!deleteTravelerId) return
    const id = deleteTravelerId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/mitreisende?id=${id}`, {
        method: 'DELETE'
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete traveler:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const openEdit = (traveler: Mitreisender) => {
    setEditingTraveler(traveler)
    setForm({
      name: traveler.name,
      gruppeId: traveler.gruppe_id || defaultGruppeId,
      personentyp: traveler.personentyp ?? 'erwachsen',
      farbe: traveler.farbe || DEFAULT_USER_COLOR_BG,
    })
    setFormUserRole(traveler.user_role || '')
    setFormBerechtigungen([])
    setShowDialog(true)
  }

  useEffect(() => {
    if (!editingTraveler) {
      setFormBerechtigungen([])
      setFormUserRole('')
      return
    }
    setFormUserRole(editingTraveler.user_role || '')
    const fetchBerechtigungen = async () => {
      try {
        const res = await fetch(`/api/mitreisende/${editingTraveler.id}/berechtigungen`)
        const data = (await res.json()) as { success?: boolean; data?: string[] }
        if (data.success && Array.isArray(data.data)) {
          setFormBerechtigungen(data.data)
        }
      } catch {
        // ignore
      }
    }
    fetchBerechtigungen()
  }, [editingTraveler])

  const openNewGroup = () => {
    setEditingGroup(null)
    setGroupForm({ name: '', urlaubStandardMitnehmen: false })
    setShowGroupDialog(true)
  }

  const openEditGroup = (group: MitreisendenGruppe) => {
    setEditingGroup(group)
    setGroupForm({
      name: group.name,
      urlaubStandardMitnehmen: group.urlaub_standard_mitnehmen,
    })
    setShowGroupDialog(true)
  }

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      alert('Bitte geben Sie einen Haushaltsnamen ein')
      return
    }
    setIsLoading(true)
    try {
      const payload = {
        name: groupForm.name.trim(),
        urlaubStandardMitnehmen: groupForm.urlaubStandardMitnehmen,
      }
      const res = await fetch('/api/mitreisenden-gruppen', {
        method: editingGroup ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingGroup ? { id: editingGroup.id, ...payload } : payload),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowGroupDialog(false)
        setEditingGroup(null)
        await onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch {
      alert('Fehler beim Speichern des Haushalts')
    } finally {
      setIsLoading(false)
    }
  }

  const executeDeleteGroup = async () => {
    if (!deleteGroupId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/mitreisenden-gruppen?id=${encodeURIComponent(deleteGroupId)}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setDeleteGroupId(null)
        await onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch {
      alert('Fehler beim Löschen des Haushalts')
    } finally {
      setIsLoading(false)
    }
  }

  const openNew = () => {
    setEditingTraveler(null)
    setForm(emptyTravelerForm(defaultGruppeId))
    setShowDialog(true)
  }

  const openInvite = (traveler: Mitreisender) => {
    setInviteTraveler(traveler)
    setInviteRole('standard')
    setInviteLink(null)
    setInviteBerechtigungen([])
  }

  useEffect(() => {
    if (openNewTravelerTrigger) {
      setEditingTraveler(null)
      setForm(emptyTravelerForm(defaultGruppeId))
      setShowDialog(true)
      onOpenNewTravelerConsumed?.()
    }
  }, [openNewTravelerTrigger, onOpenNewTravelerConsumed, defaultGruppeId])

  useEffect(() => {
    if (openNewGroupTrigger) {
      setEditingGroup(null)
      setGroupForm({ name: '', urlaubStandardMitnehmen: false })
      setShowGroupDialog(true)
      onOpenNewGroupConsumed?.()
    }
  }, [openNewGroupTrigger, onOpenNewGroupConsumed])

  const handleAssignMe = async () => {
    if (!editingTraveler || editingTraveler.user_id || user?.mitreisender_id) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/assign-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitreisenderId: editingTraveler.id })
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (data.success) {
        await refetch()
        onRefresh()
        setShowDialog(false)
        setEditingTraveler(null)
        setAssignMeConfirmOpen(false)
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to assign me:', error)
      alert('Fehler bei der Zuordnung')
    } finally {
      setIsLoading(false)
    }
  }

  const showAssignMeOption =
    !!editingTraveler &&
    !editingTraveler.user_id &&
    !user?.mitreisender_id

  const handleCreateInvite = async () => {
    if (!inviteTraveler) return
    setIsLoading(true)
    try {
      if (inviteTraveler.personentyp === 'kind' || inviteBerechtigungen.length > 0) {
        const permRes = await fetch(`/api/mitreisende/${inviteTraveler.id}/berechtigungen`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ berechtigungen: inviteBerechtigungen }),
        })
        const permData = (await permRes.json()) as { success?: boolean }
        if (!permData.success) {
          alert('Berechtigungen konnten nicht gespeichert werden.')
          return
        }
      }
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitreisenderId: inviteTraveler.id, role: inviteRole })
      })
      const data = (await res.json()) as { success?: boolean; link?: string; error?: string }
      if (data.success && data.link) {
        setInviteLink(data.link)
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create invite:', error)
      alert('Fehler beim Erstellen der Einladung')
    } finally {
      setIsLoading(false)
    }
  }

  const copyInviteLink = () => {
    if (inviteLink && navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink)
      alert('Link kopiert!')
    }
  }

  const handleResetPassword = async (traveler: Mitreisender) => {
    if (!traveler.user_id) return
    setResettingUserId(traveler.user_id)
    setResetResult(null)
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: traveler.user_id })
      })
      const data = (await res.json()) as {
        success?: boolean
        temporaryPassword?: string
        email?: string
        error?: string
      }
      if (data.success && data.temporaryPassword != null) {
        setResetResult({
          email: data.email ?? '',
          temporaryPassword: data.temporaryPassword
        })
      } else {
        alert(data.error ?? 'Passwort konnte nicht zurückgesetzt werden')
      }
    } catch {
      alert('Fehler beim Zurücksetzen')
    } finally {
      setResettingUserId(null)
    }
  }

  const copyResetPassword = () => {
    if (!resetResult) return
    navigator.clipboard?.writeText(resetResult.temporaryPassword).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    })
  }

  const shareResetPassword = () => {
    if (!resetResult) return
    const text = `Neues Passwort für ${resetResult.email}:\n\n${resetResult.temporaryPassword}\n\nBitte nach dem ersten Login unter „Mein Profil“ → „Passwort ändern“ ein eigenes Passwort setzen.`
    const copyToClipboard = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text)
      }
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    }
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      navigator.share({
        title: 'Passwort zurückgesetzt',
        text
      }).catch(copyToClipboard)
    } else {
      copyToClipboard()
    }
  }

  const travelerNames = travelers.map((t) => t.name)
  const getTravelerInitials = (name: string) => getInitials(name, travelerNames)

  const getGruppeMeta = (groupId: string): MitreisendenGruppe | undefined =>
    sortedGruppen.find((g) => g.id === groupId)

  return (
    <div className="space-y-6">
      {groupedTravelers.map((group) => {
        const sorted = sortMitreisendeNachRolleUndName(group.travelers)
        const groupMeta = getGruppeMeta(group.id)
        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  {group.urlaubDefault && (
                    <Star className="h-4 w-4" style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }} />
                  )}
                  {group.name}
                </h3>
                {group.urlaubDefault && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Dieser Haushalt wird bei neuen Urlauben automatisch vorausgewählt
                  </p>
                )}
              </div>
              {canAccessConfig && groupMeta && group.id !== 'unknown' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEditGroup(groupMeta)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setDeleteGroupId(groupMeta.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {sorted.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-3">
                Keine Personen in diesem Haushalt
              </p>
            ) : (
              <div className="space-y-2">
                {sorted.map((traveler, idx) => (
                  <TravelerRow
                    key={traveler.id}
                    traveler={traveler}
                    initials={getTravelerInitials(traveler.name)}
                    index={idx}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onInvite={openInvite}
                    onResetPassword={canAccessConfig ? (t) => setResetPasswordConfirmTraveler(t) : undefined}
                    resettingUserId={resettingUserId}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {travelers.length === 0 && sortedGruppen.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
          Noch keine Mitreisenden angelegt
        </p>
      )}

      {/* Create/Edit Dialog – Padding wie Packliste/Ausrüstung (px-6) */}
      <ResponsiveModal
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingTraveler ? 'Mitreisenden bearbeiten' : 'Neuer Mitreisender'}
        description={editingTraveler 
          ? 'Ändern Sie die Details des Mitreisenden' 
          : 'Erstellen Sie einen neuen Mitreisenden'}
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
        noPadding
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
            <div>
              <Label htmlFor="traveler-name">Name *</Label>
              <Input
                id="traveler-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Max Mustermann"
              />
            </div>
            {showAssignMeOption && (
              <div className="space-y-2 pt-4">
                <Label>Benutzer zuordnen</Label>
                <p className="text-xs text-muted-foreground">
                  Ordnen Sie Ihr Benutzerkonto diesem Mitreisenden zu, um Ihr Profil mit der Packliste zu verknüpfen.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setAssignMeConfirmOpen(true)}
                  disabled={isLoading}
                >
                  Mich diesem Mitreisenden zuordnen
                </Button>
              </div>
            )}
            {editingTraveler?.user_id && (
              <div className="space-y-2 pt-4">
                <Label>Benutzer-Rolle</Label>
                <p className="text-xs text-muted-foreground">
                  Die Rolle des zugeordneten Benutzers. Wird beim Speichern übernommen.
                </p>
                <Select
                  value={formUserRole}
                  onValueChange={(v) => {
                    setFormUserRole(v as UserRole)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {canAccessSystemAdmin && (
                      <SelectItem value="system_admin">System-Admin</SelectItem>
                    )}
                    <SelectItem value="admin">Admin (Haushalt)</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Haushalt</Label>
              <Select
                value={form.gruppeId}
                onValueChange={(v) => setForm({ ...form, gruppeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Haushalt wählen" />
                </SelectTrigger>
                <SelectContent>
                  {gruppenForSelect.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Gilt für alle Personen — auch ohne Benutzerkonto oder Einladung.
              </p>
            </div>
            <div>
              <Label>Personentyp</Label>
              <Select
                value={form.personentyp}
                onValueChange={(v) => {
                  const pt = v as Personentyp
                  setForm({ ...form, personentyp: pt })
                  if (pt === 'erwachsen') {
                    setFormBerechtigungen((prev) =>
                      prev.filter((p) => p === 'can_edit_pauschal_entries')
                    )
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="erwachsen">Erwachsen</SelectItem>
                  <SelectItem value="kind">Kind</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Steuert Pack-Verhalten (eigenes vs. Haushalts-Profil), unabhängig vom Login.
              </p>
            </div>
            <div>
              <Label htmlFor="traveler-farbe">Farbe</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {USER_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${
                      form.farbe === color.bg ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.bg }}
                    onClick={() => setForm({ ...form, farbe: color.bg })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
            {(form.personentyp === 'kind' ||
              (editingTraveler?.user_id && formUserRole === 'standard')) && (
              <div className="space-y-3 pt-4">
                <Label>Berechtigungen</Label>
                <p className="text-xs text-muted-foreground">
                  {form.personentyp === 'kind'
                    ? 'Einstellungen für Kinder (mit oder ohne eigenes Login).'
                    : 'Optionale Rechte für Standard-Nutzer.'}
                </p>
                <div className="space-y-2">
                  {(form.personentyp === 'kind'
                    ? BERECHTIGUNGEN_OPTIONS
                    : BERECHTIGUNGEN_OPTIONS.filter((o) => o.key === 'can_edit_pauschal_entries')
                  ).map((opt) => (
                    <div key={opt.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${opt.key}`}
                        checked={formBerechtigungen.includes(opt.key)}
                        onCheckedChange={(checked) => {
                          setFormBerechtigungen(prev =>
                            checked
                              ? [...prev, opt.key]
                              : prev.filter((k) => k !== opt.key)
                          )
                        }}
                      />
                      <label
                        htmlFor={`perm-${opt.key}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={editingTraveler ? handleUpdate : handleCreate}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingTraveler ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>

      {/* Einladung erstellen Modal */}
      <ResponsiveModal
        open={!!inviteTraveler}
        onOpenChange={(open) => !open && setInviteTraveler(null)}
        title="Einladung erstellen"
        description={`Einladungslink für ${inviteTraveler?.name ?? ''} erstellen`}
        contentClassName="max-w-lg"
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          {!inviteLink ? (
            <>
              <div>
                <Label>Nutzerrolle bei Einladung</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'standard')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="admin">Admin (Haushalt)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Personentyp „{personentypLabel(inviteTraveler?.personentyp)}“ am Mitreisenden steuert das Pack-Verhalten.
                </p>
              </div>
              {(inviteTraveler?.personentyp === 'kind' || inviteRole === 'standard') && (
                <div className="space-y-3 pt-4">
                  <Label>Berechtigungen</Label>
                  <p className="text-xs text-muted-foreground">
                    Gelten nach Annahme der Einladung.
                  </p>
                  <div className="space-y-2">
                    {(inviteTraveler?.personentyp === 'kind'
                      ? BERECHTIGUNGEN_OPTIONS
                      : BERECHTIGUNGEN_OPTIONS.filter((o) => o.key === 'can_edit_pauschal_entries')
                    ).map((opt) => (
                      <div key={opt.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`invite-perm-${opt.key}`}
                          checked={inviteBerechtigungen.includes(opt.key)}
                          onCheckedChange={(checked) => {
                            setInviteBerechtigungen(prev =>
                              checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key)
                            )
                          }}
                        />
                        <label htmlFor={`invite-perm-${opt.key}`} className="text-sm font-medium leading-none cursor-pointer">
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={handleCreateInvite} disabled={isLoading} className="w-full">
                {isLoading ? 'Wird erstellt...' : 'Einladung erstellen'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Teilen Sie diesen Link mit {inviteTraveler?.name}. Der Link ist zeitlich begrenzt gültig.
              </p>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyInviteLink} title="Link kopieren">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="secondary" onClick={() => setInviteTraveler(null)} className="w-full">
                Schließen
              </Button>
            </>
          )}
        </div>
      </ResponsiveModal>

      {/* Haushalt anlegen/bearbeiten */}
      <ResponsiveModal
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        title={editingGroup ? 'Haushalt bearbeiten' : 'Neuer Haushalt'}
        description={
          editingGroup
            ? 'Name und Urlaubs-Vorauswahl des Haushalts ändern'
            : 'Legen Sie einen weiteren Haushalt für Personen an'
        }
        contentClassName="max-w-lg"
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          <div>
            <Label htmlFor="group-name">Name *</Label>
            <Input
              id="group-name"
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              placeholder="z.B. Freunde, Nachbarn"
            />
          </div>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="group-urlaub-default"
              checked={groupForm.urlaubStandardMitnehmen}
              onCheckedChange={(checked) =>
                setGroupForm({ ...groupForm, urlaubStandardMitnehmen: checked === true })
              }
            />
            <div className="grid gap-1 leading-none">
              <label htmlFor="group-urlaub-default" className="text-sm font-medium cursor-pointer">
                Bei neuen Urlauben vorauswählen
              </label>
              <p className="text-xs text-muted-foreground">
                Personen dieses Haushalts werden standardmäßig neuen Urlauben zugeordnet (Stern-Symbol).
              </p>
            </div>
          </div>
          <Button onClick={handleSaveGroup} disabled={isLoading} className="w-full">
            {isLoading ? 'Wird gespeichert…' : editingGroup ? 'Speichern' : 'Haushalt erstellen'}
          </Button>
        </div>
      </ResponsiveModal>

      {/* Haushalt löschen */}
      <ConfirmDialog
        open={!!deleteGroupId}
        onOpenChange={(open) => !open && setDeleteGroupId(null)}
        title="Haushalt löschen"
        description="Möchten Sie diesen Haushalt wirklich löschen? Er darf keine zugeordneten Personen mehr enthalten."
        onConfirm={executeDeleteGroup}
        isLoading={isLoading}
      />

      {/* Mitreisender löschen – Bestätigung */}
      <ConfirmDialog
        open={!!deleteTravelerId}
        onOpenChange={(open) => !open && setDeleteTravelerId(null)}
        title="Mitreisenden löschen"
        description="Möchten Sie diesen Mitreisenden wirklich löschen? Dies entfernt ihn auch von allen Urlauben und Ausrüstungsgegenständen."
        onConfirm={executeDeleteTraveler}
        isLoading={isLoading}
      />

      {/* Passwort zurücksetzen – Sicherheitsabfrage */}
      <ConfirmDialog
        open={assignMeConfirmOpen}
        onOpenChange={(open) => !open && setAssignMeConfirmOpen(false)}
        title="Mitreisenden zuordnen?"
        description={
          editingTraveler
            ? `Ihr Benutzerkonto wird dauerhaft mit „${editingTraveler.name}“ verknüpft. Packprofil, Haushalt und Berechtigungen richten sich dann nach diesem Mitreisenden. Diese Zuordnung können Sie hier nicht wieder aufheben. Möchten Sie fortfahren?`
            : ''
        }
        confirmLabel="Zuordnen"
        cancelLabel="Abbrechen"
        loadingLabel="Wird zugeordnet…"
        onConfirm={handleAssignMe}
        isLoading={isLoading}
      />

      <ConfirmDialog
        open={!!resetPasswordConfirmTraveler}
        onOpenChange={(open) => !open && setResetPasswordConfirmTraveler(null)}
        title="Passwort zurücksetzen?"
        description={
          resetPasswordConfirmTraveler
            ? `Es wird ein neues temporäres Passwort für ${resetPasswordConfirmTraveler.name} (${resetPasswordConfirmTraveler.user_email ?? '–'}) erzeugt. Der Benutzer erhält es von Ihnen und muss sich damit anmelden sowie unter „Mein Profil“ → „Passwort ändern“ ein eigenes Passwort setzen. Möchten Sie das Passwort wirklich zurücksetzen?`
            : ''
        }
        confirmLabel="Passwort zurücksetzen"
        cancelLabel="Abbrechen"
        loadingLabel="Wird zurückgesetzt…"
        variant="default"
        onConfirm={async () => {
          if (resetPasswordConfirmTraveler) {
            await handleResetPassword(resetPasswordConfirmTraveler)
            setResetPasswordConfirmTraveler(null)
          }
        }}
        isLoading={resettingUserId != null}
      />

      {/* Passwort zurückgesetzt – temporäres Passwort anzeigen */}
      <Dialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Passwort zurückgesetzt</DialogTitle>
            <DialogDescription>
              Das temporäre Passwort für <strong>{resetResult?.email}</strong> wurde erstellt. Der
              Benutzer muss sich damit anmelden und unter „Mein Profil“ → „Passwort ändern“ ein
              neues Passwort setzen.
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-100 p-4 font-mono text-sm break-all select-all">
                {resetResult.temporaryPassword}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={copyResetPassword} variant="outline" className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  {copyFeedback ? 'Kopiert!' : 'Kopieren'}
                </Button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <Button onClick={shareResetPassword} variant="outline" className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Teilen
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
