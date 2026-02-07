'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Truck, Menu } from "lucide-react";
import { useMemo, useState } from "react";
import { PackingItem as DBPackingItem } from "@/lib/db";
import { MarkAllConfirmationDialog } from "./mark-all-confirmation-dialog";
import { UndoToast } from "./undo-toast";

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
  onToggleMitreisender: (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => void;
  onEdit: (item: DBPackingItem) => void;
  onDelete: (id: string) => void;
  details?: string;
  fullItem: DBPackingItem;
  selectedProfile: string | null;
  hidePackedItems: boolean;
  onMarkAllConfirm?: () => void;
  onShowToast?: (itemName: string, travelerName?: string) => void;
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

  // Handle pauschal toggle
  const handlePauschalToggle = () => {
    if (canTogglePauschal) {
      onToggle(id);
      if (hidePackedItems && !gepackt && onShowToast) {
        onShowToast(was);
      }
    }
  };

  // Handle individual toggle (for selected profile)
  const handleIndividualToggle = () => {
    if (selectedProfile && selectedTravelerItem) {
      onToggleMitreisender(id, selectedProfile, selectedTravelerItem.gepackt);
      if (hidePackedItems && !selectedTravelerItem.gepackt && onShowToast) {
        onShowToast(was, selectedTravelerItem.mitreisender_name);
      }
    }
  };

  // Handle "mark all" toggle (for Zentral/Alle mode)
  const handleMarkAllToggle = () => {
    if (selectedProfile === null && mitreisenden_typ !== 'pauschal') {
      setShowMarkAllDialog(true);
    }
  };

  const confirmMarkAll = () => {
    if (onMarkAllConfirm) {
      onMarkAllConfirm();
    }
  };

  // Hide if packed and hide mode is active
  if (hidePackedItems && isFullyPacked) {
    return null;
  }

  return (
    <>
      <div className={`p-3 border-b transition-colors ${isFullyPacked ? 'bg-muted/50' : 'hover:bg-muted/30'}`}>
        <div className="flex items-start space-x-3">
          {/* Checkbox logic based on mode */}
          {mitreisenden_typ === 'pauschal' && (
            <Checkbox
              id={`item-${id}`}
              checked={gepackt}
              onCheckedChange={handlePauschalToggle}
              className="mt-0.5"
            />
          )}
          
          {mitreisenden_typ !== 'pauschal' && selectedProfile !== null && selectedTravelerItem && (
            <Checkbox
              id={`item-${id}`}
              checked={selectedTravelerItem.gepackt}
              onCheckedChange={handleIndividualToggle}
              className="mt-0.5"
            />
          )}

          {mitreisenden_typ !== 'pauschal' && selectedProfile === null && (
            <Checkbox
              id={`item-${id}`}
              checked={isFullyPacked}
              onCheckedChange={handleMarkAllToggle}
              className="mt-0.5"
            />
          )}
          
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <label
                htmlFor={`item-${id}`}
                className={`text-sm font-medium leading-none cursor-pointer ${isFullyPacked ? 'line-through text-muted-foreground' : ''}`}
              >
                {was} {anzahl > 1 ? `(${anzahl}x)` : ''}
              </label>
              {transport_name && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  <Truck className="h-3 w-3" />
                  {transport_name}
                </span>
              )}
            </div>
            
            {details && <p className="text-xs text-muted-foreground mt-1">{details}</p>}
            {bemerkung && <p className="text-xs text-blue-600 mt-1">📝 {bemerkung}</p>}
            
            {/* Status indicator based on mode */}
            {mitreisenden_typ !== 'pauschal' && (
              <div className="mt-1">
                {selectedProfile !== null && selectedTravelerItem && (
                  <span className="text-xs text-gray-500">
                    Für {selectedTravelerItem.mitreisender_name}
                  </span>
                )}
                {selectedProfile === null && (
                  <span className="text-xs text-blue-600 font-medium">
                    {packedCount} von {totalCount}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(fullItem)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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
        />
      )}
    </>
  );
};

interface PackingListProps {
  items: DBPackingItem[];
  onToggle: (id: string) => void;
  onToggleMitreisender: (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => void;
  onEdit: (item: DBPackingItem) => void;
  onDelete: (id: string) => void;
  selectedProfile: string | null;
  hidePackedItems: boolean;
  onOpenSettings: () => void;
}

export function PackingList({
  items,
  onToggle,
  onToggleMitreisender,
  onEdit,
  onDelete,
  selectedProfile,
  hidePackedItems,
  onOpenSettings
}: PackingListProps) {
  const [undoToast, setUndoToast] = useState<{ visible: boolean; itemName: string; travelerName?: string; action: () => void } | null>(null);
  const [activeMainCategory, setActiveMainCategory] = useState<string>('');

  // Group items by main category and category
  const itemsByMainCategory = useMemo(() => {
    const grouped: Record<string, Record<string, DBPackingItem[]>> = {};
    items.forEach(item => {
      const mainCat = item.hauptkategorie || 'Sonstiges';
      const cat = item.kategorie || 'Ohne Kategorie';
      
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

  // Handle mark all for an item
  const handleMarkAllForItem = (item: DBPackingItem) => {
    if (item.mitreisende) {
      const travelerNames: string[] = [];
      
      // Mark all travelers for this item
      item.mitreisende.forEach(m => {
        if (!m.gepackt) {
          onToggleMitreisender(item.id, m.mitreisender_id, false);
          travelerNames.push(m.mitreisender_name);
        }
      });

      // Show undo toast if hide-packed is active and items were marked
      if (hidePackedItems && travelerNames.length > 0) {
        setUndoToast({
          visible: true,
          itemName: item.was,
          travelerName: travelerNames.join(', '),
          action: () => {
            // Undo: unmark all that were just marked
            item.mitreisende?.forEach(m => {
              if (m.gepackt) {
                onToggleMitreisender(item.id, m.mitreisender_id, true);
              }
            });
          }
        });
      }
    }
  };

  const showToast = (itemName: string, travelerName?: string) => {
    setUndoToast({
      visible: true,
      itemName,
      travelerName,
      action: () => {
        // This will be set by the specific toggle handler
      }
    });
  };

  // Check if a category should be shown (has unpacked items or hidePackedItems is false)
  const shouldShowCategory = (categoryItems: DBPackingItem[]) => {
    if (!hidePackedItems) return true;
    
    return categoryItems.some(item => {
      if (item.mitreisenden_typ === 'pauschal') {
        return !item.gepackt;
      }
      return item.mitreisende?.some(m => !m.gepackt) ?? false;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with Settings Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="flex items-center gap-2"
        >
          <Menu className="h-4 w-4" />
          Einstellungen
        </Button>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Packfortschritt</span>
            <span className="text-muted-foreground">{packedCount}/{totalCount} ({progressPercentage}%)</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Category Tabs */}
      <Tabs value={activeMainCategory} onValueChange={setActiveMainCategory}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {mainCategories.map(mainCat => (
            <TabsTrigger key={mainCat} value={mainCat}>
              {mainCat}
            </TabsTrigger>
          ))}
        </TabsList>

        {mainCategories.map(mainCat => (
          <TabsContent key={mainCat} value={mainCat} className="space-y-4 mt-4">
            {Object.entries(itemsByMainCategory[mainCat]).map(([category, categoryItems]) => {
              if (!shouldShowCategory(categoryItems)) return null;
              
              return (
                <div key={category}>
                  {/* Category Subheading */}
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 px-1">
                    {category}
                  </h3>
                  
                  {/* Items in this category */}
                  <Card>
                    <CardContent className="p-0">
                      {categoryItems.map(item => (
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
          itemName={`${undoToast.itemName}${undoToast.travelerName ? ` (${undoToast.travelerName})` : ''}`}
          onUndo={undoToast.action}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </div>
  );
}
