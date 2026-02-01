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
