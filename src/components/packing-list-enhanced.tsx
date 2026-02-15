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
import { MoreVertical, Edit2, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { PackingItem as DBPackingItem } from "@/lib/db";
import { MarkAllConfirmationDialog } from "./mark-all-confirmation-dialog";
import { UndoToast } from "./undo-toast";
import { cn } from "@/lib/utils";

interface PackingItemProps {
  id: string;
  was: string;
  anzahl: number;
  gepackt: boolean;
  bemerkung?: string | null;
  transport_name?: string | null;
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte';
  mitreisende?: Array<{ mitreisender_id: string; mitreisender_name: string; gepackt: boolean }>;
  onToggle: (id: string) => void;
  /** Explizites Setzen des Gepackt-Status (für Undo bei Pauschal – vermeidet Stale-Closure) */
  onSetPacked?: (id: string, gepackt: boolean) => void;
  onToggleMitreisender: (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => void;
  onEdit: (item: DBPackingItem) => void;
  onDelete: (id: string) => void;
  details?: string;
  fullItem: DBPackingItem;
  selectedProfile: string | null;
  hidePackedItems: boolean;
  onMarkAllConfirm?: () => void;
  onShowToast?: (itemName: string, travelerName: string | undefined, undoAction: () => void) => void;
}

const PackingItem: React.FC<PackingItemProps> = ({
  id,
  was,
  anzahl,
  gepackt,
  bemerkung,
  transport_name,
  mitreisenden_typ,
  mitreisende,
  onToggle,
  onSetPacked,
  onToggleMitreisender,
  onEdit,
  onDelete,
  details,
  fullItem,
  selectedProfile,
  hidePackedItems,
  onMarkAllConfirm,
  onShowToast
}) => {
  const [showMarkAllDialog, setShowMarkAllDialog] = useState(false);

  const isFullyPacked = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') {
      return gepackt;
    }
    return (mitreisende?.length ?? 0) > 0 && mitreisende?.every(m => m.gepackt);
  }, [mitreisenden_typ, gepackt, mitreisende]);

  // Calculate packed count for individual items
  const packedCount = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') return gepackt ? 1 : 0;
    return mitreisende?.filter(m => m.gepackt).length ?? 0;
  }, [mitreisenden_typ, gepackt, mitreisende]);

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

  // Check if item should be hidden in individual profile view
  const shouldHideInProfileView = useMemo(() => {
    if (!hidePackedItems) return false;
    if (selectedProfile) {
      // In individual profile view, hide if packed for THIS profile
      // If no entry exists yet for this traveler, don't hide it
      return selectedTravelerItem?.gepackt ?? false;
    }
    // In Zentral/Alle view, hide if fully packed
    return isFullyPacked;
  }, [hidePackedItems, selectedProfile, selectedTravelerItem, isFullyPacked]);

  // Handle pauschal toggle
  const handlePauschalToggle = () => {
    if (canTogglePauschal) {
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

  // Handle individual toggle (for selected profile)
  const handleIndividualToggle = () => {
    if (selectedProfile) {
      const wasUnpacked = !(selectedTravelerItem?.gepackt ?? false);
      const itemId = id;
      const profileId = selectedProfile;
      const currentStatus = selectedTravelerItem?.gepackt ?? false;
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
    if (selectedProfile === null && mitreisenden_typ !== 'pauschal') {
      setShowMarkAllDialog(true);
    }
  };

  const confirmMarkAll = () => {
    if (onMarkAllConfirm) {
      onMarkAllConfirm();
    }
    setShowMarkAllDialog(false);
  };

  // Hide if packed
  if (shouldHideInProfileView) {
    return null;
  }

  return (
    <>
      <div className={cn(
        "p-4 mb-3 bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-200",
        isFullyPacked ? 'opacity-60' : 'hover:shadow-md'
      )}>
        <div className="flex items-start space-x-3">
          {/* Checkbox logic based on mode */}
          {mitreisenden_typ === 'pauschal' && (
            <Checkbox
              id={`item-${id}`}
              checked={gepackt}
              onCheckedChange={handlePauschalToggle}
              className="mt-0.5 h-6 w-6 rounded-md border-2 border-gray-300 data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
            />
          )}
          
          {mitreisenden_typ !== 'pauschal' && selectedProfile !== null && (
            <Checkbox
              id={`item-${id}`}
              checked={selectedTravelerItem?.gepackt ?? false}
              onCheckedChange={handleIndividualToggle}
              className="mt-0.5 h-6 w-6 rounded-md border-2 border-gray-300 data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
            />
          )}

          {mitreisenden_typ !== 'pauschal' && selectedProfile === null && (
            <Checkbox
              id={`item-${id}`}
              checked={isFullyPacked}
              onCheckedChange={handleMarkAllToggle}
              className="mt-0.5 h-6 w-6 rounded-md border-2 border-gray-300 data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:border-[rgb(45,79,30)]"
            />
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
                {was} {anzahl > 1 ? `(${anzahl}x)` : ''}
              </label>
              {transport_name && (
                <span className="inline-flex items-center gap-1 text-xs bg-[rgb(45,79,30)]/10 text-[rgb(45,79,30)] px-2 py-0.5 rounded-md border border-[rgb(45,79,30)]/20">
                  <Truck className="h-3 w-3" />
                  {transport_name}
                </span>
              )}
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
                {selectedProfile === null && (
                  <span className="text-xs text-accent font-medium">
                    {packedCount}/{totalCount} Personen
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Three-dot menu for edit/delete */}
          <DropdownMenu>
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
              <DropdownMenuItem onClick={() => onEdit(fullItem)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mark All Confirmation Dialog */}
      {mitreisende && (
        <MarkAllConfirmationDialog
          isOpen={showMarkAllDialog}
          onClose={() => setShowMarkAllDialog(false)}
          onConfirm={confirmMarkAll}
          _itemName={was}
          travelerNames={mitreisende.map(m => m.mitreisender_name)}
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
  onDelete: (id: string) => void;
  selectedProfile: string | null;
  hidePackedItems: boolean;
  onOpenSettings: () => void;
  vacationMitreisende?: Array<{ id: string; name: string }>;
}

export function PackingList({
  items,
  onToggle,
  onSetPacked,
  onToggleMitreisender,
  onToggleMultipleMitreisende,
  onEdit,
  onDelete,
  selectedProfile,
  hidePackedItems,
  onOpenSettings: _onOpenSettings,
  vacationMitreisende = []
}: PackingListProps) {
  const [undoToast, setUndoToast] = useState<{ visible: boolean; itemName: string; action: () => void } | null>(null);
  const [activeMainCategory, setActiveMainCategory] = useState<string>('');

  // Group items by main category and category
  const itemsByMainCategory = useMemo(() => {
    const grouped: Record<string, Record<string, DBPackingItem[]>> = {};
    items.forEach(item => {
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
  }, [items]);

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

  // Calculate progress
  const { packedCount, totalCount } = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.mitreisenden_typ === 'pauschal') {
        acc.totalCount += 1;
        if (item.gepackt) acc.packedCount += 1;
      } else if (item.mitreisende) {
        acc.totalCount += item.mitreisende.length;
        acc.packedCount += item.mitreisende.filter(m => m.gepackt).length;
      }
      return acc;
    }, { packedCount: 0, totalCount: 0 });
  }, [items]);

  const progressPercentage = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  // Handle mark all or unmark all for an item
  const handleMarkAllForItem = (item: DBPackingItem) => {
    // Get the list of mitreisende to work with
    let mitreisendeToProcess = item.mitreisende || [];
    
    // If mitreisende array is empty but mitreisenden_typ is 'alle', use all vacation mitreisende
    if (mitreisendeToProcess.length === 0 && item.mitreisenden_typ === 'alle' && vacationMitreisende.length > 0) {
      mitreisendeToProcess = vacationMitreisende.map(m => ({
        mitreisender_id: m.id,
        mitreisender_name: m.name,
        gepackt: false
      }));
    }
    
    if (mitreisendeToProcess.length === 0) {
      console.warn('handleMarkAllForItem: No mitreisende found for item', item.id, item.mitreisenden_typ);
      return;
    }
    
    // Check if all are already packed
    const allPacked = mitreisendeToProcess.every(m => m.gepackt);
    
    if (allPacked) {
      // Unmark all
      const travelerNames: string[] = [];
      const updates: Array<{ mitreisenderId: string; newStatus: boolean }> = [];
      
      mitreisendeToProcess.forEach(m => {
        updates.push({ mitreisenderId: m.mitreisender_id, newStatus: false });
        travelerNames.push(m.mitreisender_name);
      });

      // Unmark all travelers in a single batch
      onToggleMultipleMitreisende(item.id, updates);

      // Show undo toast only if hidePackedItems is active
      if (hidePackedItems && travelerNames.length > 0) {
        const itemId = item.id
        setUndoToast({
          visible: true,
          itemName: `${item.was} (${travelerNames.join(', ')})`,
          action: () => {
            const undoUpdates = updates.map(u => ({ ...u, newStatus: true }))
            setTimeout(() => onToggleMultipleMitreisende(itemId, undoUpdates), 100)
          }
        });
      }
    } else {
      // Mark all unpacked travelers
      const travelerNames: string[] = [];
      const updates: Array<{ mitreisenderId: string; newStatus: boolean }> = [];
      
      mitreisendeToProcess.forEach(m => {
        if (!m.gepackt) {
          updates.push({ mitreisenderId: m.mitreisender_id, newStatus: true });
          travelerNames.push(m.mitreisender_name);
        }
      });

      // Mark all travelers in a single batch
      if (updates.length > 0) {
        onToggleMultipleMitreisende(item.id, updates);

        // Show undo toast only if hidePackedItems is active
        if (hidePackedItems && travelerNames.length > 0) {
          const itemId = item.id
          setUndoToast({
            visible: true,
            itemName: `${item.was} (${travelerNames.join(', ')})`,
            action: () => {
              const undoUpdates = updates.map(u => ({ ...u, newStatus: false }))
              setTimeout(() => onToggleMultipleMitreisende(itemId, undoUpdates), 100)
            }
          });
        }
      }
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

  // Check if a category should be shown - FIXED for individual profile view
  const shouldShowCategory = (categoryItems: DBPackingItem[]) => {
    if (!hidePackedItems) return true;
    
    return categoryItems.some(item => {
      if (item.mitreisenden_typ === 'pauschal') {
        return !item.gepackt;
      }
      
      // If in individual profile view, check only for that profile
      if (selectedProfile) {
        const travelerItem = item.mitreisende?.find(m => m.mitreisender_id === selectedProfile);
        return travelerItem ? !travelerItem.gepackt : false;
      }
      
      // In Zentral/Alle view, check if any traveler hasn't packed
      return item.mitreisende?.some(m => !m.gepackt) ?? false;
    });
  };

  return (
    <div className="space-y-6 bg-[rgb(250,250,249)] px-4 sm:px-6 pb-6 min-w-0 max-w-full overflow-x-hidden">
      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="space-y-2 bg-white px-1">
          <div className="relative">
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[rgb(45,79,30)] transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="absolute -top-1 right-0 text-xs font-medium text-gray-600">
              {progressPercentage}%
            </div>
          </div>
        </div>
      )}

      {/* Main Category Tabs */}
      <Tabs value={activeMainCategory} onValueChange={setActiveMainCategory} className="w-full max-w-full">
        <div className="bg-white overflow-x-auto overflow-y-hidden -mx-4 sm:-mx-6 pl-4 pr-4 sm:pl-6 sm:pr-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsList className="inline-flex w-max justify-start bg-transparent border-b border-gray-200 p-0 h-auto rounded-none">
            {mainCategories.map(mainCat => (
              <TabsTrigger 
                key={mainCat} 
                value={mainCat}
                className="flex-shrink-0 uppercase text-xs font-semibold tracking-wide px-6 py-3 rounded-none border-b-4 border-transparent data-[state=active]:border-[#e67e22] data-[state=active]:text-[rgb(45,79,30)] data-[state=inactive]:text-[rgb(168,162,158)] hover:text-gray-900 transition-colors relative data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
              >
                {mainCat}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {mainCategories.map(mainCat => (
          <TabsContent key={mainCat} value={mainCat} className="space-y-6 mt-6">
            {Object.entries(itemsByMainCategory[mainCat] ?? {}).map(([category, categoryItems]) => {
              if (!shouldShowCategory(categoryItems)) return null;
              
              return (
                <div key={category}>
                  {/* Category Subheading */}
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    {category}
                  </h3>
                  
                  {/* Items in this category - transparenter Hintergrund für beige Sichtbarkeit */}
                  <Card className="overflow-hidden bg-transparent">
                    <CardContent className="p-0 bg-transparent">
                      {categoryItems
                        .filter(item => {
                          // Filter logic for individual profile view
                          if (selectedProfile) {
                            // Pauschale Einträge: immer anzeigen
                            if (item.mitreisenden_typ === 'pauschal') {
                              return true;
                            }
                            // Alle: immer anzeigen
                            if (item.mitreisenden_typ === 'alle') {
                              return true;
                            }
                            // Ausgewählte: nur anzeigen, wenn dieser Mitreisende zugeordnet ist
                            if (item.mitreisenden_typ === 'ausgewaehlte') {
                              return item.mitreisende?.some(m => m.mitreisender_id === selectedProfile) ?? false;
                            }
                          }
                          // In "Alle" Modus: alle Einträge anzeigen
                          return true;
                        })
                        .map(item => (
                          <PackingItem
                            key={item.id}
                            id={item.id}
                            was={item.was}
                            anzahl={item.anzahl}
                            gepackt={item.gepackt}
                            bemerkung={item.bemerkung}
                            transport_name={item.transport_name}
                            mitreisenden_typ={item.mitreisenden_typ}
                            mitreisende={item.mitreisende}
                            onToggle={onToggle}
                            onSetPacked={onSetPacked}
                            onToggleMitreisender={onToggleMitreisender}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            details={item.details}
                            fullItem={item}
                            selectedProfile={selectedProfile}
                            hidePackedItems={hidePackedItems}
                            onMarkAllConfirm={() => handleMarkAllForItem(item)}
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
      </Tabs>

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
  );
}
