import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from 'lucide-react';
import { EquipmentItem as DBEquipmentItem } from '@/lib/db';

interface EquipmentItemProps {
  id: string;
  was: string;
  kategorie_titel: string;
  hauptkategorie_titel: string;
  einzelgewicht?: number;
  standard_anzahl: number;
  status: string; // Should match DB status values
  details?: string;
  // links?: string[]; // Links are not in the DB schema for EquipmentItem directly
  onEdit: (id: string) => void;
}

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Ausgemustert':
      return 'destructive';
    case 'Fest Installiert':
      return 'default';
    case 'Immer gepackt':
      return 'secondary';
    default:
      return 'outline';
  }
};

export const EquipmentItem: React.FC<EquipmentItemProps> = ({
  id,
  was,
  kategorie_titel,
  hauptkategorie_titel,
  einzelgewicht,
  standard_anzahl,
  status,
  details,
  // links,
  onEdit
}) => {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow min-w-0">
            <CardTitle className="text-base">{was}</CardTitle>
            <CardDescription className="text-xs">
              {hauptkategorie_titel} / {kategorie_titel}
            </CardDescription>
          </div>
          <Badge variant={getStatusVariant(status)} className="shrink-0">
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {einzelgewicht !== undefined && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Gewicht</p>
              <p className="font-semibold">{einzelgewicht} kg</p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Standard-Anzahl</p>
            <p className="font-semibold">{standard_anzahl}</p>
          </div>
        </div>
        
        {details && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Details</p>
            <p className="text-sm">{details}</p>
          </div>
        )}
        
        {/* Links are not directly part of the DBEquipmentItem, so commenting out for now */}
        {/* {links && links.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Links</p>
            <div className="space-y-1">
              {links.map((link, index) => (
                <a 
                  key={index}
                  href={link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{new URL(link).hostname}</span>
                </a>
              ))}
            </div>
          </div>
        )} */}
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="outline" size="sm" onClick={() => onEdit(id)}>
          Bearbeiten
        </Button>
      </CardFooter>
    </Card>
  );
};

interface EquipmentListProps {
  items: DBEquipmentItem[];
  onEditItem: (id: string) => void;
  onAddItem: () => void;
  filterStatus?: string;
  filterCategory?: string;
  filterMainCategory?: string;
}

export const EquipmentList: React.FC<EquipmentListProps> = ({
  items,
  onEditItem,
  onAddItem,
  filterStatus,
  filterCategory,
  filterMainCategory
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Apply search filter
      if (searchTerm && !item.was.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Apply status filter
      if (filterStatus && item.status !== filterStatus) {
        return false;
      }
      
      // Apply category filters
      if (filterCategory && item.kategorie_titel !== filterCategory) {
        return false;
      }
      
      if (filterMainCategory && item.hauptkategorie_titel !== filterMainCategory) {
        return false;
      }
      
      return true;
    });
  }, [items, searchTerm, filterStatus, filterCategory, filterMainCategory]);

  const totalWeight = filteredItems.reduce((sum, item) => sum + (item.einzelgewicht || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-grow">
          <Input
            placeholder="Suche nach Ausrüstungsgegenständen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <Button onClick={onAddItem} className="sm:w-auto">
          Neuer Gegenstand
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {filteredItems.length} von {items.length} Gegenstände
        </p>
        {totalWeight > 0 && (
          <p className="text-muted-foreground">
            Gesamtgewicht: <span className="font-semibold">{totalWeight.toFixed(2)} kg</span>
          </p>
        )}
      </div>
      
      <div className="space-y-3">
        {filteredItems.map(item => (
          <EquipmentItem
            key={item.id}
            id={item.id}
            was={item.was}
            kategorie_titel={item.kategorie_titel}
            hauptkategorie_titel={item.hauptkategorie_titel}
            einzelgewicht={item.einzelgewicht}
            standard_anzahl={item.standard_anzahl}
            status={item.status}
            details={item.details}
            onEdit={onEditItem}
          />
        ))}
        
        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">Keine Gegenstände gefunden.</p>
          </div>
        )}
      </div>
    </div>
  );
};
