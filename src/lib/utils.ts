import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Debounce function for search inputs and other delayed actions
 * Ensures cleanup on unmount to avoid setState warnings (Codex-validated)
 *
 * @param func - Function to debounce
 * @param wait - Delay in milliseconds (default: 300ms)
 * @returns Debounced function with cancel method for cleanup
 *
 * @example
 * ```typescript
 * const debouncedSearch = useMemo(
 *   () => debounce((value: string) => setSearchTerm(value), 300),
 *   []
 * );
 *
 * // Cleanup on unmount
 * useEffect(() => {
 *   return () => debouncedSearch.cancel();
 * }, [debouncedSearch]);
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  // Add cancel method for cleanup on unmount (Codex recommendation)
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}
