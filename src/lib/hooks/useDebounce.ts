import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for debouncing function calls
 *
 * Delays execution of a function until after a specified wait period
 * has elapsed since the last time it was invoked. Useful for optimizing
 * performance by reducing the frequency of expensive operations like
 * API calls, search queries, or real-time validation.
 *
 * @template T - Function type to debounce
 * @param {T} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds (default: 500ms)
 * @returns {T} Debounced version of the callback function
 *
 * @example
 * const handleSearch = (query: string) => {
 *   console.log('Searching for:', query);
 * };
 *
 * const debouncedSearch = useDebounce(handleSearch, 300);
 *
 * // Call multiple times rapidly
 * debouncedSearch('a');
 * debouncedSearch('ab');
 * debouncedSearch('abc'); // Only this will execute after 300ms
 *
 * @example
 * // BOM check with debounce
 * const { checkBom } = useBomCheck();
 * const debouncedCheckBom = useDebounce(checkBom, 500);
 *
 * const handleQuantityChange = (newQuantity: number) => {
 *   debouncedCheckBom(productItemId, newQuantity);
 * };
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedCallback;
}
