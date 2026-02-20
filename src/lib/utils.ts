import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class names using clsx and tailwind-merge
 * This allows for conditional and dynamic class names while avoiding conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a UUID v4 for client-side use
 * Used for creating new items before they're saved to the database
 */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formats a weight value with the appropriate unit
 */
export function formatWeight(weight: number | null | undefined): string {
  if (weight === null || weight === undefined) return "-";
  return `${weight.toFixed(2)} kg`;
}

/**
 * Formatiert eine Zahl mit deutschem Tausendertrennzeichen für die Anzeige in Gewichtsfeldern.
 * z.B. 1234.56 -> "1.234,56"
 */
export function formatWeightForDisplay(weight: number | null | undefined): string {
  if (weight === null || weight === undefined || isNaN(weight)) return "";
  return weight.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true
  });
}

/**
 * Parst einen Benutzereingabe-String zu einer Zahl (ohne Tausendertrennzeichen).
 * Erlaubt: Ziffern, ein Komma oder Punkt als Dezimaltrennzeichen.
 */
export function parseWeightInput(value: string): number | null {
  if (!value || value.trim() === "") return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Bereinigt Benutzereingabe: nur Ziffern, Komma und Punkt erlauben.
 */
export function sanitizeWeightInput(value: string): string {
  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  let out = value.replace(/[^\d.,]/g, "");
  if (hasComma && hasDot) {
    const lastComma = out.lastIndexOf(",");
    const lastDot = out.lastIndexOf(".");
    out = lastComma > lastDot ? out.replace(/\./g, "") : out.replace(/,/g, "");
  }
  const parts = out.split(/[.,]/);
  if (parts.length > 2) {
    out = parts[0] + (parts[1]?.charAt(0) === "" ? "." : "." + parts[1]) + (parts[2] ?? "");
  }
  return out;
}

/**
 * Calculates the total weight for a transport vehicle
 */
export function calculateTotalWeight(
  items: Array<{ weight: number | null; quantity: number }>,
  vehicleBaseWeight: number
): number {
  const itemsWeight = items.reduce((total, item) => {
    if (item.weight === null) return total;
    return total + item.weight * item.quantity;
  }, 0);
  
  return vehicleBaseWeight + itemsWeight;
}

/**
 * Groups items by a specific property
 */
export function groupBy<T, K extends PropertyKey>(
  items: T[],
  getKey: (item: T) => K
): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/**
 * Generiert 2-Buchstaben-Initialen für einen Namen.
 * - 2+ Wörter: erster Buchstabe der ersten zwei Wörter (z.B. "Max Mustermann" -> "MM")
 * - 1 Wort: erste 2 Zeichen (z.B. "Andi" -> "AN", "Melli" -> "ME")
 *
 * Bei Duplikaten (gleiche Basis-Initialen bei mehreren Personen) wird
 * 1.+3. Buchstabe genutzt (z.B. Luca -> "LC", Luisa -> "LI").
 *
 * @param name Der Name
 * @param allNames Alle Namen im Kontext (z.B. alle Mitreisenden) für Duplikat-Vermeidung
 */
export function getInitials(name: string, allNames?: string[]): string {
  const getBase = (n: string) => {
    const t = n.trim()
    if (!t) return '??'
    const parts = t.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
    }
    const s = t.substring(0, 2).toUpperCase()
    return s.length >= 2 ? s : (s + (s[0] ?? '')).substring(0, 2)
  }

  const base = getBase(name)
  if (!allNames || allNames.length === 0) return base

  const duplicates = allNames.filter((n) => getBase(n.trim()) === base)
  if (duplicates.length >= 2) {
    const t = name.trim()
    const first = (t[0] ?? '').toUpperCase()
    const third = (t[2] ?? t[1] ?? '').toUpperCase()
    const alt = (first + third).substring(0, 2)
    return alt || base
  }
  return base
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
