'use client'

// Tabs components removed - not used in this component
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  onMarkAllConfirm
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
  // canToggleIndividual logic is implicit in the conditional rendering

  // Get selected traveler's item
  const selectedTravelerItem = useMemo(() => {
    if (!selectedProfile || !mitreisende) return null;
    return mitreisende.find(m => m.mitreisender_id === selectedProfile);
  }, [selectedProfile, mitreisende]);

  // Handle pauschal toggle
  const handlePauschalToggle = () => {
    if (canTogglePauschal) {
      onToggle(id);
    }
  };

  // Handle individual toggle (for selected profile)
  const handleIndividualToggle = () => {
    if (selectedProfile && selectedTravelerItem) {
      onToggleMitreisender(id, selectedProfile, selectedTravelerItem.gepackt);
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
          itemName={was}
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
  const [undoToast, setUndoToast] = useState<{ visible: boolean; itemName: string; action: () => void } | null>(null);

  // Group items by main category
  const itemsByMainCategory = useMemo(() => {
    const grouped: Record<string, DBPackingItem[]> = {};
    items.forEach(item => {
      const mainCat = item.hauptkategorie_titel || 'Sonstiges';
      if (!grouped[mainCat]) {
        grouped[mainCat] = [];
      }
      grouped[mainCat].push(item);
    });
    return grouped;
  }, [items]);

  const mainCategories = Object.keys(itemsByMainCategory);

  // Calculate progress
  const { packedCount, totalCount } = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.mitreisenden_typ === 'pauschal') {
        acc.total += 1;
        if (item.gepackt) acc.packed += 1;
      } else if (item.mitreisende) {
        acc.total += item.mitreisende.length;
        acc.packed += item.mitreisende.filter(m => m.gepackt).length;
      }
      return acc;
    }, { packed: 0, total: 0 });
  }, [items]);

  const progressPercentage = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  // Handle mark all for an item
  const handleMarkAllForItem = (item: DBPackingItem) => {
    if (item.mitreisende) {
      // Mark all travelers for this item
      item.mitreisende.forEach(m => {
        if (!m.gepackt) {
          onToggleMitreisender(item.id, m.mitreisender_id, false);
        }
      });

      // Show undo toast if hide-packed is active
      if (hidePackedItems) {
        setUndoToast({
          visible: true,
          itemName: item.was,
          action: () => {
            // Undo: unmark all
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

      {/* Items grouped by main category */}
      {mainCategories.map(mainCategory => (
        <Card key={mainCategory}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{mainCategory}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {itemsByMainCategory[mainCategory].map(item => (
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
              />
            ))}
          </CardContent>
        </Card>
      ))}

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
