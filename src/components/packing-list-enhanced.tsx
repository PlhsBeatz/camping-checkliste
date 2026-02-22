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
import { MoreVertical, Edit2, Trash2, RotateCcw, CheckCheck } from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { PackingItem as DBPackingItem } from "@/lib/db";
import { MarkAllConfirmationDialog, type TravelerForMarkAll } from "./mark-all-confirmation-dialog";
import { UndoToast } from "./undo-toast";
import { cn } from "@/lib/utils";

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
  details?: string;
  fullItem: DBPackingItem;
  selectedProfile: string | null;
  hidePackedItems: boolean;
  vacationMitreisende?: Array<{ id: string; name: string }>;
  onMarkAllConfirm?: (selectedTravelerIds: string[]) => void;
  onShowToast?: (itemName: string, travelerName: string | undefined, undoAction: () => void) => void;
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
  details,
  fullItem,
  selectedProfile,
  hidePackedItems,
  vacationMitreisende = [],
  onMarkAllConfirm,
  onShowToast
}) => {
  const [showMarkAllDialog, setShowMarkAllDialog] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [hasExited, setHasExited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const effectivePacked = (g: boolean, v?: boolean) => g || !!v;
  const isFullyPacked = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') {
      return effectivePacked(gepackt, gepackt_vorgemerkt);
    }
    return (mitreisende?.length ?? 0) > 0 && mitreisende?.every(m => effectivePacked(m.gepackt, m.gepackt_vorgemerkt));
  }, [mitreisenden_typ, gepackt, gepackt_vorgemerkt, mitreisende]);

  /** Nur final gepackt (gepackt=true), nicht vorgemerkt – für Eltern bei „Gepacktes ausblenden“ */
  const isFullyPackedFinal = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return gepackt;
    return (mitreisende?.length ?? 0) > 0 && mitreisende?.every(m => m.gepackt);
  }, [mitreisenden_typ, gepackt, mitreisende]);

  // Calculate packed count for individual items (gepackt OR vorgemerkt zählt als gepackt für Anzeige)
  const packedCount = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return effectivePacked(gepackt, gepackt_vorgemerkt) ? 1 : 0;
    return mitreisende?.filter(m => effectivePacked(m.gepackt, m.gepackt_vorgemerkt)).length ?? 0;
  }, [mitreisenden_typ, gepackt, gepackt_vorgemerkt, mitreisende]);

  /** Nur final gepackt – für Admin-Anzeige x/4 Personen */
  const packedCountFinal = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return gepackt ? 1 : 0;
    return mitreisende?.filter(m => m.gepackt).length ?? 0;
  }, [mitreisenden_typ, gepackt, mitreisende]);

  /** Namen der Mitreisenden mit Vormerkung – für Admin-Anzeige "(Prüfen: …)" */
  const vorgemerktNames = useMemo(() => {
    if (mitreisenden_typ === 'pauschal' || !mitreisende) return [];
    return mitreisende
      .filter(m => !!m.gepackt_vorgemerkt && !m.gepackt)
      .map(m => m.mitreisender_name);
  }, [mitreisenden_typ, mitreisende]);

  const totalCount = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return 1;
    return mitreisende?.length ?? 0;
  }, [mitreisenden_typ, mitreisende]);

  // Determine if checkbox should be enabled
  const canTogglePauschal = mitreisenden_typ === 'pauschal';

  // Get selected traveler's item
  const selectedTravelerItem = useMemo(() => {
    if (!selectedProfile || !mitreisende) return null;
    return mitreisende.find(m => m.mitreisender_id === selectedProfile);
  }, [selectedProfile, mitreisende]);

  /** Transport für Pill: im Personen-Profil der Person-Transport, im Alle-Profil Haupt + ggf. weiteres mit "+" */
  const displayTransportName = useMemo(() => {
    if (selectedProfile !== null) {
      const person = fullItem.mitreisende?.find(m => m.mitreisender_id === selectedProfile);
      return person?.transport_name ?? fullItem.transport_name ?? null;
    }
    const main = fullItem.transport_name ?? null;
    const personTransports = (fullItem.mitreisende ?? []).map(m => m.transport_name).filter(Boolean) as string[];
    const others = [...new Set(personTransports)].filter(t => t !== main);
    if (others.length === 0) return main;
    return [main, ...others].filter(Boolean).join('+');
  }, [fullItem, selectedProfile]);

  /** Gepackt für Transparenz-Anzeige (opacity-60): Admin nur bei final gepackt, sonst auch vorgemerkt */
  const isPackedForOpacity = useMemo(() => {
    if (canConfirmVorgemerkt) {
      if (mitreisenden_typ === 'pauschal') return gepackt;
      if (selectedProfile) return selectedTravelerItem ? !!selectedTravelerItem.gepackt : false;
      return isFullyPackedFinal;
    }
    if (mitreisenden_typ === 'pauschal') return effectivePacked(gepackt, gepackt_vorgemerkt);
    if (selectedProfile) return selectedTravelerItem ? effectivePacked(selectedTravelerItem.gepackt, selectedTravelerItem.gepackt_vorgemerkt) : false;
    return isFullyPacked;
  }, [canConfirmVorgemerkt, mitreisenden_typ, gepackt, gepackt_vorgemerkt, selectedProfile, selectedTravelerItem, isFullyPacked, isFullyPackedFinal]);

  // Check if item should be hidden in individual profile view
  const shouldHideInProfileView = useMemo(() => {
    if (!hidePackedItems) return false;
    if (selectedProfile) {
      if (mitreisenden_typ === 'pauschal') {
        // Pauschal: Status auf Item-Ebene (gepackt, gepackt_vorgemerkt)
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
  }, [hidePackedItems, selectedProfile, selectedTravelerItem, mitreisenden_typ, gepackt, gepackt_vorgemerkt, canConfirmVorgemerkt, isFullyPacked, isFullyPackedFinal]);

  // Micro-Animation beim Abhaken mit Gepacktes Ausblenden
  useEffect(() => {
    if (shouldHideInProfileView && hidePackedItems) {
      setIsExiting(true);
      const t = setTimeout(() => {
        setHasExited(true);
      }, 280);
      return () => clearTimeout(t);
    }
    setIsExiting(false);
    setHasExited(false);
    return;
  }, [shouldHideInProfileView, hidePackedItems]);

  // Handle pauschal toggle
  const handlePauschalToggle = () => {
    if (canTogglePauschal) {
      if (isVorgemerktPauschal && canConfirmVorgemerkt && onConfirmVorgemerkt) {
        onConfirmVorgemerkt(id);
        return;
      }
      const wasUnpacked = !gepackt;
      const itemId = id; // Capture id in closure
      onToggle(itemId);
      if (hidePackedItems && wasUnpacked && onShowToast) {
        // Undo: explizit auf false setzen (nicht togglen) – vermeidet Stale-Closure-Bug
        const undoAction = () => {
          if (onSetPacked) {
            onSetPacked(itemId, false);
          } else {
            setTimeout(() => onToggle(itemId), 0);
          }
        };
        onShowToast(was, undefined, undoAction);
      }
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
        // Create undo action - use setTimeout to ensure state has updated
        const undoAction = () => {
          setTimeout(() => {
            onToggleMitreisender(itemId, profileId, !currentStatus);
          }, 0);
        };
        onShowToast(was, selectedTravelerItem?.mitreisender_name, undoAction);
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

  const travelersForMarkAll: TravelerForMarkAll[] = useMemo(() => {
    let list = mitreisende ?? [];
    if (list.length === 0 && mitreisenden_typ === 'alle' && vacationMitreisende.length > 0) {
      list = vacationMitreisende.map(m => ({
        mitreisender_id: m.id,
        mitreisender_name: m.name,
        gepackt: false
      }));
    }
    if (isFullyPacked) {
      return list.filter(m => m.gepackt).map(m => ({
        id: m.mitreisender_id,
        name: m.mitreisender_name,
        isCurrentlyPacked: true
      }));
    }
    return list.filter(m => !m.gepackt).map(m => ({
      id: m.mitreisender_id,
      name: m.mitreisender_name,
      isCurrentlyPacked: false
    }));
  }, [mitreisende, mitreisenden_typ, vacationMitreisende, isFullyPacked]);

  // Hide if packed – nach Exit-Animation
  if (hasExited) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "p-4 mb-3 bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-200 overflow-hidden",
          isExiting && "animate-pack-item-out",
          !isExiting && (isPackedForOpacity ? 'opacity-60' : 'hover:shadow-md')
        )}
      >
        <div className="flex items-start space-x-3">
          {/* Checkbox logic based on mode - feste Größe mit flex-shrink-0 */}
          {mitreisenden_typ === 'pauschal' && (
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
                checked={isFullyPacked}
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
                  isFullyPacked ? 'line-through text-muted-foreground' : 'text-foreground'
                )}
              >
                {was}{' '}
                {(selectedProfile && selectedTravelerItem?.anzahl != null
                  ? selectedTravelerItem.anzahl
                  : anzahl) > 1
                  ? `(${(selectedProfile && selectedTravelerItem?.anzahl != null ? selectedTravelerItem.anzahl : anzahl)}x)`
                  : ''}
              </label>
            </div>
            
            {details && <p className="text-xs text-muted-foreground mt-1.5">{details}</p>}
            {bemerkung && <p className="text-xs text-accent mt-1.5">📝 {bemerkung}</p>}
            
            {/* Status indicator based on mode */}
            {mitreisenden_typ !== 'pauschal' && (
              <div className="mt-1.5">
                {selectedProfile !== null && selectedTravelerItem && (
                  <span className="text-xs text-muted-foreground">
                    Für {selectedTravelerItem.mitreisender_name}
                  </span>
                )}
                {selectedProfile === null && mitreisende && mitreisende.length > 0 && (
                  <Popover>
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
                      <div className="p-2 border-b bg-muted/30">
                        <p className="text-xs font-semibold text-foreground">Gepackt pro Person</p>
                      </div>
                      <ul className="max-h-48 overflow-y-auto py-1">
                        {mitreisende.map((m) => {
                          const packed = canConfirmVorgemerkt ? m.gepackt : (m.gepackt || !!m.gepackt_vorgemerkt);
                          const vorgemerkt = !!m.gepackt_vorgemerkt && !m.gepackt;
                          return (
                            <li
                              key={m.mitreisender_id}
                              className="flex items-center gap-2 px-3 py-2 text-sm"
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
                                <span className="text-xs text-amber-600 ml-auto shrink-0">Prüfen</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Transport-Pill und Three-dot menu */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {displayTransportName && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                {displayTransportName}
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
              {!(selectedProfile && mitreisenden_typ === 'pauschal') && (
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
          isUnmarkMode={isFullyPacked}
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
  vacationMitreisende?: Array<{ id: string; name: string }>;
  /** Urlaubs-Abreisedatum (abfahrtdatum ?? startdatum) – für erst_abreisetag_gepackt im Packliste-Modus */
  abreiseDatum?: string | null;
  /** Callback wenn sich die sichtbare Kategorie ändert (für Add-Dialog-Scroll) */
  onScrollContextChange?: (ctx: { mainCategory: string; category: string } | null) => void;
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
  canEditPauschalEntries = true,
  isChildView: _isChildView = false,
  selectedProfile,
  hidePackedItems,
  listDisplayMode,
  onOpenSettings: _onOpenSettings,
  vacationMitreisende = [],
  abreiseDatum,
  onScrollContextChange
}: PackingListProps) {
  const [undoToast, setUndoToast] = useState<{ visible: boolean; itemName: string; action: () => void } | null>(null);
  const [activeMainCategory, setActiveMainCategory] = useState<string>('');
  const [firstVisibleCategory, setFirstVisibleCategory] = useState<string>('');
  const [tabsScrollbarVisible, setTabsScrollbarVisible] = useState(false);
  const tabsScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const categoryRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const contentTouchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (tabsScrollTimeoutRef.current) clearTimeout(tabsScrollTimeoutRef.current);
    };
  }, []);

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

  // Prüft ob ein Eintrag im aktuellen Profil sichtbar ist
  // Gefilterte Einträge: Anzeige-Modus + Profil + erst_abreisetag_gepackt
  const visibleItems = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return items.filter(item => {
      if (listDisplayMode === 'packliste' && item.status === 'Immer gepackt') return false;
      // Nur im Packliste-Modus: erst_abreisetag_gepackt nur am Abreisetag anzeigen
      const isErstAbreisetag = !!item.erst_abreisetag_gepackt;
      if (listDisplayMode === 'packliste' && isErstAbreisetag && abreiseDatum) {
        const abreiseStr = toYYYYMMDD(abreiseDatum);
        if (abreiseStr && todayStr !== abreiseStr) return false;
      }
      if (!selectedProfile) return true;
      if (item.mitreisenden_typ === 'pauschal') {
        return canEditPauschalEntries;
      }
      return item.mitreisende?.some(m => m.mitreisender_id === selectedProfile) ?? false;
    });
  }, [items, listDisplayMode, selectedProfile, abreiseDatum, toYYYYMMDD, canEditPauschalEntries]);

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

  // Set initial active tab
  useMemo(() => {
    if (mainCategories.length > 0 && !activeMainCategory) {
      const firstCategory = mainCategories[0];
      if (firstCategory) {  // Type guard to ensure it's not undefined
        setActiveMainCategory(firstCategory);
      }
    }
  }, [mainCategories, activeMainCategory]);

  const effectivePacked = (g: boolean, v?: boolean) => g || !!v;
  // Fortschritt nur über Einträge, auf die der User berechtigt ist (Profil Kinder/Gast = nur eigene Einträge)
  const { packedCount, totalCount } = useMemo(() => {
    return visibleItems.reduce((acc, item) => {
      if (item.mitreisenden_typ === 'pauschal') {
        acc.totalCount += 1;
        if (effectivePacked(item.gepackt, item.gepackt_vorgemerkt)) acc.packedCount += 1;
      } else if (item.mitreisende) {
        if (selectedProfile) {
          const mine = item.mitreisende.find(m => m.mitreisender_id === selectedProfile);
          if (mine) {
            acc.totalCount += 1;
            if (effectivePacked(mine.gepackt, mine.gepackt_vorgemerkt)) acc.packedCount += 1;
          }
        } else {
          acc.totalCount += item.mitreisende.length;
          acc.packedCount += item.mitreisende.filter(m => effectivePacked(m.gepackt, m.gepackt_vorgemerkt)).length;
        }
      }
      return acc;
    }, { packedCount: 0, totalCount: 0 });
  }, [visibleItems, selectedProfile]);

  const progressPercentage = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

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
    if (mitreisendeToProcess.length === 0 && item.mitreisenden_typ === 'alle' && vacationMitreisende.length > 0) {
      mitreisendeToProcess = vacationMitreisende.map(m => ({
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
          const undoUpdates = updates.map(u => ({ ...u, newStatus: !u.newStatus }));
          setTimeout(() => onToggleMultipleMitreisende(itemId, undoUpdates), 100);
        }
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

  // Ist ein Eintrag vollständig gepackt (aus Sicht des aktuellen Profils/Berechtigungen)?
  const isItemFullyPackedForView = useCallback((item: DBPackingItem) => {
    if (item.mitreisenden_typ === 'pauschal') {
      return canConfirmVorgemerkt ? item.gepackt : (item.gepackt || !!item.gepackt_vorgemerkt);
    }
    if (selectedProfile) {
      const m = item.mitreisende?.find(t => t.mitreisender_id === selectedProfile);
      if (!m) return true;
      return canConfirmVorgemerkt ? m.gepackt : (m.gepackt || !!m.gepackt_vorgemerkt);
    }
    return (item.mitreisende?.length ?? 0) > 0 && item.mitreisende!.every(m =>
      canConfirmVorgemerkt ? m.gepackt : (m.gepackt || !!m.gepackt_vorgemerkt)
    );
  }, [selectedProfile, canConfirmVorgemerkt]);

  // Hauptkategorien ausblenden, die vollständig abgehakt sind (bei Gepacktes ausblenden)
  const visibleMainCategories = useMemo(() => {
    if (!hidePackedItems) return mainCategories;
    return mainCategories.filter(mainCat => {
      const cats = itemsByMainCategory[mainCat] ?? {};
      const allItems = Object.values(cats).flat();
      return allItems.some(item => !isItemFullyPackedForView(item));
    });
  }, [mainCategories, itemsByMainCategory, hidePackedItems, isItemFullyPackedForView]);

  // Aktive Tab setzen/korrigieren: erste sichtbare oder wenn aktuelle ausgeblendet
  useEffect(() => {
    if (visibleMainCategories.length === 0) return;
    if (!activeMainCategory || !visibleMainCategories.includes(activeMainCategory)) {
      setActiveMainCategory(visibleMainCategories[0]!);
    }
  }, [visibleMainCategories, activeMainCategory]);

  // Kategorien anzeigen: wenn hidePackedItems, nur wenn mind. ein Eintrag ungepackt
  const shouldShowCategory = (categoryItems: DBPackingItem[]) => {
    if (!hidePackedItems) return true;
    return categoryItems.some(item => !isItemFullyPackedForView(item));
  };

  const hasItems = visibleItems.length > 0;
  const allPackedFromCurrentView = hasItems && totalCount > 0 && packedCount === totalCount;

  const tabsForSwipe = allPackedFromCurrentView && hidePackedItems
    ? []
    : (hidePackedItems ? visibleMainCategories : mainCategories);

  const handleTabSwipe = (direction: 'left' | 'right') => {
    if (tabsForSwipe.length === 0) return;
    const idx = tabsForSwipe.indexOf(activeMainCategory);
    if (idx < 0) return;
    if (direction === 'left' && idx < tabsForSwipe.length - 1) {
      setActiveMainCategory(tabsForSwipe[idx + 1]!);
    } else if (direction === 'right' && idx > 0) {
      setActiveMainCategory(tabsForSwipe[idx - 1]!);
    }
  };

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
      {/* Sticky-Bereich: Progress + Tabs – scrollt nie. Shadow unter den Tabs. */}
      <div className="flex-shrink-0 bg-white shadow">
        <div className="px-4 bg-white">
          {/* Progress Bar */}
          {totalCount > 0 && (
            <div className="space-y-2 bg-white px-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[rgb(45,79,30)] transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-accent flex-shrink-0">
                  {progressPercentage}%
                </span>
              </div>
            </div>
          )}
        </div>
        <div
          ref={tabsScrollContainerRef}
          className={cn(
            "tabs-scrollbar-auto bg-white overflow-x-auto overflow-y-hidden -mx-4 sm:-mx-6 pl-4 pr-4 sm:pl-6 sm:pr-6 pb-2",
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
                className="flex-shrink-0 uppercase text-xs font-semibold tracking-wide px-6 py-3 rounded-none border-b-4 border-transparent data-[state=active]:border-[#e67e22] data-[state=active]:text-[rgb(45,79,30)] data-[state=inactive]:text-[rgb(168,162,158)] hover:text-gray-900 transition-colors relative data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-[50px] data-[state=active]:after:h-1 data-[state=active]:after:bg-[#e67e22] data-[state=active]:after:rounded-full data-[state=active]:border-b-transparent data-[state=active]:shadow-none"
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
        <div className="min-h-full bg-scroll-pattern px-4 sm:px-6 pt-6 pb-6">
        {allPackedFromCurrentView && hidePackedItems ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] py-12">
            <Card className="max-w-md w-full border-[rgb(45,79,30)]/20 shadow-lg bg-white/95">
              <CardContent className="pt-8 pb-8 px-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-[rgb(45,79,30)]/10 flex items-center justify-center mb-6">
                  <CheckCheck className="h-9 w-9 text-[rgb(45,79,30)]" />
                </div>
                <h2 className="text-xl font-semibold text-[rgb(45,79,30)] mb-2">
                  Alles gepackt!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Aus Ihrer aktuellen Sicht sind alle Einträge abgehakt.
                </p>
                <p className="text-lg font-medium text-[rgb(45,79,30)]">
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
                              vacationMitreisende={vacationMitreisende}
                              onMarkAllConfirm={(ids) => handleMarkAllForItem(item, ids)}
                              onShowToast={showToast}
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
        {/* Undo Toast */}
        {undoToast && (
          <UndoToast
            isVisible={undoToast.visible}
            itemName={undoToast.itemName}
            onUndo={undoToast.action}
            onDismiss={() => setUndoToast(null)}
          />
        )}
        </div>
      </div>
    </Tabs>
  );
}
