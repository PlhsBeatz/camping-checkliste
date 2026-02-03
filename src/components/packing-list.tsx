
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Truck } from "lucide-react";
import { useMemo } from "react";
import { PackingItem as DBPackingItem } from "@/lib/db";

interface PackingItemProps {
  id: string;
  was: string;
  anzahl: number;
  gepackt: boolean;
  bemerkung?: string | null;
  transport_name?: string | null;
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte';
  mitreisende: Array<{ mitreisender_id: string; mitreisender_name: string; gepackt: boolean }>;
  onToggle: (id: string) => void;
  onToggleMitreisender: (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => void;
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
  transport_name,
  mitreisenden_typ,
  mitreisende,
  onToggle,
  onToggleMitreisender,
  onEdit,
  onDelete,
  details,
  fullItem
}) => {
  const isFullyPacked = useMemo(() => {
    if (mitreisenden_typ === 'pauschal') {
      return gepackt;
    }
    return mitreisende.length > 0 && mitreisende.every(m => m.gepackt);
  }, [mitreisenden_typ, gepackt, mitreisende]);

  return (
    <div className={`p-3 border-b transition-colors ${isFullyPacked ? 'bg-muted/50' : 'hover:bg-muted/30'}`}>
      <div className="flex items-start space-x-3">
        {mitreisenden_typ === 'pauschal' && (
          <Checkbox
            id={`item-${id}`}
            checked={gepackt}
            onCheckedChange={() => onToggle(id)}
            className="mt-0.5"
          />
        )}
        
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <label
              htmlFor={`item-${id}`}
              className={`text-sm font-medium leading-none ${mitreisenden_typ === 'pauschal' ? 'cursor-pointer' : ''} ${isFullyPacked ? 'line-through text-muted-foreground' : ''}`}
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
          
          {(mitreisenden_typ === 'alle' || mitreisenden_typ === 'ausgewaehlte') && mitreisende.length > 0 && (
            <div className="mt-2 space-y-1">
              {mitreisende.map((m) => (
                <div key={m.mitreisender_id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`item-${id}-mitreisender-${m.mitreisender_id}`}
                    checked={m.gepackt}
                    onCheckedChange={() => onToggleMitreisender(id, m.mitreisender_id, m.gepackt)}
                    className="h-3.5 w-3.5"
                  />
                  <label
                    htmlFor={`item-${id}-mitreisender-${m.mitreisender_id}`}
                    className={`text-xs cursor-pointer ${m.gepackt ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {m.mitreisender_name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex gap-1 flex-shrink-0">
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
    </div>
  );
};

interface PackingListProps {
  items: DBPackingItem[];
  onToggleItem: (id: string) => void;
  onToggleMitreisender: (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => void;
  onEditItem: (item: DBPackingItem) => void;
  onDeleteItem: (id: string) => void;
  hidePackedItems?: boolean;
}

export const PackingList: React.FC<PackingListProps> = ({
  items,
  onToggleItem,
  onToggleMitreisender,
  onEditItem,
  onDeleteItem,
  hidePackedItems = false
}) => {
  const itemsByMainCategory = useMemo(() => {
    const grouped: Record<string, Record<string, DBPackingItem[]>> = {};

    items.forEach(item => {
      const isFullyPacked = item.mitreisenden_typ === 'pauschal' 
        ? item.gepackt 
        : item.mitreisende.length > 0 && item.mitreisende.every(m => m.gepackt);
      
      if (hidePackedItems && isFullyPacked) return;

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

  const { packedCount, totalCount } = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.mitreisenden_typ === 'pauschal') {
        acc.total += 1;
        if (item.gepackt) acc.packed += 1;
      } else {
        acc.total += item.mitreisende.length;
        acc.packed += item.mitreisende.filter(m => m.gepackt).length;
      }
      return acc;
    }, { packed: 0, total: 0 });
  }, [items]);

  const mainCategories = Object.keys(itemsByMainCategory);

  if (!items) {
    return <div>Lade Packliste...</div>;
  }

  return (
    <div className="space-y-4">
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Packfortschritt</span>
            <span className="text-muted-foreground">{packedCount}/{totalCount} ({totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${totalCount > 0 ? (packedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

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
                      transport_name={item.transport_name}
                      mitreisenden_typ={item.mitreisenden_typ}
                      mitreisende={item.mitreisende}
                      onToggle={onToggleItem}
                      onToggleMitreisender={onToggleMitreisender}
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
