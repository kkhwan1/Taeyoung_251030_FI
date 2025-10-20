import { useState, useCallback } from 'react';
import { BOMCheckResponse } from '@/types/inventory';

interface UseBomCheckReturn {
  data: BOMCheckResponse | null;
  loading: boolean;
  error: string | null;
  checkBom: (productItemId: number, quantity: number) => Promise<void>;
}

/**
 * Custom hook for checking BOM material availability before production
 *
 * @returns {UseBomCheckReturn} Hook state and checkBom function
 *
 * @example
 * const { data, loading, error, checkBom } = useBomCheck();
 *
 * // Check BOM availability
 * await checkBom(productItemId, quantity);
 *
 * // Access results
 * if (data?.can_produce) {
 *   console.log('Can produce:', data.production_quantity);
 * }
 */
export function useBomCheck(): UseBomCheckReturn {
  const [data, setData] = useState<BOMCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkBom = useCallback(async (productItemId: number, quantity: number) => {
    // Reset state for invalid inputs
    if (!productItemId || quantity <= 0) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/inventory/production/bom-check?product_item_id=${productItemId}&quantity=${quantity}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'BOM 확인 중 오류가 발생했습니다.');
      }

      setData(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'BOM 확인에 실패했습니다.';
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, checkBom };
}
