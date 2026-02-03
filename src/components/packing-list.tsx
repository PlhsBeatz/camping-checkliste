import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { PackingItem as DBPackingItem } from "@/lib/db";

interface PackingItemProps {
  id: string;
  was: string;
  anzahl: number;
  gepackt: boolean;
  bemerkung?: string | null;
  onToggle: (id: string) => void;
  onEdit: (item: DBPackingItem) => void;
  onDelete: (id: string) => void;
  details?: string;
  fullItem: DBPackingItem;
}

const PackingItem: React.FC<PackingItemProps> = ({
  id,
  was,
  anzahl,
  gepackt,
  bemerkung,
  onToggle,
  onEdit,
  onDelete,
  details,
  fullItem
}) => {
  return (
    <div className={`flex items-center space-x-3 p-3 border-b transition-colors ${gepackt ? 'bg-muted/50' : 'hover:bg-muted/30'}`}>
      <Checkbox
        id={`item-${id}`}
        checked={gepackt}
        onCheckedChange={() => onToggle(id)}
        className="mt-0.5"
      />
      <div className="flex-grow min-w-0">
        <label
          htmlFor={`item-${id}`}
          className={`text-sm font-medium leading-none cursor-pointer block ${gepackt ? 'line-through text-muted-foreground' : ''}`}
        >
          {was} {anzahl > 1 ? `(${anzahl}x)` : ''}
        </label>
        {details && <p className="text-xs text-muted-foreground mt-1">{details}</p>}
        {bemerkung && <p className="text-xs text-blue-600 mt-1">📝 {bemerkung}</p>}
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(fullItem)}
          className="h-8 w-8 p-0"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(id)}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

interface PackingListProps {
  items: DBPackingItem[];
  onToggleItem: (id: string) => void;
  onEditItem: (item: DBPackingItem) => void;
  onDeleteItem: (id: string) => void;
  hidePackedItems?: boolean;
}

export const PackingList: React.FC<PackingListProps> = ({
  items,
  onToggleItem,
  onEditItem,
  onDeleteItem,
  hidePackedItems = false
}) => {
  // Memoize the grouped items to avoid unnecessary recalculations
  const itemsByMainCategory = useMemo(() => {
    const grouped: Record<string, Record<string, DBPackingItem[]>> = {};

    items.forEach(item => {
      if (hidePackedItems && item.gepackt) return;

      if (!grouped[item.hauptkategorie]) {
        grouped[item.hauptkategorie] = {};
      }

      const mainCat = grouped[item.hauptkategorie];
      if (mainCat && !mainCat[item.kategorie]) {
        mainCat[item.kategorie] = [];
      }

      if (mainCat) {
        mainCat[item.kategorie]?.push(item);
      }
    });

    return grouped;
  }, [items, hidePackedItems]);

  const mainCategories = Object.keys(itemsByMainCategory);
  const packedCount = items.filter(item => item.gepackt).length;
  const totalCount = items.length;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Packfortschritt</span>
            <span className="text-muted-foreground">{packedCount}/{totalCount} ({Math.round((packedCount / totalCount) * 100)}%)</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${(packedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={mainCategories[0] || "empty"} className="w-full">
        <TabsList className="grid grid-flow-col auto-cols-fr mb-4 overflow-x-auto w-full">
          {mainCategories.map((category) => (
            <TabsTrigger key={category} value={category} className="text-xs sm:text-sm">
              {category}
            </TabsTrigger>
          ))}
          {mainCategories.length === 0 && (
            <TabsTrigger value="empty" disabled>Keine Einträge</TabsTrigger>
          )}
        </TabsList>

        {mainCategories.map((mainCategory) => (
          <TabsContent key={mainCategory} value={mainCategory} className="space-y-4">
            {Object.entries(itemsByMainCategory[mainCategory] || {}).map(([category, categoryItems]) => (
              <Card key={category} className="overflow-hidden">
                <CardHeader className="py-3 pb-2">
                  <CardTitle className="text-base">{category}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {categoryItems.map((item) => (
                    <PackingItem
                      key={item.id}
                      id={item.id}
                      was={item.was}
                      anzahl={item.anzahl}
                      gepackt={item.gepackt}
                      bemerkung={item.bemerkung}
                      onToggle={onToggleItem}
                      onEdit={onEditItem}
                      onDelete={onDeleteItem}
                      details={item.details}
                      fullItem={item}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}

        {mainCategories.length === 0 && (
          <TabsContent value="empty" className="text-center py-12 text-muted-foreground">
            <p>Keine Einträge in der Packliste vorhanden.</p>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
