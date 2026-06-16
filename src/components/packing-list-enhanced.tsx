'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MoreVertical, Edit2, Trash2, RotateCcw, CheckCheck, Check, Clock, ChevronRight } from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { PackingItem as DBPackingItem, type Mitreisender, type TransportVehicle } from "@/lib/db";
import { MarkAllConfirmationDialog, type TravelerForMarkAll } from "./mark-all-confirmation-dialog";
import { UndoToast } from "./undo-toast";
import { cn, getInitials } from "@/lib/utils";
import { TransportIcon } from "@/lib/transport-icons";
import {
  DEFAULT_USER_COLOR_BG,
  getMitreisenderBackgroundColor,
  USER_COLORS,
} from "@/lib/user-colors";
import { sortMitreisendeNachRolleUndName, sortMitreisendenZeilenNachStammdaten } from "@/lib/mitreisenden-sort";
import { buildPackProfileGroups } from '@/lib/pack-profile-groups';
import { PackProfileGroupOverviewList } from '@/components/pack-profile-person-groups';
import { PauschalGruppeBadge } from '@/components/pauschal-gruppe-badge';
import {
  PauschalGruppeAssignmentModal,
  type PauschalGruppenAssignmentPayload,
} from '@/components/pauschal-gruppe-assignment-modal';
import {
  getVacationGruppenMap,
  hasMultipleVacationGroups,
  isPauschalGruppenFeatureActive,
  passesPauschalGruppenFilter,
  canTogglePauschalForOwnGruppe,
  canToggleGruppeCheckbox,
  resolveActiveGruppeIdForPacking,
  isGruppeFullyPacked,
  areAllGruppenFullyPacked,
  getOwnGruppePackingState,
  resolveGruppeName,
  type PauschalGruppenFilter,
} from '@/lib/pauschal-gruppen';

type VisibleItemsFilterOpts = {
  listDisplayMode: 'alles' | 'packliste';
  abreiseDatum?: string | null;
  toYYYYMMDD: (d: string) => string;
  canEditPauschalEntries: boolean;
  vacationMitreisende: Mitreisender[];
  /** Im Modus „Alle“: nur Einträge dieser Personen (null = alle am Urlaub) */
  alleScopeIds?: Set<string> | null;
  pauschalGruppenFilter?: PauschalGruppenFilter;
  multiGroupActive?: boolean;
  ownGruppeId?: string | null;
};

function passesBaseVisibleFilters(
  item: DBPackingItem,
  opts: Pick<VisibleItemsFilterOpts, 'listDisplayMode' | 'abreiseDatum' | 'toYYYYMMDD'>
): boolean {
  const { listDisplayMode, abreiseDatum, toYYYYMMDD } = opts;
  if (listDisplayMode === 'packliste' && String(item.status || '').trim() === 'Immer gepackt') return false;
  const isErstAbreisetag = !!item.erst_abreisetag_gepackt;
  if (listDisplayMode === 'packliste' && isErstAbreisetag && abreiseDatum) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const abreiseStr = toYYYYMMDD(abreiseDatum);
    if (abreiseStr && todayStr !== abreiseStr) return false;
  }
  return true;
}

function filterVisibleItemsForProfile(
  items: DBPackingItem[],
  selectedProfile: string | null,
  opts: VisibleItemsFilterOpts
): DBPackingItem[] {
  const { canEditPauschalEntries, vacationMitreisende, alleScopeIds, pauschalGruppenFilter = 'alle', multiGroupActive = false, ownGruppeId = null } = opts;

  return items.filter(item => {
    if (!passesBaseVisibleFilters(item, opts)) return false;
    if (multiGroupActive && !passesPauschalGruppenFilter(item, pauschalGruppenFilter, ownGruppeId)) {
      return false;
    }

    if (!selectedProfile) {
      if (alleScopeIds === null || alleScopeIds === undefined) return true;
      if (item.mitreisenden_typ === 'pauschal') return canEditPauschalEntries;
      if (item.mitreisende?.length) {
        return item.mitreisende.some(m => alleScopeIds.has(m.mitreisender_id));
      }
      if (item.mitreisenden_typ === 'alle') return alleScopeIds.size > 0;
      return false;
    }
    if (item.mitreisenden_typ === 'pauschal') {
      return canEditPauschalEntries;
    }
    const personAssigned = item.mitreisende?.some(m => m.mitreisender_id === selectedProfile);
    if (personAssigned) return true;
    if (item.mitreisenden_typ === 'alle' && (!item.mitreisende || item.mitreisende.length === 0)) {
      if (vacationMitreisende.length === 0) return true;
      return vacationMitreisende.some(m => m.id === selectedProfile);
    }
    return false;
  });
}

/** Nur personenbezogene Einträge (ohne Pauschal) für eine Person im Profil */
function filterPersonAssignedItems(
  profileVisible: DBPackingItem[],
  personId: string
): DBPackingItem[] {
  return profileVisible.filter(
    item =>
      item.mitreisenden_typ !== 'pauschal' &&
      item.mitreisende?.some(m => m.mitreisender_id === personId)
  );
}

function isItemFullyPackedForProfile(
  item: DBPackingItem,
  selectedProfile: string | null,
  canConfirmVorgemerkt: boolean,
  ownGruppeId?: string | null,
  multiGroupActive?: boolean,
  pauschalGruppenFilter?: PauschalGruppenFilter,
  alleScopeIds?: Set<string> | null
): boolean {
  if (item.mitreisenden_typ === 'pauschal') {
    const modus = item.pauschal_gruppen_modus ?? 'einmal';
    if (multiGroupActive && (modus === 'pro_gruppe' || modus === 'ausgewaehlte_gruppen')) {
      if (pauschalGruppenFilter === 'eigene' && ownGruppeId) {
        const own = getOwnGruppePackingState(item, ownGruppeId);
        if (!own) return false;
        return isGruppeFullyPacked(own, canConfirmVorgemerkt);
      }
      return areAllGruppenFullyPacked(item, canConfirmVorgemerkt);
    }
    if (canConfirmVorgemerkt) return item.gepackt;
    return item.gepackt || !!item.gepackt_vorgemerkt;
  }
  if (selectedProfile) {
    const m = item.mitreisende?.find(t => t.mitreisender_id === selectedProfile);
    if (!m) return true;
    return canConfirmVorgemerkt ? m.gepackt : (m.gepackt || !!m.gepackt_vorgemerkt);
  }
  if (item.mitreisende?.length) {
    const relevant = alleScopeIds
      ? item.mitreisende.filter((m) => alleScopeIds.has(m.mitreisender_id))
      : item.mitreisende;
    if (relevant.length === 0) return true;
    return relevant.every((m) =>
      canConfirmVorgemerkt ? m.gepackt : (m.gepackt || !!m.gepackt_vorgemerkt)
    );
  }
  if (item.mitreisenden_typ === 'alle') return false;
  return true;
}

interface PackingItemProps {
  id: string;
  was: string;
  anzahl: number;
  gepackt: boolean;
  gepackt_vorgemerkt?: boolean;
  mitreisende?: Array<{ mitreisender_id: string; mitreisender_name: string; gepackt: boolean; gepackt_vorgemerkt?: boolean; anzahl?: number }>;
  bemerkung?: string | null;
  transport_name?: string | null;
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte';
  onToggle: (id: string) => void;
  /** Explizites Setzen des Gepackt-Status (für Undo bei Pauschal – vermeidet Stale-Closure) */
  onSetPacked?: (id: string, gepackt: boolean) => void;
  onToggleMitreisender: (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => void;
  onEdit: (item: DBPackingItem) => void;
  /** id + optional forMitreisenderId (nur diesen Mitreisenden entfernen) */
  onDelete: (id: string, forMitreisenderId?: string | null) => void;
  /** Admin: vorgemerkte Einträge bestätigen (Checkbox-Klick) */
  onConfirmVorgemerkt?: (packingItemId: string, mitreisenderId?: string) => void;
  /** Admin: Vormerkung entfernen (Drei-Punkte-Menü) */
  onRemoveVorgemerkt?: (packingItemId: string, mitreisenderId?: string) => void;
  canConfirmVorgemerkt?: boolean;
  canEditPauschalEntries?: boolean;
  details?: string;
  fullItem: DBPackingItem;
  selectedProfile: string | null;
  hidePackedItems: boolean;
  vacationMitreisende?: Mitreisender[];
  /** Eigene Reisegruppe – im Modus „Alle“ nur deren Haken an Einträgen anzeigen */
  ownGroupMitreisende?: Mitreisender[];
  transportVehicles?: TransportVehicle[];
  onMarkAllConfirm?: (selectedTravelerIds: string[]) => void;
  onShowToast?: (itemName: string, travelerName: string | undefined, undoAction: () => void) => void;
  isTemporaer?: boolean;
  /** true: „x/y Personen“-Button mit Popup; false: Personen inline mit Kürzel + Checkbox */
  showPersonStatusAsPopover?: boolean;
  multiGroupActive?: boolean;
  ownGruppeId?: string | null;
  isAdmin?: boolean;
  gruppenMap?: Map<string, string>;
  vacationGroups?: ReturnType<typeof buildPackProfileGroups>;
  onOpenAssignment?: (item: DBPackingItem) => void;
  onToggleGruppe?: (packingItemId: string, gruppeId: string, currentStatus: boolean) => void;
  pauschalGruppenFilter?: PauschalGruppenFilter;
}

const PackingItem: React.FC<PackingItemProps> = ({
  id,
  was,
  anzahl,
  gepackt,
  gepackt_vorgemerkt,
  bemerkung,
  transport_name: _transport_name,
  mitreisenden_typ,
  mitreisende,
  onToggle,
  onSetPacked,
  onToggleMitreisender,
  onEdit,
  onDelete,
  onConfirmVorgemerkt,
  onRemoveVorgemerkt,
  canConfirmVorgemerkt,
  canEditPauschalEntries = false,
  details,
  fullItem,
  selectedProfile,
  hidePackedItems,
  vacationMitreisende = [],
  ownGroupMitreisende = [],
  transportVehicles = [],
  onMarkAllConfirm,
  onShowToast,
  isTemporaer = false,
  showPersonStatusAsPopover = true,
  multiGroupActive = false,
  ownGruppeId = null,
  isAdmin = false,
  gruppenMap = new Map(),
  vacationGroups,
  onOpenAssignment,
  onToggleGruppe,
  pauschalGruppenFilter = 'alle',
}) => {
  const [showMarkAllDialog, setShowMarkAllDialog] = useState(false);
  const [personListPopoverOpen, setPersonListPopoverOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [hasExited, setHasExited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const previousShouldHideRef = useRef<boolean | 'init'>('init');

  // Sanftes Hervorheben, wenn sich der Status dieser Zeile ändert (eigene Aktion oder Remote-Sync).
  const statusSignature = useMemo(() => {
    const mit = (mitreisende ?? [])
      .map((m) => `${m.mitreisender_id}:${m.gepackt ? 1 : 0}:${m.gepackt_vorgemerkt ? 1 : 0}:${m.anzahl ?? ''}`)
      .sort()
      .join('|');
    const grup = (fullItem.gruppen ?? [])
      .map((g) => `${g.gruppe_id}:${g.gepackt ? 1 : 0}:${g.gepackt_vorgemerkt ? 1 : 0}`)
      .sort()
      .join('|');
    return `${gepackt ? 1 : 0}:${gepackt_vorgemerkt ? 1 : 0}:${anzahl}:${mit}:${grup}`;
  }, [gepackt, gepackt_vorgemerkt, anzahl, mitreisende, fullItem.gruppen]);
  const prevStatusSignatureRef = useRef<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  useEffect(() => {
    if (prevStatusSignatureRef.current === null) {
      prevStatusSignatureRef.current = statusSignature;
      return;
    }
    if (prevStatusSignatureRef.current === statusSignature) return;
    prevStatusSignatureRef.current = statusSignature;
    setJustUpdated(true);
    const t = setTimeout(() => setJustUpdated(false), 1100);
    return () => clearTimeout(t);
  }, [statusSignature]);

  const effectivePacked = (g: boolean, v?: boolean) => g || !!v;

  const pauschalModus = fullItem.pauschal_gruppen_modus ?? 'einmal';
  const usesGruppenCheckboxes =
    multiGroupActive &&
    mitreisenden_typ === 'pauschal' &&
    (pauschalModus === 'pro_gruppe' || pauschalModus === 'ausgewaehlte_gruppen');
  const ownGruppeEntry = useMemo(
    () => getOwnGruppePackingState(fullItem, ownGruppeId ?? null),
    [fullItem, ownGruppeId]
  );
  const activeGruppeId = useMemo(
    () => resolveActiveGruppeIdForPacking(selectedProfile, vacationMitreisende, ownGruppeId ?? null),
    [selectedProfile, vacationMitreisende, ownGruppeId]
  );
  const activeGruppeEntry = useMemo(
    () => getOwnGruppePackingState(fullItem, activeGruppeId),
    [fullItem, activeGruppeId]
  );
  const toggleGruppeId = selectedProfile ? activeGruppeId : ownGruppeId;
  const toggleGruppeEntry = selectedProfile ? activeGruppeEntry : ownGruppeEntry;
  const allGruppenFullyPacked = useMemo(
    () => areAllGruppenFullyPacked(fullItem, !!canConfirmVorgemerkt),
    [fullItem, canConfirmVorgemerkt]
  );
  const ownGruppeFullyPacked = useMemo(() => {
    return ownGruppeEntry ? isGruppeFullyPacked(ownGruppeEntry, !!canConfirmVorgemerkt) : false
  }, [ownGruppeEntry, canConfirmVorgemerkt]);
  const activeGruppeFullyPacked = useMemo(() => {
    return activeGruppeEntry ? isGruppeFullyPacked(activeGruppeEntry, !!canConfirmVorgemerkt) : false
  }, [activeGruppeEntry, canConfirmVorgemerkt]);
  const showGruppenCheckboxesRow = usesGruppenCheckboxes && pauschalGruppenFilter === 'alle';
  const mainGruppenCheckboxChecked = selectedProfile
    ? activeGruppeFullyPacked
    : pauschalGruppenFilter === 'eigene'
      ? ownGruppeFullyPacked
      : allGruppenFullyPacked;
  const ownGruppeVorgemerkt = !!toggleGruppeEntry?.gepackt_vorgemerkt && !toggleGruppeEntry?.gepackt;
  const canToggleOwnGruppeMain =
    !!toggleGruppeId &&
    !!toggleGruppeEntry &&
    canEditPauschalEntries &&
    canToggleGruppeCheckbox(toggleGruppeId, ownGruppeId, isAdmin);

  type MitreisendeRow = NonNullable<typeof mitreisende>[number];

  /** Im Modus „Alle“: nur Personen der eigenen Gruppe in der Zeilen-UI */
  const mitreisendeRowsForUi = useMemo((): MitreisendeRow[] => {
    if (selectedProfile !== null) return mitreisende ?? [];
    const ownIds = new Set(ownGroupMitreisende.map((m) => m.id));
    const base = mitreisende ?? [];
    if (base.length === 0 && mitreisenden_typ === 'alle' && ownGroupMitreisende.length > 0) {
      return ownGroupMitreisende.map((m) => ({
        mitreisender_id: m.id,
        mitreisender_name: m.name,
        gepackt: false,
      }));
    }
    return base.filter((m) => ownIds.has(m.mitreisender_id));
  }, [selectedProfile, mitreisende, mitreisenden_typ, ownGroupMitreisende]);

  /** Scope-Zeilen für „Alles abhaken“-Dialog (voller Packprofil-Scope) */
  const mitreisendeRowsForScope = useMemo((): MitreisendeRow[] => {
    const base = mitreisende ?? [];
    if (base.length === 0 && mitreisenden_typ === 'alle' && vacationMitreisende.length > 0) {
      return vacationMitreisende.map((m) => ({
        mitreisender_id: m.id,
        mitreisender_name: m.name,
        gepackt: false,
      }));
    }
    const scopeIds = new Set(vacationMitreisende.map((m) => m.id));
    return base.filter((m) => scopeIds.has(m.mitreisender_id));
  }, [mitreisende, mitreisenden_typ, vacationMitreisende]);

  const isFullyPacked = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') {
      if (usesGruppenCheckboxes) {
        if (selectedProfile) return activeGruppeFullyPacked;
        return pauschalGruppenFilter === 'eigene' ? ownGruppeFullyPacked : allGruppenFullyPacked;
      }
      return effectivePacked(gepackt, gepackt_vorgemerkt);
    }
    const rows = selectedProfile === null ? mitreisendeRowsForUi : (mitreisende ?? []);
    return rows.length > 0 && rows.every((m) => effectivePacked(m.gepackt, m.gepackt_vorgemerkt));
  }, [
    mitreisenden_typ,
    gepackt,
    gepackt_vorgemerkt,
    mitreisende,
    selectedProfile,
    mitreisendeRowsForUi,
    usesGruppenCheckboxes,
    pauschalGruppenFilter,
    ownGruppeFullyPacked,
    allGruppenFullyPacked,
    activeGruppeFullyPacked,
    fullItem,
  ]);

  /** Nur final gepackt (gepackt=true), nicht vorgemerkt – für Eltern bei „Gepacktes ausblenden“ */
  const isFullyPackedFinal = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') {
      if (usesGruppenCheckboxes) {
        if (selectedProfile) return !!activeGruppeEntry?.gepackt;
        if (pauschalGruppenFilter === 'eigene') return !!ownGruppeEntry?.gepackt;
        return (fullItem.gruppen ?? []).length > 0 && (fullItem.gruppen ?? []).every((g) => g.gepackt);
      }
      return gepackt;
    }
    const rows = selectedProfile === null ? mitreisendeRowsForUi : (mitreisende ?? []);
    return rows.length > 0 && rows.every((m) => m.gepackt);
  }, [
    mitreisenden_typ,
    gepackt,
    mitreisende,
    selectedProfile,
    mitreisendeRowsForUi,
    usesGruppenCheckboxes,
    pauschalGruppenFilter,
    ownGruppeEntry,
    activeGruppeEntry,
    fullItem.gruppen,
  ]);

  const isScopeFullyPackedFinal = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') {
      if (usesGruppenCheckboxes) return (fullItem.gruppen ?? []).every((g) => g.gepackt);
      return gepackt;
    }
    return mitreisendeRowsForScope.length > 0 && mitreisendeRowsForScope.every((m) => m.gepackt);
  }, [mitreisenden_typ, gepackt, mitreisendeRowsForScope, usesGruppenCheckboxes, fullItem.gruppen]);

  // Calculate packed count for individual items (gepackt OR vorgemerkt zählt als gepackt für Anzeige)
  const packedCount = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return effectivePacked(gepackt, gepackt_vorgemerkt) ? 1 : 0;
    const rows = selectedProfile === null ? mitreisendeRowsForUi : (mitreisende ?? []);
    return rows.filter((m) => effectivePacked(m.gepackt, m.gepackt_vorgemerkt)).length;
  }, [mitreisenden_typ, gepackt, gepackt_vorgemerkt, mitreisende, selectedProfile, mitreisendeRowsForUi]);

  /** Nur final gepackt – für Admin-Anzeige x/4 Personen */
  const packedCountFinal = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return gepackt ? 1 : 0;
    const rows = selectedProfile === null ? mitreisendeRowsForUi : (mitreisende ?? []);
    return rows.filter((m) => m.gepackt).length;
  }, [mitreisenden_typ, gepackt, mitreisende, selectedProfile, mitreisendeRowsForUi]);

  /** Namen der Mitreisenden mit Vormerkung – für Admin-Anzeige "(Prüfen: …)" */
  const vorgemerktNames = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return [];
    const rows = selectedProfile === null ? mitreisendeRowsForUi : (mitreisende ?? []);
    return rows
      .filter((m) => !!m.gepackt_vorgemerkt && !m.gepackt)
      .map((m) => m.mitreisender_name);
  }, [mitreisenden_typ, mitreisende, selectedProfile, mitreisendeRowsForUi]);

  const totalCount = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return 1;
    const rows = selectedProfile === null ? mitreisendeRowsForUi : (mitreisende ?? []);
    return rows.length;
  }, [mitreisenden_typ, mitreisende, selectedProfile, mitreisendeRowsForUi]);

  /** Reihenfolge „Admin → Kind → …“ wie in Packprofil-Sidebar (Stammdaten aus Urlaub) */
  const mitreisendeFuerPopover = useMemo(() => {
    const list = selectedProfile === null ? mitreisendeRowsForUi : (mitreisende ?? []);
    if (!list.length) return list;
    const order = sortMitreisendenZeilenNachStammdaten(
      list.map((m) => ({ id: m.mitreisender_id, name: m.mitreisender_name })),
      ownGroupMitreisende.length > 0 ? ownGroupMitreisende : vacationMitreisende
    ).map((r) => r.id);
    const byId = new Map(list.map((m) => [m.mitreisender_id, m]));
    const ordered = order.map((tid) => byId.get(tid)).filter(Boolean) as typeof list;
    return ordered.length > 0 ? ordered : list;
  }, [mitreisende, selectedProfile, mitreisendeRowsForUi, ownGroupMitreisende, vacationMitreisende]);

  // Determine if checkbox should be enabled
  const canTogglePauschal =
    mitreisenden_typ === 'pauschal' &&
    !usesGruppenCheckboxes &&
    canEditPauschalEntries &&
    canTogglePauschalForOwnGruppe(fullItem, ownGruppeId, isAdmin);

  // Get selected traveler's item
  const selectedTravelerItem = useMemo(() => {
    if (!selectedProfile || !mitreisende) return null;
    return mitreisende.find(m => m.mitreisender_id === selectedProfile);
  }, [selectedProfile, mitreisende]);

  /** Transport-Icons: im Personen-Profil ein Icon, im Alle-Profil ggf. mehrere unterschiedliche */
  const displayTransports = useMemo((): TransportVehicle[] => {
    const byId = (transportId: string | null | undefined): TransportVehicle | null => {
      if (!transportId) return null
      return transportVehicles.find((tv) => tv.id === transportId) ?? null
    }

    if (selectedProfile !== null) {
      const person = fullItem.mitreisende?.find((m) => m.mitreisender_id === selectedProfile)
      const tv = byId(person?.transport_id ?? fullItem.transport_id)
      return tv ? [tv] : []
    }

    const mainId = fullItem.transport_id ?? null
    const personTransportIds = (fullItem.mitreisende ?? [])
      .map((m) => m.transport_id ?? mainId)
      .filter((id): id is string => !!id)
    const others = [...new Set(personTransportIds.filter((id) => id !== mainId))]
    const icons: TransportVehicle[] = []
    const mainTv = byId(mainId)
    if (mainTv) icons.push(mainTv)
    for (const id of others) {
      const tv = byId(id)
      if (tv) icons.push(tv)
    }
    if (icons.length === 0 && personTransportIds.length > 0) {
      return [...new Set(personTransportIds)]
        .map((id) => byId(id))
        .filter((tv): tv is TransportVehicle => tv != null)
    }
    return icons
  }, [fullItem, selectedProfile, transportVehicles]);

  /** Gepackt für Transparenz-Anzeige (opacity-60): Admin nur bei final gepackt, sonst auch vorgemerkt */
  const isPackedForOpacity = useMemo(() => {
    if (canConfirmVorgemerkt) {
      if (mitreisenden_typ === 'pauschal') {
        if (usesGruppenCheckboxes) {
          if (selectedProfile) return !!activeGruppeEntry?.gepackt;
          return pauschalGruppenFilter === 'eigene' ? !!ownGruppeEntry?.gepackt : (fullItem.gruppen ?? []).every((g) => g.gepackt);
        }
        return gepackt;
      }
      if (selectedProfile) return selectedTravelerItem ? !!selectedTravelerItem.gepackt : false;
      return isFullyPackedFinal;
    }
    if (mitreisenden_typ === 'pauschal') {
      if (usesGruppenCheckboxes) {
        if (selectedProfile) return activeGruppeFullyPacked;
        return pauschalGruppenFilter === 'eigene' ? ownGruppeFullyPacked : allGruppenFullyPacked;
      }
      return effectivePacked(gepackt, gepackt_vorgemerkt);
    }
    if (selectedProfile) return selectedTravelerItem ? effectivePacked(selectedTravelerItem.gepackt, selectedTravelerItem.gepackt_vorgemerkt) : false;
    return isFullyPacked;
  }, [
    canConfirmVorgemerkt,
    mitreisenden_typ,
    gepackt,
    gepackt_vorgemerkt,
    selectedProfile,
    selectedTravelerItem,
    isFullyPacked,
    isFullyPackedFinal,
    usesGruppenCheckboxes,
    pauschalGruppenFilter,
    ownGruppeEntry,
    activeGruppeEntry,
    ownGruppeFullyPacked,
    activeGruppeFullyPacked,
    allGruppenFullyPacked,
    fullItem.gruppen,
  ]);

  // Check if item should be hidden in individual profile view
  const shouldHideInProfileView = useMemo(() => {
    if (!hidePackedItems) return false;
    if (selectedProfile) {
      if (mitreisenden_typ === 'pauschal') {
        if (usesGruppenCheckboxes) {
          if (canConfirmVorgemerkt) {
            return !!activeGruppeEntry?.gepackt;
          }
          return activeGruppeFullyPacked;
        }
        return canConfirmVorgemerkt ? gepackt : effectivePacked(gepackt, gepackt_vorgemerkt);
      }
      // Mitreisender-Einträge: Eltern nur final gepackt ausblenden
      const packed = selectedTravelerItem
        ? (canConfirmVorgemerkt ? selectedTravelerItem.gepackt : effectivePacked(selectedTravelerItem.gepackt, selectedTravelerItem.gepackt_vorgemerkt))
        : false;
      return packed;
    }
    // Zentral/Alle: Eltern nur bei isFullyPackedFinal ausblenden
    return canConfirmVorgemerkt ? isFullyPackedFinal : isFullyPacked;
  }, [
    hidePackedItems,
    selectedProfile,
    selectedTravelerItem,
    mitreisenden_typ,
    gepackt,
    gepackt_vorgemerkt,
    canConfirmVorgemerkt,
    isFullyPacked,
    isFullyPackedFinal,
    usesGruppenCheckboxes,
    pauschalGruppenFilter,
    ownGruppeEntry,
    activeGruppeEntry,
    ownGruppeFullyPacked,
    activeGruppeFullyPacked,
    allGruppenFullyPacked,
    fullItem.gruppen,
  ]);

  // Micro-Animation nur beim Abhaken (Übergang sichtbar → ausblenden), nicht beim Tab-Wechsel (bereits ausgeblendet)
  useEffect(() => {
    if (previousShouldHideRef.current === 'init') {
      const hide = !!shouldHideInProfileView && hidePackedItems;
      previousShouldHideRef.current = !!shouldHideInProfileView;
      if (hide) setHasExited(true);
      return undefined;
    }
    if (shouldHideInProfileView && hidePackedItems) {
      const wasVisible = !previousShouldHideRef.current;
      previousShouldHideRef.current = true;
      if (wasVisible) {
        setIsExiting(true);
        const t = setTimeout(() => setHasExited(true), 280);
        return () => clearTimeout(t);
      }
      setHasExited(true);
      return undefined;
    }
    previousShouldHideRef.current = !!shouldHideInProfileView;
    setIsExiting(false);
    setHasExited(false);
    return undefined;
  }, [shouldHideInProfileView, hidePackedItems]);

  const handleGruppenMainToggle = () => {
    if (!onToggleGruppe || !toggleGruppeId || !toggleGruppeEntry || !canToggleOwnGruppeMain) return;
    const currentEffective = canConfirmVorgemerkt
      ? toggleGruppeEntry.gepackt
      : toggleGruppeEntry.gepackt || !!toggleGruppeEntry.gepackt_vorgemerkt;
    const wasUnpacked = !currentEffective;
    const itemId = id;
    const gruppeId = toggleGruppeId;
    onToggleGruppe(id, toggleGruppeId, currentEffective);
    if (hidePackedItems && wasUnpacked && onShowToast) {
      const gruppeName = resolveGruppeName(
        gruppeId,
        gruppenMap,
        toggleGruppeEntry.gruppe_name
      );
      const undoAction = () => {
        onToggleGruppe(itemId, gruppeId, true);
      };
      onShowToast(was, gruppeName, undoAction);
    }
  };

  // Handle pauschal toggle
  const handlePauschalToggle = () => {
    if (!canTogglePauschal) return;
    if (isVorgemerktPauschal && canConfirmVorgemerkt && onConfirmVorgemerkt) {
      onConfirmVorgemerkt(id);
      return;
    }
    const wasUnpacked = !gepackt;
    const itemId = id;
    onToggle(itemId);
    if (hidePackedItems && wasUnpacked && onShowToast) {
      const undoAction = () => {
        if (onSetPacked) {
          onSetPacked(itemId, false);
        } else {
          setTimeout(() => onToggle(itemId), 0);
        }
      };
      onShowToast(was, undefined, undoAction);
    }
  };

  const isVorgemerktPauschal = !!gepackt_vorgemerkt && !gepackt;
  const selectedTravelerVorgemerkt = selectedTravelerItem ? (!!selectedTravelerItem.gepackt_vorgemerkt && !selectedTravelerItem.gepackt) : false;

  // Handle individual toggle (for selected profile)
  const handleIndividualToggle = () => {
    if (selectedProfile) {
      if (selectedTravelerVorgemerkt && canConfirmVorgemerkt && onConfirmVorgemerkt) {
        onConfirmVorgemerkt(id, selectedProfile);
        return;
      }
      const currentEffective = selectedTravelerItem ? effectivePacked(selectedTravelerItem.gepackt, selectedTravelerItem.gepackt_vorgemerkt) : false;
      const wasUnpacked = !currentEffective;
      const itemId = id;
      const profileId = selectedProfile;
      const currentStatus = currentEffective;
      onToggleMitreisender(itemId, profileId, currentStatus);
      if (hidePackedItems && wasUnpacked && onShowToast) {
        const undoAction = () => {
          onToggleMitreisender(itemId, profileId, true)
        }
        onShowToast(was, selectedTravelerItem?.mitreisender_name, undoAction)
      }
    }
  };

  // Handle "mark all" or "unmark all" toggle (for Zentral/Alle mode)
  const handleMarkAllToggle = () => {
    if (selectedProfile === null && mitreisenden_typ !== 'pauschal' && travelersForMarkAll.length > 0) {
      setShowMarkAllDialog(true);
    }
  };

  const confirmMarkAll = (selectedTravelerIds: string[]) => {
    if (onMarkAllConfirm) {
      onMarkAllConfirm(selectedTravelerIds);
    }
    setShowMarkAllDialog(false);
  };

  const personInitialsContext = useMemo(
    () => mitreisendeFuerPopover.map((m) => m.mitreisender_name),
    [mitreisendeFuerPopover]
  );

  const renderPersonListPopoverContent = () => (
    <>
      <div className="px-3 pt-3 pb-0 bg-muted/30">
        <p className="text-xs font-semibold text-foreground">Gepackt pro Person</p>
      </div>
      <ul className="max-h-48 overflow-y-auto py-1 pt-4">
        {mitreisendeFuerPopover.map((m) => {
          const packed = canConfirmVorgemerkt ? m.gepackt : (m.gepackt || !!m.gepackt_vorgemerkt);
          const vorgemerkt = !!m.gepackt_vorgemerkt && !m.gepackt;
          const canConfirmThis = vorgemerkt && canConfirmVorgemerkt && onConfirmVorgemerkt;
          return (
            <li
              key={m.mitreisender_id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm",
                canConfirmThis && "cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
              )}
              onClick={canConfirmThis ? () => { onConfirmVorgemerkt(id, m.mitreisender_id); } : undefined}
              role={canConfirmThis ? "button" : undefined}
            >
              <Checkbox
                checked={packed || vorgemerkt}
                disabled
                className={cn(
                  "h-4 w-4 min-h-4 min-w-4 rounded-md border-2 border-gray-300 shrink-0 cursor-default",
                  packed && "data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]",
                  vorgemerkt && !packed && "data-[state=checked]:bg-[rgb(230,126,34)] data-[state=checked]:border-[rgb(230,126,34)]"
                )}
                aria-hidden
              />
              <span className={cn(
                "truncate",
                packed && "text-muted-foreground",
                vorgemerkt && "text-amber-700"
              )}>
                {m.mitreisender_name}
              </span>
              {vorgemerkt && canConfirmVorgemerkt && (
                <span className="text-xs text-amber-600 ml-auto shrink-0">Klicken zum Abhaken</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );

  const travelersForMarkAll: TravelerForMarkAll[] = useMemo(() => {
    let list = mitreisendeRowsForScope;
    let rows: TravelerForMarkAll[];
    if (isScopeFullyPackedFinal) {
      rows = list
        .filter((m) => m.gepackt)
        .map((m) => ({
          id: m.mitreisender_id,
          name: m.mitreisender_name,
          isCurrentlyPacked: true,
        }));
    } else {
      rows = list
        .filter((m) => !m.gepackt)
        .map((m) => ({
          id: m.mitreisender_id,
          name: m.mitreisender_name,
          isCurrentlyPacked: false,
        }));
    }
    return sortMitreisendenZeilenNachStammdaten(rows, vacationMitreisende);
  }, [mitreisendeRowsForScope, vacationMitreisende, isScopeFullyPackedFinal]);

  // Hide if packed – nach Exit-Animation
  if (hasExited) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "p-4 mb-3 bg-card rounded-xl border border-subtle dark:border-white/10 shadow-sm transition-all duration-200 overflow-hidden",
          isExiting && "animate-pack-item-out",
          !isExiting && justUpdated && "animate-pack-item-update",
          !isExiting && (isPackedForOpacity ? 'opacity-60' : 'hover:shadow-md')
        )}
      >
        <div className="flex items-start space-x-3">
          {/* Checkbox logic based on mode - feste Größe mit flex-shrink-0 */}
          {mitreisenden_typ === 'pauschal' && !usesGruppenCheckboxes && (
            <div className="mt-0.5 flex-shrink-0">
              <Checkbox
                id={`item-${id}`}
                checked={effectivePacked(gepackt, gepackt_vorgemerkt)}
                onCheckedChange={handlePauschalToggle}
                className={cn(
                  "h-6 w-6 min-h-6 min-w-6 rounded-md border-2 border-gray-300",
                  isVorgemerktPauschal
                    ? "data-[state=checked]:bg-[rgb(230,126,34)] data-[state=checked]:border-[rgb(230,126,34)]"
                    : "data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
                )}
              />
            </div>
          )}

          {mitreisenden_typ === 'pauschal' && usesGruppenCheckboxes && (
            <div className="mt-0.5 flex-shrink-0">
              <Checkbox
                id={`item-${id}`}
                checked={mainGruppenCheckboxChecked}
                disabled={!canToggleOwnGruppeMain}
                onCheckedChange={handleGruppenMainToggle}
                className={cn(
                  "h-6 w-6 min-h-6 min-w-6 rounded-md border-2 border-gray-300",
                  pauschalGruppenFilter === 'eigene' && ownGruppeVorgemerkt
                    ? "data-[state=checked]:bg-[rgb(230,126,34)] data-[state=checked]:border-[rgb(230,126,34)]"
                    : "data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
                )}
              />
            </div>
          )}
          
          {mitreisenden_typ !== 'pauschal' && selectedProfile !== null && (
            <div className="mt-0.5 flex-shrink-0">
              <Checkbox
                id={`item-${id}`}
                checked={selectedTravelerItem ? effectivePacked(selectedTravelerItem.gepackt, selectedTravelerItem.gepackt_vorgemerkt) : false}
                onCheckedChange={handleIndividualToggle}
                className={cn(
                  "h-6 w-6 min-h-6 min-w-6 rounded-md border-2 border-gray-300",
                  selectedTravelerVorgemerkt
                    ? "data-[state=checked]:bg-[rgb(230,126,34)] data-[state=checked]:border-[rgb(230,126,34)]"
                    : "data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
                )}
              />
            </div>
          )}

          {mitreisenden_typ !== 'pauschal' && selectedProfile === null && (
            <div className="mt-0.5 flex-shrink-0">
              <Checkbox
                id={`item-${id}`}
                checked={isFullyPackedFinal}
                onCheckedChange={handleMarkAllToggle}
                className="h-6 w-6 min-h-6 min-w-6 rounded-md border-2 border-gray-300 data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
              />
            </div>
          )}
          
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <label
                htmlFor={`item-${id}`}
                className={cn(
                  "text-sm font-medium leading-none cursor-pointer transition-colors",
                  (selectedProfile === null && mitreisenden_typ !== 'pauschal' ? isFullyPackedFinal : isFullyPacked)
                    ? 'line-through text-muted-foreground'
                    : 'text-foreground'
                )}
              >
                {was}{' '}
                {(() => {
                  // Ermittele die anzuzeigende Anzahl:
                  //  - Person-Profil: persönliche anzahl (Fallback auf pe.anzahl)
                  //  - Alle-Profil & Pauschal: pe.anzahl
                  //  - Alle-Profil & Mehrpersonen-Eintrag: keine Anzeige
                  //    (die Zahl wäre entweder ein Default oder eine Summe und in
                  //     beiden Fällen in dieser Sicht irreführend).
                  if (!selectedProfile && mitreisenden_typ !== 'pauschal') return ''
                  const anzahlZuZeigen = selectedProfile && selectedTravelerItem?.anzahl != null
                    ? selectedTravelerItem.anzahl
                    : anzahl
                  return anzahlZuZeigen > 1 ? `(${anzahlZuZeigen}x)` : ''
                })()}
              </label>
              {isTemporaer && (
                <span
                  className="flex-shrink-0 text-muted-foreground"
                  title="Nur für diese Packliste"
                  aria-label="Nur für diese Packliste"
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                </span>
              )}
              {multiGroupActive && mitreisenden_typ === 'pauschal' && canEditPauschalEntries && (
                <PauschalGruppeBadge
                  item={fullItem}
                  gruppenMap={gruppenMap}
                  ownGruppeId={ownGruppeId}
                  expandAllGroups={pauschalGruppenFilter === 'alle'}
                  onClick={onOpenAssignment ? () => onOpenAssignment(fullItem) : undefined}
                />
              )}
            </div>
            
            {details && <p className="text-xs text-muted-foreground mt-1.5">{details}</p>}
            {bemerkung && <p className="text-xs text-accent mt-1.5">📝 {bemerkung}</p>}

            {showGruppenCheckboxesRow && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(fullItem.gruppen ?? []).map((g) => {
                  const packed = canConfirmVorgemerkt
                    ? g.gepackt
                    : g.gepackt || !!g.gepackt_vorgemerkt;
                  const vorgemerkt = !!g.gepackt_vorgemerkt && !g.gepackt;
                  const name = resolveGruppeName(g.gruppe_id, gruppenMap, g.gruppe_name);
                  const short = name.slice(0, 3);
                  return (
                    <span
                      key={g.gruppe_id}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]',
                        g.gruppe_id === ownGruppeId ? 'border-[rgb(45,79,30)]/50 bg-[rgb(45,79,30)]/5' : 'border-subtle'
                      )}
                    >
                      <Checkbox
                        checked={packed || vorgemerkt}
                        disabled
                        className={cn(
                          'h-3.5 w-3.5 min-h-3.5 min-w-3.5 cursor-default',
                          vorgemerkt
                            ? 'data-[state=checked]:bg-[rgb(230,126,34)] data-[state=checked]:border-[rgb(230,126,34)]'
                            : 'data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]'
                        )}
                      />
                      <span>{short}</span>
                    </span>
                  );
                })}
              </div>
            )}
            
            {/* Status indicator based on mode */}
            {mitreisenden_typ !== 'pauschal' && (
              <div className="mt-1.5">
                {selectedProfile !== null && selectedTravelerItem && (
                  <span className="text-xs text-muted-foreground">
                    Für {selectedTravelerItem.mitreisender_name}
                  </span>
                )}
                {selectedProfile === null && mitreisendeRowsForUi.length > 0 && (
                  <Popover open={personListPopoverOpen} onOpenChange={setPersonListPopoverOpen}>
                    {showPersonStatusAsPopover ? (
                      <>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="text-xs text-accent font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-1 -mx-1"
                          >
                            {canConfirmVorgemerkt ? packedCountFinal : packedCount}/{totalCount} Personen
                            {canConfirmVorgemerkt && vorgemerktNames.length > 0 && (
                              <> (Prüfen: {vorgemerktNames.join(', ')})</>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          {renderPersonListPopoverContent()}
                        </PopoverContent>
                      </>
                    ) : (
                      <>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex flex-wrap items-center gap-x-1 gap-y-1 text-left rounded px-0.5 -mx-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            aria-label="Gepackt-Status pro Person anzeigen"
                          >
                            {mitreisendeFuerPopover.map((m) => {
                              const packed = canConfirmVorgemerkt ? m.gepackt : (m.gepackt || !!m.gepackt_vorgemerkt);
                              const vorgemerkt = !!m.gepackt_vorgemerkt && !m.gepackt;
                              const initials = getInitials(m.mitreisender_name, personInitialsContext);
                              return (
                                <span
                                  key={m.mitreisender_id}
                                  className="inline-flex items-center gap-1 w-10 shrink-0"
                                  title={m.mitreisender_name}
                                >
                                  <span
                                    className={cn(
                                      "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2 border-gray-300",
                                      (packed || vorgemerkt) &&
                                        (vorgemerkt
                                          ? "border-[rgb(230,126,34)] bg-[rgb(230,126,34)] text-white"
                                          : "border-[rgb(45,79,30)] bg-[rgb(45,79,30)] text-white")
                                    )}
                                    aria-hidden
                                  >
                                    {(packed || vorgemerkt) && (
                                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                    )}
                                  </span>
                                  <span className="text-[10px] font-semibold leading-none text-left shrink-0 text-muted-foreground">
                                    {initials}
                                  </span>
                                </span>
                              );
                            })}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          {renderPersonListPopoverContent()}
                        </PopoverContent>
                      </>
                    )}
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Transport-Icons und Three-dot menu */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {displayTransports.length > 0 && (
              <span className="inline-flex items-center gap-0.5 px-0.5">
                {displayTransports.map((tv) => (
                  <TransportIcon
                    key={tv.id}
                    icon={tv.icon}
                    name={tv.name}
                  />
                ))}
              </span>
            )}
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/10"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canConfirmVorgemerkt && onRemoveVorgemerkt && (isVorgemerktPauschal || selectedTravelerVorgemerkt) && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false)
                    onRemoveVorgemerkt(id, selectedTravelerVorgemerkt ? selectedProfile ?? undefined : undefined)
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Vormerkung entfernen
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => {
                  setMenuOpen(false)
                  onEdit(fullItem)
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Bearbeiten
              </DropdownMenuItem>
              {!(selectedProfile && mitreisenden_typ === 'pauschal' && !isTemporaer && !canEditPauschalEntries) && (
                <DropdownMenuItem 
                  onSelect={() => {
                    setMenuOpen(false)
                    onDelete(id, selectedProfile)
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mark All Confirmation Dialog */}
      {travelersForMarkAll.length > 0 && (
        <MarkAllConfirmationDialog
          isOpen={showMarkAllDialog}
          onClose={() => setShowMarkAllDialog(false)}
          onConfirm={confirmMarkAll}
          _itemName={was}
          travelers={travelersForMarkAll}
          isUnmarkMode={isFullyPackedFinal}
        />
      )}
    </>
  );
};

interface PackingListProps {
  items: DBPackingItem[];
  onToggle: (id: string) => void;
  onSetPacked?: (id: string, gepackt: boolean) => void;
  onToggleMitreisender: (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => void;
  onToggleMultipleMitreisende: (packingItemId: string, updates: Array<{ mitreisenderId: string; newStatus: boolean }>) => void;
  onEdit: (item: DBPackingItem) => void;
  /** id + optional mitreisenderId: bei Profil-Ansicht nur diesen Mitreisenden entfernen */
  onDelete: (id: string, forMitreisenderId?: string | null) => void;
  onConfirmVorgemerkt?: (packingItemId: string, mitreisenderId?: string) => void;
  onRemoveVorgemerkt?: (packingItemId: string, mitreisenderId?: string) => void;
  canConfirmVorgemerkt?: boolean;
  canEditPauschalEntries?: boolean;
  isChildView?: boolean;
  selectedProfile: string | null;
  hidePackedItems: boolean;
  listDisplayMode: 'alles' | 'packliste';
  onOpenSettings: () => void;
  vacationMitreisende?: Mitreisender[];
  transportVehicles?: TransportVehicle[];
  /** Im Packprofil sichtbare Mitreisende (Berechtigungen) – für Schwellwert Inline vs. Popup */
  visiblePackProfileMitreisende?: Mitreisender[];
  /** Eigene Reisegruppe – für gruppierte Personen-Übersicht */
  ownGruppeId?: string | null;
  /** Scope für Modus „Zentral / Alle“ (Admin: alle am Urlaub) */
  packProfileScopeMitreisende?: Mitreisender[];
  /** Farbe des gewählten Packprofils (Mitreisender) für Fortschrittsbalken „nur eigene“ */
  selectedProfileColor?: string | null;
  /** Urlaubs-Abreisedatum (abfahrtdatum ?? startdatum) – für erst_abreisetag_gepackt im Packliste-Modus */
  abreiseDatum?: string | null;
  /** Callback wenn sich die sichtbare Kategorie ändert (für Add-Dialog-Scroll) */
  onScrollContextChange?: (ctx: { mainCategory: string; category: string } | null) => void;
  /** Admin: andere Packprofile wählbar – bei „alles gepackt“ im Profil ggf. Team-Übersicht */
  canSelectOtherProfiles?: boolean;
  /** Wechsel in ein anderes Packprofil (z. B. aus Team-Übersicht) */
  onProfileChange?: (profileId: string) => void;
  /** Aktive Hauptkategorie (vom Parent gesteuert – bleibt über Reconnect erhalten) */
  activeMainCategory?: string;
  onActiveMainCategoryChange?: (mainCategory: string) => void;
  pauschalGruppenFilter?: PauschalGruppenFilter;
  onPauschalGruppenFilterChange?: (filter: PauschalGruppenFilter) => void;
  onSetPauschalGruppen?: (packingItemId: string, payload: PauschalGruppenAssignmentPayload) => void;
  onToggleGruppe?: (packingItemId: string, gruppeId: string, currentStatus: boolean) => void;
  isAdmin?: boolean;
}

export function PackingList({
  items,
  onToggle,
  onSetPacked,
  onToggleMitreisender,
  onToggleMultipleMitreisende,
  onEdit,
  onDelete,
  onConfirmVorgemerkt,
  onRemoveVorgemerkt,
  canConfirmVorgemerkt,
  canEditPauschalEntries = false,
  isChildView: _isChildView = false,
  selectedProfile,
  hidePackedItems,
  listDisplayMode,
  onOpenSettings: _onOpenSettings,
  vacationMitreisende = [],
  visiblePackProfileMitreisende,
  ownGruppeId = null,
  packProfileScopeMitreisende,
  transportVehicles = [],
  selectedProfileColor = null,
  abreiseDatum,
  onScrollContextChange,
  canSelectOtherProfiles = false,
  onProfileChange,
  activeMainCategory: activeMainCategoryProp,
  onActiveMainCategoryChange,
  pauschalGruppenFilter = 'alle',
  onPauschalGruppenFilterChange,
  onSetPauschalGruppen,
  onToggleGruppe,
  isAdmin = false,
}: PackingListProps) {
  const [assignmentItemId, setAssignmentItemId] = useState<string | null>(null);
  const assignmentItem = useMemo(
    () => (assignmentItemId ? items.find((i) => i.id === assignmentItemId) ?? null : null),
    [assignmentItemId, items]
  );
  const [undoToast, setUndoToast] = useState<{ visible: boolean; itemName: string; action: () => void } | null>(null);
  const [internalActiveMainCategory, setInternalActiveMainCategory] = useState('');
  const activeMainCategory =
    activeMainCategoryProp !== undefined ? activeMainCategoryProp : internalActiveMainCategory;
  const setActiveMainCategory = useCallback(
    (category: string) => {
      if (onActiveMainCategoryChange) onActiveMainCategoryChange(category);
      else setInternalActiveMainCategory(category);
    },
    [onActiveMainCategoryChange]
  );
  const [firstVisibleCategory, setFirstVisibleCategory] = useState<string>('');
  const [tabsScrollbarVisible, setTabsScrollbarVisible] = useState(false);
  const [tabSwipeDirection, setTabSwipeDirection] = useState<'left' | 'right' | null>(null);
  /** Im Packprofil einer Person mit Berechtigung Pauschal: Umschaltung Fortschritt „alle berechtigten“ vs. „nur eigene“. Kein Button – Klick auf Balken. */
  const [progressBarMode, setProgressBarMode] = useState<'all' | 'own'>('all');
  const tabsScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const categoryRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const contentTouchStart = useRef<{ x: number; y: number } | null>(null);

  const profileGroups = useMemo(
    () => buildPackProfileGroups(vacationMitreisende, ownGruppeId),
    [vacationMitreisende, ownGruppeId]
  );
  const multiGroupActive = useMemo(
    () => hasMultipleVacationGroups(vacationMitreisende),
    [vacationMitreisende]
  );
  const gruppenMap = useMemo(
    () => getVacationGruppenMap(vacationMitreisende),
    [vacationMitreisende]
  );
  const vacationGroupsForSheet = useMemo(() => {
    const groups: Array<{ id: string; name: string; members: Mitreisender[] }> = [];
    if (profileGroups.ownGroup.length > 0 && ownGruppeId) {
      groups.push({ id: ownGruppeId, name: gruppenMap.get(ownGruppeId) ?? 'Meine Gruppe', members: profileGroups.ownGroup });
    }
    for (const g of profileGroups.otherGroups) {
      groups.push(g);
    }
    return groups;
  }, [profileGroups, ownGruppeId, gruppenMap]);
  const unassignedPauschalItems = useMemo(
    () => (multiGroupActive ? items.filter((i) => isPauschalGruppenFeatureActive(i, vacationMitreisende) && (i.pauschal_gruppen_modus ?? 'einmal') === 'offen') : []),
    [items, multiGroupActive, vacationMitreisende]
  );

  const ownGroupMitreisende = profileGroups.ownGroup;

  /** Inline-Haken vs. „x/y Personen“-Popup: Schwellwert nach eigener Gruppe (Modus „Alle“) */
  const showPersonStatusAsPopover = ownGroupMitreisende.length > 4;

  const effectiveScopeMitreisende = useMemo(
    () =>
      selectedProfile === null
        ? (packProfileScopeMitreisende ?? vacationMitreisende)
        : vacationMitreisende,
    [selectedProfile, packProfileScopeMitreisende, vacationMitreisende]
  );

  const alleScopeIds = useMemo((): Set<string> | null | undefined => {
    if (selectedProfile !== null) return undefined;
    if (!packProfileScopeMitreisende) return null;
    if (
      packProfileScopeMitreisende.length >= vacationMitreisende.length &&
      vacationMitreisende.length > 0
    ) {
      return null;
    }
    return new Set(packProfileScopeMitreisende.map((m) => m.id));
  }, [selectedProfile, packProfileScopeMitreisende, vacationMitreisende]);

  useEffect(() => {
    return () => {
      if (tabsScrollTimeoutRef.current) clearTimeout(tabsScrollTimeoutRef.current);
    };
  }, []);

  // Beim Wechsel des Packprofils Fortschritts-Modus auf „alle berechtigten“ zurücksetzen
  useEffect(() => {
    setProgressBarMode('all');
  }, [selectedProfile]);

  // Datum zu YYYY-MM-DD normalisieren (ISO, DE DD.MM.YYYY, etc.)
  const toYYYYMMDD = useMemo(() => {
    return (d: string): string => {
      if (!d) return '';
      const s = String(d).trim();
      const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
      if (iso) return iso[0]!;
      const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
      if (de) return `${de[3]!}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`;
      const parsed = new Date(s);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
      return '';
    };
  }, []);

  const visibleItemsFilterOpts = useMemo((): VisibleItemsFilterOpts => ({
    listDisplayMode,
    abreiseDatum,
    toYYYYMMDD,
    canEditPauschalEntries,
    vacationMitreisende: effectiveScopeMitreisende,
    alleScopeIds,
    pauschalGruppenFilter,
    multiGroupActive,
    ownGruppeId,
  }), [listDisplayMode, abreiseDatum, toYYYYMMDD, canEditPauschalEntries, effectiveScopeMitreisende, alleScopeIds, pauschalGruppenFilter, multiGroupActive, ownGruppeId]);

  const visibleItems = useMemo(
    () => filterVisibleItemsForProfile(items, selectedProfile, visibleItemsFilterOpts),
    [items, selectedProfile, visibleItemsFilterOpts]
  );

  // Group items by main category and category (nur sichtbare)
  const itemsByMainCategory = useMemo(() => {
    const grouped: Record<string, Record<string, DBPackingItem[]>> = {};
    visibleItems.forEach(item => {
      const mainCat = item.hauptkategorie ?? 'Sonstiges';
      const cat = item.kategorie ?? 'Allgemein';
      if (!grouped[mainCat]) {
        grouped[mainCat] = {};
      }
      if (!grouped[mainCat][cat]) {
        grouped[mainCat][cat] = [];
      }
      grouped[mainCat][cat].push(item);
    });
    return grouped;
  }, [visibleItems]);

  const mainCategories = Object.keys(itemsByMainCategory);

  // Erste Hauptkategorie nur setzen, wenn noch keine gewählt (Parent speichert Auswahl)
  useEffect(() => {
    if (activeMainCategoryProp !== undefined) return;
    if (mainCategories.length > 0 && !internalActiveMainCategory) {
      const first = mainCategories[0];
      if (first) setInternalActiveMainCategory(first);
    }
  }, [mainCategories, internalActiveMainCategory, activeMainCategoryProp]);

  // Für Admin (canConfirmVorgemerkt): Nur verifiziert (gepackt) zählt im Fortschritt; Kind/Gast: vorgemerkt zählt mit.
  const countedAsPacked = useCallback(
    (gepackt: boolean, vorgemerkt?: boolean) =>
      canConfirmVorgemerkt ? gepackt : gepackt || !!vorgemerkt,
    [canConfirmVorgemerkt]
  );
  // Fortschritt: Im Packprofil einer Person nur Einträge, die der Person zugeordnet sind; im Alle-Profil alle sichtbaren.
  const { packedCount, totalCount } = useMemo(() => {
    return visibleItems.reduce((acc, item) => {
      if (item.mitreisenden_typ === 'pauschal') {
        if (!selectedProfile) {
          const modus = item.pauschal_gruppen_modus ?? 'einmal';
          if (multiGroupActive && (modus === 'pro_gruppe' || modus === 'ausgewaehlte_gruppen')) {
            const gruppen = item.gruppen ?? [];
            acc.totalCount += gruppen.length;
            acc.packedCount += gruppen.filter((g) => countedAsPacked(g.gepackt, g.gepackt_vorgemerkt)).length;
          } else {
            acc.totalCount += 1;
            if (countedAsPacked(item.gepackt, item.gepackt_vorgemerkt)) acc.packedCount += 1;
          }
        }
      } else if (item.mitreisende) {
        if (selectedProfile) {
          const mine = item.mitreisende.find(m => m.mitreisender_id === selectedProfile);
          if (mine) {
            acc.totalCount += 1;
            if (countedAsPacked(mine.gepackt, mine.gepackt_vorgemerkt)) acc.packedCount += 1;
          }
        } else {
          const scopeSet = alleScopeIds;
          const relevant = scopeSet
            ? item.mitreisende.filter((m) => scopeSet.has(m.mitreisender_id))
            : item.mitreisende;
          acc.totalCount += relevant.length;
          acc.packedCount += relevant.filter(m => countedAsPacked(m.gepackt, m.gepackt_vorgemerkt)).length;
        }
      }
      return acc;
    }, { packedCount: 0, totalCount: 0 });
  }, [visibleItems, selectedProfile, countedAsPacked, alleScopeIds, multiGroupActive]);

  // IntersectionObserver: erste sichtbare Kategorie im aktiven Tab ermitteln
  useEffect(() => {
    if (!onScrollContextChange || !activeMainCategory) return;
    const cats = Object.keys(itemsByMainCategory[activeMainCategory] ?? {});
    if (cats.length === 0) {
      onScrollContextChange({ mainCategory: activeMainCategory, category: '' });
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter(e => e.isIntersecting).map(e => e.target as HTMLElement).filter(el => el.dataset.category);
        if (intersecting.length === 0) return;
        const topmost = intersecting.reduce((a, b) => 
          a.getBoundingClientRect().top < b.getBoundingClientRect().top ? a : b
        );
        const cat = topmost.dataset.category;
        if (cat) setFirstVisibleCategory(cat);
      },
      { root: null, rootMargin: '-20px 0px -60% 0px', threshold: 0 }
    );
    const order = cats;
    for (const c of order) {
      const el = categoryRefsMap.current.get(`${activeMainCategory}::${c}`);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [activeMainCategory, itemsByMainCategory, onScrollContextChange]);

  // Scroll-Kontext an Parent melden
  useEffect(() => {
    if (!onScrollContextChange) return;
    const cat = firstVisibleCategory || (activeMainCategory ? Object.keys(itemsByMainCategory[activeMainCategory] ?? {})[0] : '') || '';
    onScrollContextChange(activeMainCategory ? { mainCategory: activeMainCategory, category: cat } : null);
  }, [activeMainCategory, firstVisibleCategory, itemsByMainCategory, onScrollContextChange]);

  // Handle mark all or unmark all for an item (nur für die ausgewählten Mitreisenden)
  const handleMarkAllForItem = (item: DBPackingItem, selectedTravelerIds: string[]) => {
    if (selectedTravelerIds.length === 0) return;

    let mitreisendeToProcess = item.mitreisende || [];
    if (mitreisendeToProcess.length === 0 && item.mitreisenden_typ === 'alle' && effectiveScopeMitreisende.length > 0) {
      mitreisendeToProcess = effectiveScopeMitreisende.map(m => ({
        mitreisender_id: m.id,
        mitreisender_name: m.name,
        gepackt: false
      }));
    }

    const allPacked = mitreisendeToProcess.every(m => m.gepackt);

    const updates: Array<{ mitreisenderId: string; newStatus: boolean }> = [];
    const travelerNames: string[] = [];

    selectedTravelerIds.forEach(id => {
      const m = mitreisendeToProcess.find(t => t.mitreisender_id === id);
      if (!m) return;
      const newStatus = !allPacked; // mark or unmark
      updates.push({ mitreisenderId: id, newStatus });
      travelerNames.push(m.mitreisender_name);
    });

    if (updates.length === 0) return;

    onToggleMultipleMitreisende(item.id, updates);

    if (hidePackedItems && travelerNames.length > 0) {
      const itemId = item.id;
      setUndoToast({
        visible: true,
        itemName: `${item.was} (${travelerNames.join(', ')})`,
        action: () => {
          const undoUpdates = updates.map((u) => ({ ...u, newStatus: !u.newStatus }))
          onToggleMultipleMitreisende(itemId, undoUpdates)
        },
      });
    }
  };

  const showToast = (itemName: string, travelerName: string | undefined, undoAction: () => void) => {
    const displayName = travelerName ? `${itemName} (${travelerName})` : itemName;
    setUndoToast({
      visible: true,
      itemName: displayName,
      action: undoAction
    });
  };

  const isItemFullyPackedForView = useCallback(
    (item: DBPackingItem) =>
      isItemFullyPackedForProfile(
        item,
        selectedProfile,
        !!canConfirmVorgemerkt,
        ownGruppeId,
        multiGroupActive,
        pauschalGruppenFilter,
        alleScopeIds
      ),
    [selectedProfile, canConfirmVorgemerkt, ownGruppeId, multiGroupActive, pauschalGruppenFilter, alleScopeIds]
  );

  const sortedProfileMitreisende = useMemo(
    () => sortMitreisendeNachRolleUndName(visiblePackProfileMitreisende ?? vacationMitreisende),
    [visiblePackProfileMitreisende, vacationMitreisende]
  );

  const travelerNames = useMemo(
    () => sortedProfileMitreisende.map(m => m.name),
    [sortedProfileMitreisende]
  );

  const statusMitreisende = useMemo(() => {
    if (!canSelectOtherProfiles) {
      return sortedProfileMitreisende;
    }
    const scoped = packProfileScopeMitreisende ?? vacationMitreisende;
    const isFullVacationScope =
      scoped.length >= vacationMitreisende.length && vacationMitreisende.length > 0;
    return sortMitreisendeNachRolleUndName(isFullVacationScope ? vacationMitreisende : scoped);
  }, [
    canSelectOtherProfiles,
    sortedProfileMitreisende,
    packProfileScopeMitreisende,
    vacationMitreisende,
  ]);

  const personPackStatuses = useMemo(() => {
    const isAdmin = !!canConfirmVorgemerkt;
    return statusMitreisende.map(person => {
      const profileVisible = filterVisibleItemsForProfile(items, person.id, visibleItemsFilterOpts);
      const personItems = filterPersonAssignedItems(profileVisible, person.id);
      let packed = 0;
      let pendingConfirmation = 0;
      let open = 0;
      for (const item of personItems) {
        const m = item.mitreisende?.find(t => t.mitreisender_id === person.id);
        if (!m) continue;
        if (isAdmin) {
          if (m.gepackt) packed += 1;
          else if (m.gepackt_vorgemerkt) pendingConfirmation += 1;
          else open += 1;
        } else if (m.gepackt || m.gepackt_vorgemerkt) {
          packed += 1;
        } else {
          open += 1;
        }
      }
      const total = personItems.length;
      const allPacked = total === 0 || (open === 0 && pendingConfirmation === 0);
      return { person, allPacked, packed, pendingConfirmation, open, total };
    });
  }, [statusMitreisende, items, visibleItemsFilterOpts, canConfirmVorgemerkt]);

  const personStatusById = useMemo(
    () => new Map(personPackStatuses.map((s) => [s.person.id, s])),
    [personPackStatuses]
  );

  const renderTeamOverviewRow = (
    person: Mitreisender,
    index: number,
    opts: { isCurrent: boolean; subdued: boolean }
  ) => {
    const status = personStatusById.get(person.id);
    if (!status) return null;
    const { allPacked, packed, pendingConfirmation, total } = status;
    const preset = person.farbe ? USER_COLORS.find((c) => c.bg === person.farbe) : null;
    const avatarStyle = person.farbe
      ? { backgroundColor: person.farbe, color: preset?.fg ?? '#ffffff' }
      : {
          backgroundColor: USER_COLORS[index % USER_COLORS.length]!.bg,
          color: USER_COLORS[index % USER_COLORS.length]!.fg,
        };
    const rowContent = (
      <>
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
            opts.subdued && 'opacity-80'
          )}
          style={avatarStyle}
        >
          {getInitials(person.name, travelerNames)}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-medium text-foreground truncate">
            {person.name}
            {opts.isCurrent && (
              <span className="text-xs font-normal text-muted-foreground ml-1">(aktiv)</span>
            )}
          </div>
          <div
            className={cn(
              'text-xs flex items-center gap-1 mt-0.5',
              allPacked ? 'text-brand-heading' : 'text-[#e67e22]'
            )}
          >
            {allPacked ? (
              <>
                <CheckCheck className="h-3.5 w-3.5 flex-shrink-0" />
                Alles gepackt
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {total > 0 ? `${packed} von ${total} erledigt` : 'Noch offen'}
                  {pendingConfirmation > 0 && (
                    <>
                      {total > 0 ? ' · ' : ''}
                      {pendingConfirmation === 1
                        ? '1 zu kontrollieren'
                        : `${pendingConfirmation} zu kontrollieren`}
                    </>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
        {!allPacked && onProfileChange && (
          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
        )}
      </>
    );
    if (!allPacked && onProfileChange) {
      return (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onProfileChange(person.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border-2 border-subtle hover:border-[rgb(45,79,30)]/40 hover:bg-[rgb(45,79,30)]/5 transition-colors',
              opts.subdued && 'opacity-90'
            )}
          >
            {rowContent}
          </button>
        </li>
      );
    }
    return (
      <li
        key={person.id}
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border-2 border-subtle bg-muted/20',
          opts.subdued && 'opacity-90'
        )}
      >
        {rowContent}
      </li>
    );
  };

  const allPersonsFullyPacked = personPackStatuses.every(s => s.allPacked);

  // Fortschritt „alle sichtbaren Einträge“ (jeder sichtbare Eintrag zählt 1) – für Packprofil einer Person inkl. Pauschal
  const progressForAllVisible = useMemo(() => ({
    total: visibleItems.length,
    packed: visibleItems.filter(item => isItemFullyPackedForView(item)).length
  }), [visibleItems, isItemFullyPackedForView]);

  // Fortschritt „nur eigene Einträge“ (nur der Person zugeordnet, ohne Pauschal) – für Packprofil einer Person. Kind: vorgemerkt zählt; Admin: nur verifiziert.
  const progressForOwnOnly = useMemo(() => {
    const ownItems = visibleItems.filter(item =>
      item.mitreisenden_typ !== 'pauschal' && item.mitreisende?.some(m => m.mitreisender_id === selectedProfile)
    );
    const packed = ownItems.filter(item => {
      const m = item.mitreisende?.find(t => t.mitreisender_id === selectedProfile);
      return m ? countedAsPacked(m.gepackt, m.gepackt_vorgemerkt) : false;
    }).length;
    return { total: ownItems.length, packed };
  }, [visibleItems, selectedProfile, countedAsPacked]);

  // Anzeige Fortschrittsbalken: Packprofil „Alle“ = alle sichtbaren; Packprofil Person mit Pauschal-Berechtigung = umschaltbar (alle / nur eigene); sonst nur eigene.
  const displayProgress = !selectedProfile
    ? { packed: packedCount, total: totalCount }
    : canEditPauschalEntries
      ? (progressBarMode === 'all' ? progressForAllVisible : progressForOwnOnly)
      : progressForOwnOnly;
  const displayProgressPercentage = displayProgress.total > 0 ? Math.round((displayProgress.packed / displayProgress.total) * 100) : 0;

  const sortedPackProfileMitreisende = useMemo(
    () =>
      sortMitreisendeNachRolleUndName(
        visiblePackProfileMitreisende ?? vacationMitreisende
      ),
    [visiblePackProfileMitreisende, vacationMitreisende]
  )

  const activeProfileColor = useMemo(() => {
    if (!selectedProfile) return null
    const index = sortedPackProfileMitreisende.findIndex(
      (m) => m.id === selectedProfile
    )
    const person =
      index >= 0 ? sortedPackProfileMitreisende[index] : undefined
    if (person) {
      return getMitreisenderBackgroundColor(person, index >= 0 ? index : 0)
    }
    if (selectedProfileColor) {
      return getMitreisenderBackgroundColor({ farbe: selectedProfileColor }, 0)
    }
    return null
  }, [
    selectedProfile,
    sortedPackProfileMitreisende,
    selectedProfileColor,
  ])

  /** Markengrün standardmäßig; Personenfarbe nur im Modus „nur eigene Einträge“ (Klick auf Balken). */
  const progressBarColor =
    selectedProfile &&
    canEditPauschalEntries &&
    progressBarMode === 'own'
      ? (activeProfileColor ?? DEFAULT_USER_COLOR_BG)
      : 'rgb(45,79,30)'

  const isProgressBarClickable = !!(selectedProfile && canEditPauschalEntries);

  const hasItems = visibleItems.length > 0;
  const allPackedFromCurrentView = hasItems && visibleItems.every(item => isItemFullyPackedForView(item));
  const showTeamPackOverview = allPackedFromCurrentView && hidePackedItems && canSelectOtherProfiles && !allPersonsFullyPacked;
  const showAllPackedCelebration = allPackedFromCurrentView && hidePackedItems && (!canSelectOtherProfiles || allPersonsFullyPacked);
  const currentProfileName = selectedProfile
    ? vacationMitreisende.find(m => m.id === selectedProfile)?.name
    : null;
  const visibleMainCategories = useMemo(() => {
    if (!hidePackedItems) return mainCategories;
    return mainCategories.filter(mainCat => {
      const cats = itemsByMainCategory[mainCat] ?? {};
      const allItems = Object.values(cats).flat();
      return allItems.some(item => !isItemFullyPackedForView(item));
    });
  }, [mainCategories, itemsByMainCategory, hidePackedItems, isItemFullyPackedForView]);

  // Aktive Tab nur korrigieren wenn die aktuelle Hauptkategorie wirklich nicht mehr sichtbar ist
  const visibleMainCategoriesKey = visibleMainCategories.join('\u0001');
  const lastTabCorrectionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (visibleMainCategories.length === 0) return;
    if (
      activeMainCategory &&
      visibleMainCategories.includes(activeMainCategory)
    ) {
      lastTabCorrectionKeyRef.current = null;
      return;
    }
    const preferredFirst =
      mainCategories.find((cat) => visibleMainCategories.includes(cat)) ??
      visibleMainCategories[0]!
    const next = preferredFirst;
    const correctionKey = `${visibleMainCategoriesKey}\u0001${next}\u0001${activeMainCategory ?? ''}`;
    if (lastTabCorrectionKeyRef.current === correctionKey) return;
    lastTabCorrectionKeyRef.current = correctionKey;
    setActiveMainCategory(next);
  }, [
    visibleMainCategoriesKey,
    activeMainCategory,
    visibleMainCategories,
    mainCategories,
    setActiveMainCategory,
  ]);

  // Kategorien anzeigen: wenn hidePackedItems, nur wenn mind. ein Eintrag ungepackt
  const shouldShowCategory = (categoryItems: DBPackingItem[]) => {
    if (!hidePackedItems) return true;
    return categoryItems.some(item => !isItemFullyPackedForView(item));
  };

  const tabsForSwipe = (allPackedFromCurrentView && hidePackedItems)
    ? []
    : (hidePackedItems ? visibleMainCategories : mainCategories);

  const handleTabSwipe = (direction: 'left' | 'right') => {
    if (tabsForSwipe.length === 0) return;
    const idx = tabsForSwipe.indexOf(activeMainCategory);
    if (idx < 0) return;
    if (direction === 'left' && idx < tabsForSwipe.length - 1) {
      setTabSwipeDirection('left');
      setActiveMainCategory(tabsForSwipe[idx + 1]!);
    } else if (direction === 'right' && idx > 0) {
      setTabSwipeDirection('right');
      setActiveMainCategory(tabsForSwipe[idx - 1]!);
    }
  };

  // Swipe-Microanimation zurücksetzen nach Ende der Animation
  useEffect(() => {
    if (tabSwipeDirection === null) return;
    const t = setTimeout(() => setTabSwipeDirection(null), 240);
    return () => clearTimeout(t);
  }, [tabSwipeDirection, activeMainCategory]);

  // Tab-Leiste zum aktiven Tab scrollen (nur den Tab-Container, nicht die ganze Seite)
  useEffect(() => {
    let rafId: number | null = null;
    if (tabsForSwipe.length > 0) {
      const scrollEl = tabsScrollContainerRef.current;
      const activeTrigger = scrollEl?.querySelector<HTMLElement>('[data-state="active"]');
      if (scrollEl && activeTrigger) {
        rafId = requestAnimationFrame(() => {
          const container = scrollEl;
          const trigger = activeTrigger;
          const triggerLeft = trigger.offsetLeft;
          const triggerWidth = trigger.offsetWidth;
          const containerWidth = container.clientWidth;
          const maxScroll = container.scrollWidth - containerWidth;
          // Tab sichtbar machen: Trigger möglichst zentriert, ohne die Seite zu scrollen
          const targetScroll = Math.max(0, Math.min(maxScroll, triggerLeft - containerWidth / 2 + triggerWidth / 2));
          container.scrollTo({ left: targetScroll, behavior: 'smooth' });
        });
      }
    }
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [activeMainCategory, tabsForSwipe.length]);

  return (
    <Tabs value={activeMainCategory} onValueChange={setActiveMainCategory} className="flex flex-col flex-1 min-h-0 min-w-0 w-full max-w-full">
      {/* Sticky-Bereich: Progress + Tabs – scrollt nie. Schatten liegt nun sicher über dem Inhalt. */}
      <div className="flex-shrink-0 bg-card shadow relative z-10">
        <div className="px-4 bg-card">
          {/* Progress Bar */}
          {displayProgress.total > 0 && (
            <div className="space-y-2 bg-card px-1">
              <div className="flex items-center gap-2">
                <div
                  role={isProgressBarClickable ? 'button' : undefined}
                  tabIndex={isProgressBarClickable ? 0 : undefined}
                  onClick={isProgressBarClickable ? () => setProgressBarMode(m => m === 'all' ? 'own' : 'all') : undefined}
                  onKeyDown={isProgressBarClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProgressBarMode(m => m === 'all' ? 'own' : 'all'); } } : undefined}
                  className={cn(
                    "flex-1 min-w-0 h-2.5 bg-muted rounded-full overflow-hidden",
                    isProgressBarClickable && "cursor-pointer focus:outline-none focus:ring-0 focus:ring-offset-0 rounded-full"
                  )}
                  title={isProgressBarClickable ? (progressBarMode === 'all' ? 'Klicken: Fortschritt nur eigene Einträge' : 'Klicken: Fortschritt alle berechtigten Einträge') : undefined}
                  aria-label={isProgressBarClickable ? (progressBarMode === 'all' ? 'Fortschritt umschalten auf nur eigene Einträge' : 'Fortschritt umschalten auf alle berechtigten Einträge') : undefined}
                >
                  <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{
                      width: `${displayProgressPercentage}%`,
                      backgroundColor: progressBarColor,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                  {displayProgressPercentage}%
                </span>
              </div>
            </div>
          )}
        </div>
        <div
          ref={tabsScrollContainerRef}
          className={cn(
            "tabs-scrollbar-auto bg-card overflow-x-auto overflow-y-hidden -mx-4 sm:-mx-6 pl-4 pr-4 sm:pl-6 sm:pr-6 pb-2",
            tabsScrollbarVisible && "tabs-scrollbar-visible"
          )}
          style={{ WebkitOverflowScrolling: 'touch' }}
          onScroll={() => {
            setTabsScrollbarVisible(true);
            if (tabsScrollTimeoutRef.current) clearTimeout(tabsScrollTimeoutRef.current);
            tabsScrollTimeoutRef.current = setTimeout(() => {
              setTabsScrollbarVisible(false);
              tabsScrollTimeoutRef.current = null;
            }, 800);
          }}
        >
          <TabsList className="inline-flex w-max justify-start bg-transparent p-0 h-auto rounded-none">
            {tabsForSwipe.map(mainCat => (
              <TabsTrigger
                key={mainCat}
                value={mainCat}
                className="flex-shrink-0 uppercase text-xs font-semibold tracking-wide px-6 py-3 rounded-none border-b-4 border-transparent data-[state=active]:border-[#e67e22] data-[state=active]:text-brand-heading data-[state=inactive]:text-[rgb(168,162,158)] dark:data-[state=inactive]:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors relative data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-[50px] data-[state=active]:after:h-1 data-[state=active]:after:bg-[#e67e22] data-[state=active]:after:rounded-full data-[state=active]:border-b-transparent data-[state=active]:shadow-none"
              >
                {mainCat}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      {/* Scrollbarer Bereich: Inhalt oder "Alles gepackt"-Ansicht – Wischgeste wechselt Tab */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-clip"
        onTouchStart={(e) => {
          const t = e.targetTouches[0];
          if (t) contentTouchStart.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = contentTouchStart.current;
          contentTouchStart.current = null;
          if (!start) return;
          const t = e.changedTouches[0];
          if (!t) return;
          const deltaX = start.x - t.clientX;
          const deltaY = start.y - t.clientY;
          const minSwipe = 50;
          if (Math.abs(deltaX) >= minSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) handleTabSwipe('left');
            else handleTabSwipe('right');
          }
        }}
      >
        <div
          className={cn(
            "min-h-full bg-scroll-pattern px-4 sm:px-6 pt-6 pb-6",
            tabSwipeDirection === 'left' && "animate-tab-swipe-in-from-right",
            tabSwipeDirection === 'right' && "animate-tab-swipe-in-from-left"
          )}
        >
        {multiGroupActive &&
          unassignedPauschalItems.length > 0 &&
          canEditPauschalEntries &&
          onSetPauschalGruppen && (
          <div className="mb-4 w-full rounded-lg border border-[rgb(230,126,34)]/40 bg-[rgb(230,126,34)]/10 px-3 py-2 text-sm text-foreground">
            {onPauschalGruppenFilterChange && (
              <>
                <button
                  type="button"
                  onClick={() => onPauschalGruppenFilterChange('offen')}
                  className="font-semibold text-[rgb(230,126,34)] underline underline-offset-2 hover:no-underline"
                >
                  Nicht zugeordnet anzeigen
                </button>
                {' · '}
              </>
            )}
            <span className="font-semibold text-[rgb(230,126,34)]">{unassignedPauschalItems.length}</span>{' '}
            pauschale {unassignedPauschalItems.length === 1 ? 'Eintrag' : 'Einträge'} nicht zugeordnet – Badge
            tippen zum Zuordnen
          </div>
        )}
        {showTeamPackOverview ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] py-8">
            <Card className="max-w-md w-full border-[rgb(45,79,30)]/20 shadow-lg bg-card/95">
              <CardContent className="pt-8 pb-6 px-6 sm:px-8">
                <div className="text-center mb-6">
                  <div className="mx-auto w-14 h-14 rounded-full bg-[rgb(45,79,30)]/10 flex items-center justify-center mb-4">
                    <CheckCheck className="h-8 w-8 text-brand-heading" />
                  </div>
                  <h2 className="text-xl font-semibold text-brand-heading mb-2">
                    {currentProfileName
                      ? `Alles gepackt für ${currentProfileName}!`
                      : 'Alles gepackt!'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Andere Mitreisende haben noch offene Einträge.
                  </p>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
                  Mitreisende
                </p>
                {profileGroups.otherGroups.length > 0 ? (
                  <PackProfileGroupOverviewList
                    ownGroup={profileGroups.ownGroup.filter((p) =>
                      personStatusById.has(p.id)
                    )}
                    otherGroups={profileGroups.otherGroups
                      .map((g) => ({
                        ...g,
                        members: g.members.filter((p) => personStatusById.has(p.id)),
                      }))
                      .filter((g) => g.members.length > 0)}
                    selectedProfile={selectedProfile}
                    onProfileSelect={onProfileChange}
                    renderRow={(person, index, opts) =>
                      renderTeamOverviewRow(person, index, opts)
                    }
                  />
                ) : (
                  <ul className="space-y-2">
                    {personPackStatuses.map(({ person }, index) =>
                      renderTeamOverviewRow(person, index, {
                        isCurrent: selectedProfile === person.id,
                        subdued: false,
                      })
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : showAllPackedCelebration ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] py-12">
            <Card className="max-w-md w-full border-[rgb(45,79,30)]/20 shadow-lg bg-card/95">
              <CardContent className="pt-8 pb-8 px-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-[rgb(45,79,30)]/10 flex items-center justify-center mb-6">
                  <CheckCheck className="h-9 w-9 text-brand-heading" />
                </div>
                <h2 className="text-xl font-semibold text-brand-heading mb-2">
                  Alles gepackt!
                </h2>
                <p className="text-muted-foreground mb-6">
                  {canSelectOtherProfiles
                    ? 'Alle Mitreisenden haben ihre Einträge abgehakt.'
                    : 'Aus Ihrer aktuellen Sicht sind alle Einträge abgehakt.'}
                </p>
                <p className="text-lg font-medium text-brand-heading">
                  Schönen Urlaub!
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
        <>
        {tabsForSwipe.map(mainCat => (
            <TabsContent key={mainCat} value={mainCat} className="space-y-6 mt-14 m-0">
              {Object.entries(itemsByMainCategory[mainCat] ?? {}).map(([category, categoryItems]) => {
                if (!shouldShowCategory(categoryItems)) return null;
                
                return (
                  <div
                    key={category}
                    ref={(el) => {
                      categoryRefsMap.current.set(`${mainCat}::${category}`, el);
                    }}
                    data-category={category}
                    data-main-category={mainCat}
                  >
                    {/* Category Subheading */}
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                      {category}
                    </h3>
                    
                    {/* Items in this category - transparenter Hintergrund für beige Sichtbarkeit */}
                    <Card className="border-none shadow-none overflow-hidden bg-transparent">
                      <CardContent className="p-0 bg-transparent">
                        {categoryItems.map(item => (
                            <PackingItem
                              key={item.id}
                              id={item.id}
                              was={item.was}
                              anzahl={item.anzahl}
                              isTemporaer={item.is_temporaer}
                              gepackt={item.gepackt}
                              gepackt_vorgemerkt={item.gepackt_vorgemerkt}
                              bemerkung={item.bemerkung}
                              transport_name={item.transport_name}
                              mitreisenden_typ={item.mitreisenden_typ}
                              mitreisende={item.mitreisende}
                              onToggle={onToggle}
                              onSetPacked={onSetPacked}
                              onToggleMitreisender={onToggleMitreisender}
                              onEdit={onEdit}
                              onDelete={onDelete}
                              onConfirmVorgemerkt={onConfirmVorgemerkt}
                              onRemoveVorgemerkt={onRemoveVorgemerkt}
                              canConfirmVorgemerkt={canConfirmVorgemerkt}
                              details={item.details}
                              fullItem={item}
                              selectedProfile={selectedProfile}
                              hidePackedItems={hidePackedItems}
                              vacationMitreisende={effectiveScopeMitreisende}
                              ownGroupMitreisende={ownGroupMitreisende}
                              transportVehicles={transportVehicles}
                              showPersonStatusAsPopover={showPersonStatusAsPopover}
                              onMarkAllConfirm={(ids) => handleMarkAllForItem(item, ids)}
                              onShowToast={showToast}
                              canEditPauschalEntries={canEditPauschalEntries}
                              multiGroupActive={multiGroupActive}
                              ownGruppeId={ownGruppeId}
                              isAdmin={isAdmin}
                              gruppenMap={gruppenMap}
                              vacationGroups={profileGroups}
                              onOpenAssignment={
                                canEditPauschalEntries
                                  ? (item) => setAssignmentItemId(item.id)
                                  : undefined
                              }
                              onToggleGruppe={onToggleGruppe}
                              pauschalGruppenFilter={pauschalGruppenFilter}
                            />
                          ))}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </TabsContent>
          ))}
        </>
        )}
        </div>
      </div>
      {undoToast && (
        <UndoToast
          isVisible={undoToast.visible}
          itemName={undoToast.itemName}
          onUndo={undoToast.action}
          onDismiss={() => setUndoToast(null)}
        />
      )}
      {assignmentItem && onSetPauschalGruppen && (
        <PauschalGruppeAssignmentModal
          open={!!assignmentItem}
          onOpenChange={(o) => !o && setAssignmentItemId(null)}
          itemName={assignmentItem.was}
          vacationGroups={vacationGroupsForSheet}
          currentModus={assignmentItem.pauschal_gruppen_modus}
          currentVerantwortlicheGruppeId={assignmentItem.verantwortliche_gruppe_id}
          currentGruppeIds={(assignmentItem.gruppen ?? []).map((g) => g.gruppe_id)}
          ownGruppeId={ownGruppeId}
          onAssign={(payload) => {
            onSetPauschalGruppen(assignmentItem.id, payload);
          }}
        />
      )}
    </Tabs>
  );
}
