'use client';

import { useState, useEffect } from 'react';

interface PriceHistoryItem {
  price_history_id: number;
  item_id: number;
  price_month: string;
  unit_price: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  items: {
    item_code: string;
    item_name: string;
    spec: string | null;
    current_stock: number;
    price: number;
  };
}

interface SummaryStats {
  totalItems: number;
  itemsWithPrice: number;
  itemsWithoutPrice: number;
  totalStockValue: number;
  averageUnitPrice: number;
}

export default function PriceManagementPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalItems: 0,
    itemsWithPrice: 0,
    itemsWithoutPrice: 0,
    totalStockValue: 0,
    averageUnitPrice: 0
  });

  // Fetch price history data
  const fetchPriceHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/price-history?month=${selectedMonth}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch price history: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        setPriceHistory(result.data || []);
        calculateSummaryStats(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to fetch price history');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching price history';
      setError(errorMessage);
      console.error('Error fetching price history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const calculateSummaryStats = (data: PriceHistoryItem[]) => {
    const totalItems = data.length;
    // Count all items as having price (including 0), unless explicitly null/undefined
    const itemsWithPrice = data.filter(item => item.unit_price != null).length;
    const itemsWithoutPrice = totalItems - itemsWithPrice;
    const totalStockValue = data.reduce((sum, item) => {
      const stock = item.items.current_stock ?? 0;
      return sum + (stock * item.unit_price);
    }, 0);
    // For average, only include items with price > 0 to avoid skewing the average
    const itemsWithNonZeroPrice = data.filter(item => item.unit_price > 0);
    const averageUnitPrice = itemsWithNonZeroPrice.length > 0
      ? itemsWithNonZeroPrice.reduce((sum, item) => sum + item.unit_price, 0) / itemsWithNonZeroPrice.length
      : 0;

    setSummaryStats({
      totalItems,
      itemsWithPrice,
      itemsWithoutPrice,
      totalStockValue,
      averageUnitPrice
    });
  };

  // Initial load
  useEffect(() => {
    fetchPriceHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  // Handle month change
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  // Start editing a price
  const handleEditClick = (item: PriceHistoryItem) => {
    setEditingId(item.price_history_id);
    setEditPrice(item.unit_price.toString());
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditPrice('');
  };

  // Save edited price
  const handleSavePrice = async (item: PriceHistoryItem) => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      alert('유효한 단가를 입력해주세요.');
      return;
    }

    // Maximum value validation for PostgreSQL DECIMAL(15,2)
    if (newPrice > 9999999999999.99) {
      alert('단가가 너무 큽니다. 최대값: 9,999,999,999,999.99원');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/price-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          item_id: item.item_id,
          price_month: selectedMonth,
          unit_price: newPrice,
          note: item.note || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save price: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        // Update local state
        setPriceHistory(prevHistory =>
          prevHistory.map(historyItem =>
            historyItem.price_history_id === item.price_history_id
              ? {
                  ...historyItem,
                  unit_price: newPrice,
                  updated_at: new Date().toISOString()
                }
              : historyItem
          )
        );
        calculateSummaryStats(priceHistory.map(historyItem =>
          historyItem.price_history_id === item.price_history_id
            ? {
                ...historyItem,
                unit_price: newPrice
              }
            : historyItem
        ));
        setEditingId(null);
        setEditPrice('');
      } else {
        throw new Error(result.error || 'Failed to save price');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`단가 저장 실패: ${errorMessage}`);
      console.error('Error saving price:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle Enter key in edit mode
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, item: PriceHistoryItem) => {
    if (e.key === 'Enter') {
      handleSavePrice(item);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            월별 단가 관리
          </h1>
          <p className="text-muted-foreground">
            품목별 월 단가를 관리하고 재고 금액을 조회할 수 있습니다.
          </p>
        </div>

        {/* Month Selector */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <div className="flex items-center gap-4">
            <label htmlFor="month-selector" className="text-sm font-medium text-card-foreground">
              조회 월:
            </label>
            <input
              id="month-selector"
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <button
              onClick={fetchPriceHistory}
              disabled={loading}
              className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-lg transition-colors"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Summary Statistics */}
        {!loading && !error && priceHistory.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                전체 품목 수
              </div>
              <div className="text-2xl font-bold text-card-foreground">
                {summaryStats.totalItems.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                단가 입력 품목
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summaryStats.itemsWithPrice.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                단가 미입력 품목
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {summaryStats.itemsWithoutPrice.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                총 재고 금액
              </div>
              <div className="text-2xl font-bold text-primary">
                ₩{summaryStats.totalStockValue.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                평균 단가
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₩{summaryStats.averageUnitPrice.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">데이터를 불러오는 중...</p>
            </div>
          ) : priceHistory.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {error ? '데이터를 불러올 수 없습니다.' : '해당 월의 데이터가 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      품목코드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      품목명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      규격
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      단위
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      분류
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      현재고
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      단가 (₩)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      재고금액 (₩)
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {priceHistory.map((item) => (
                    <tr
                      key={item.price_history_id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {item.items.item_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {item.items.item_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {item.items.spec || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        -
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        -
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-foreground">
                        {(item.items.current_stock ?? 0).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {editingId === item.price_history_id ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, item)}
                            className="w-32 px-2 py-1 border border-primary rounded bg-background text-foreground text-right focus:ring-2 focus:ring-ring focus:border-transparent"
                            autoFocus
                            disabled={saving}
                          />
                        ) : (
                          <span
                            className="text-foreground cursor-pointer hover:text-primary"
                            onClick={() => handleEditClick(item)}
                          >
                            {item.unit_price.toLocaleString('ko-KR')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-foreground">
                        {((item.items.current_stock ?? 0) * item.unit_price).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {editingId === item.price_history_id ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSavePrice(item)}
                              disabled={saving}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-muted text-white rounded transition-colors text-xs"
                            >
                              {saving ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving}
                              className="px-3 py-1 bg-secondary hover:bg-secondary/80 disabled:bg-muted text-secondary-foreground rounded transition-colors text-xs"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditClick(item)}
                            className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded transition-colors text-xs"
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-card-foreground mb-2">
            사용 안내
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 단가 열을 클릭하여 직접 수정할 수 있습니다.</li>
            <li>• 수정 후 Enter 키를 누르거나 저장 버튼을 클릭하여 저장합니다.</li>
            <li>• Esc 키를 누르거나 취소 버튼을 클릭하여 수정을 취소할 수 있습니다.</li>
            <li>• 재고금액은 현재고 × 단가로 자동 계산됩니다.</li>
            <li>• 월을 변경하여 과거 단가 이력을 조회할 수 있습니다.</li>
          </ul>
        </div>
      </div>
  );
}
