'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';

interface PriceHistoryItem {
  price_history_id: number | null; // null이면 아직 저장 안됨
  item_id: number;
  price_month: string;
  unit_price: number;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_saved: boolean; // 새로 추가: 저장 여부
  item: {
    item_id: number;
    item_code: string;
    item_name: string;
    spec: string | null;
    current_stock: number;
    price: number;
    unit: string;
    category: string;
    vehicle_model: string | null;
  };
  bom_cost?: number;
  has_bom?: boolean;
  bom_cost_breakdown?: {
    material_cost: number;
    labor_cost: number;
    overhead_cost: number;
    scrap_revenue: number;
    net_cost: number;
  };
  is_modified?: boolean; // 새로 추가: 수정 여부
}

interface SummaryStats {
  totalItems: number;
  savedItems: number;        // 저장된 품목 수
  unsavedItems: number;      // 미저장 품목 수
  modifiedItems: number;     // 수정된 품목 수
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
  
  // 필터링 상태
  const [filters, setFilters] = useState({
    showUnsavedOnly: false,    // 단가 미입력 품목만 보기
    category: '',               // 카테고리 필터
    search: ''                  // 품목코드/품목명 검색
  });
  
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalItems: 0,
    savedItems: 0,
    unsavedItems: 0,
    modifiedItems: 0,
    totalStockValue: 0,
    averageUnitPrice: 0
  });

  // 일괄 조정 상태
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [bulkAdjustmentMode, setBulkAdjustmentMode] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(30);

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
        const items = result.data || [];
        
        // 1. 모든 item_id 추출
        const itemIds = items.map((item: PriceHistoryItem) => item.item_id);
        
        // 2. 배치 BOM 원가 조회 (타임아웃 및 에러 처리 개선)
        let bomCostMap: { [key: number]: any } = {};
        if (itemIds.length > 0) {
          try {
            // 타임아웃 설정: 30초
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const bomResponse = await fetch('/api/bom/cost/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                item_ids: itemIds,
                price_month: selectedMonth
              }),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (bomResponse.ok) {
              const bomResult = await bomResponse.json();
              bomCostMap = bomResult.data || {};
              console.log(`Batch BOM cost loaded: ${Object.keys(bomCostMap).length} items`);
            } else {
              console.warn('BOM cost API 응답 오류:', bomResponse.status, bomResponse.statusText);
            }
          } catch (err: any) {
            // 타임아웃 또는 네트워크 오류 처리
            if (err.name === 'AbortError') {
              console.warn('BOM cost 조회 타임아웃 (30초 초과). 기본 데이터만 표시합니다.');
            } else {
              console.warn('Failed to fetch batch BOM cost:', err);
            }
            // BOM cost 조회 실패해도 기본 데이터는 표시
          }
        }
        
        // 3. 결과 매핑 (BOM cost가 없어도 기본 데이터 표시)
        const dataWithBomCost = items.map((item: PriceHistoryItem) => {
          const bomData = bomCostMap[item.item_id];
          return {
            ...item,
            bom_cost: bomData?.cost_breakdown?.net_cost || 0,
            has_bom: bomData?.has_bom || false,
            bom_cost_breakdown: bomData?.cost_breakdown
          };
        });
        
        setPriceHistory(dataWithBomCost);
        calculateSummaryStats(dataWithBomCost);
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

  // 필터링된 데이터 생성
  const filteredData = useMemo(() => {
    let filtered = priceHistory;
    
    if (filters.showUnsavedOnly) {
      filtered = filtered.filter(item => !item.is_saved);
    }
    
    if (filters.category) {
      filtered = filtered.filter(item => item.item?.category === filters.category);
    }
    
    if (filters.search) {
      filtered = filtered.filter(item => 
        item.item?.item_code.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.item?.item_name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    
    return filtered;
  }, [priceHistory, filters.showUnsavedOnly, filters.category, filters.search]);

  // 페이지네이션 적용된 데이터
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  // 총 페이지 수
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // 수정된 품목들
  const modifiedItems = useMemo(() => {
    return priceHistory.filter(item => item.is_modified);
  }, [priceHistory]);

  // Calculate summary statistics
  const calculateSummaryStats = (data: PriceHistoryItem[]) => {
    const totalItems = data.length;
    const savedItems = data.filter(item => item.is_saved).length;
    const unsavedItems = data.filter(item => !item.is_saved).length;
    const modifiedItems = data.filter(item => item.is_modified).length;
    const totalStockValue = data.reduce((sum, item) => {
      const stock = item.item?.current_stock ?? 0;
      return sum + (stock * item.unit_price);
    }, 0);
    // For average, only include items with price > 0 to avoid skewing the average
    const itemsWithNonZeroPrice = data.filter(item => item.unit_price > 0);
    const averageUnitPrice = itemsWithNonZeroPrice.length > 0
      ? itemsWithNonZeroPrice.reduce((sum, item) => sum + item.unit_price, 0) / itemsWithNonZeroPrice.length
      : 0;

    setSummaryStats({
      totalItems,
      savedItems,
      unsavedItems,
      modifiedItems,
      totalStockValue,
      averageUnitPrice
    });
  };

  // Initial load
  useEffect(() => {
    fetchPriceHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  // Recalculate stats when priceHistory changes
  useEffect(() => {
    calculateSummaryStats(priceHistory);
  }, [priceHistory]);

  // Handle month change
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  // 단가 변경 감지
  const handlePriceChange = (itemId: number, newPrice: number) => {
    setPriceHistory(prevHistory =>
      prevHistory.map(historyItem =>
        historyItem.item_id === itemId
          ? {
              ...historyItem,
              unit_price: newPrice,
              is_modified: true
            }
          : historyItem
      )
    );
  };

  // 일괄 조정 관련 핸들러들
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(paginatedData.map(item => item.item_id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: number, checked: boolean) => {
    const newSelection = new Set(selectedItems);
    if (checked) {
      newSelection.add(itemId);
    } else {
      newSelection.delete(itemId);
    }
    setSelectedItems(newSelection);
  };

  const calculateAdjustedPrice = (currentPrice: number): number => {
    if (adjustmentType === 'percentage') {
      return Math.round(currentPrice * (1 + adjustmentValue / 100));
    } else {
      return currentPrice + adjustmentValue;
    }
  };

  const handleBulkAdjust = async () => {
    if (selectedItems.size === 0) {
      alert('조정할 품목을 선택해주세요');
      return;
    }

    const adjustedItems = Array.from(selectedItems).map(itemId => {
      const item = priceHistory.find(i => i.item_id === itemId);
      if (!item) return null;
      
      return {
        item_id: itemId,
        unit_price: calculateAdjustedPrice(item.unit_price),
        note: `일괄조정: ${adjustmentType === 'percentage' ? adjustmentValue + '%' : '₩' + adjustmentValue}`
      };
    }).filter(Boolean);

    const confirmed = confirm(
      `${selectedItems.size}개 품목의 단가를 조정하시겠습니까?\n` +
      `조정 방식: ${adjustmentType === 'percentage' ? '증감률 ' + adjustmentValue + '%' : '고정금액 ₩' + adjustmentValue}`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      const response = await fetch('/api/price-history/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prices: adjustedItems,
          price_month: selectedMonth + '-01',
          created_by: 'admin'
        })
      });

      if (response.ok) {
        alert(`${adjustedItems.length}개 품목의 단가가 조정되었습니다`);
        fetchPriceHistory();
        setSelectedItems(new Set());
        setBulkAdjustmentMode(false);
      }
    } catch (error) {
      alert('일괄 조정 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  // Start editing a price
  const handleEditClick = (item: PriceHistoryItem) => {
    setEditingId(item.price_history_id || item.item_id);
    setEditPrice(item.unit_price.toString());
  };

  // Cancel editing
  const handleCancelEdit = () => {
    // 수정 중이던 항목의 is_modified 플래그 초기화
    if (editingId !== null) {
      setPriceHistory(prevHistory =>
        prevHistory.map(item =>
          (item.price_history_id || item.item_id) === editingId
            ? { ...item, is_modified: false }
            : item
        )
      );
    }
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
          price_month: selectedMonth + '-01',
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
            historyItem.item_id === item.item_id
              ? {
                  ...historyItem,
                  unit_price: newPrice,
                  updated_at: new Date().toISOString(),
                  is_saved: true,
                  is_modified: false
                }
              : historyItem
          )
        );
        calculateSummaryStats(priceHistory.map(historyItem =>
          historyItem.item_id === item.item_id
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

  // 일괄 저장 함수
  const handleBatchSave = async () => {
    if (modifiedItems.length === 0) {
      alert('수정된 항목이 없습니다.');
      return;
    }
    
    if (!confirm(`${modifiedItems.length}개 품목의 단가를 저장하시겠습니까?`)) {
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/price-history/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prices: modifiedItems.map(item => ({
            item_id: item.item_id,
            unit_price: item.unit_price,
            note: item.note
          })),
          price_month: selectedMonth + '-01',
          created_by: 'admin'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`${result.data.count}개 품목의 단가가 저장되었습니다.`);
        fetchPriceHistory();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '일괄 저장 실패');
      }
    } catch (error) {
      console.error('Batch save failed:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`일괄 저장 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // 전월 단가 복사 함수
  const handleCopyFromPrevMonth = async () => {
    const currentDate = new Date(selectedMonth + '-01');
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = prevMonth.toISOString().slice(0, 7);
    
    if (!confirm(`${prevMonthStr}의 단가를 ${selectedMonth}로 복사하시겠습니까?\n\n경고: 기존 ${selectedMonth} 단가는 덮어쓰여집니다.`)) {
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/price-history/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromMonth: prevMonthStr + '-01',
          toMonth: selectedMonth + '-01'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const copiedCount = result.stats?.copied || 0;
          if (copiedCount === 0) {
            alert(`${prevMonthStr}에 저장된 단가가 없거나 모든 항목이 이미 존재합니다.`);
          } else {
            alert(`${copiedCount}개 품목의 단가를 복사했습니다.`);
          }
          fetchPriceHistory(); // 새로고침
        } else {
          throw new Error(result.error || '단가 복사 실패');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: '단가 복사 실패' }));
        throw new Error(errorData.error || '단가 복사 실패');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`단가 복사 중 오류가 발생했습니다: ${errorMessage}`);
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
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
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
              className="px-2 py-1 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-lg transition-colors text-xs whitespace-nowrap"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        {/* 필터링 섹션 */}
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* 단가 미입력 품목만 보기 */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showUnsavedOnly}
                onChange={(e) => {
                  setFilters({...filters, showUnsavedOnly: e.target.checked});
                  setCurrentPage(1);
                }}
                className="rounded border-input"
              />
              <span className="text-sm font-medium text-card-foreground">단가 미입력 품목만 보기</span>
            </label>
            
            {/* 카테고리 필터 */}
            <select
              value={filters.category}
              onChange={(e) => {
                setFilters({...filters, category: e.target.value});
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-input rounded-lg bg-background text-foreground"
            >
              <option value="">전체 카테고리</option>
              <option value="원자재">원자재</option>
              <option value="부자재">부자재</option>
              <option value="반제품">반제품</option>
              <option value="제품">제품</option>
            </select>
            
            {/* 검색 */}
            <input
              type="text"
              placeholder="품목코드/품목명 검색"
              value={filters.search}
              onChange={(e) => {
                setFilters({...filters, search: e.target.value});
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
            />

            {/* 일괄 저장 버튼 */}
            <button
              onClick={handleBatchSave}
              disabled={modifiedItems.length === 0 || saving}
              className={`px-2 py-1 rounded transition-colors text-xs whitespace-nowrap ${
                modifiedItems.length === 0 || saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              {saving ? '저장 중...' : `일괄 저장 (${modifiedItems.length}개)`}
            </button>

            {/* 전월 단가 복사 버튼 */}
            <button
              onClick={handleCopyFromPrevMonth}
              disabled={saving}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:bg-muted text-white rounded-lg transition-colors text-xs whitespace-nowrap"
            >
              전월 단가 가져오기
            </button>
          </div>

          {/* 일괄 조정 섹션 */}
          {selectedItems.size > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBulkAdjustmentMode(!bulkAdjustmentMode)}
                  className="px-2 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-xs whitespace-nowrap"
                >
                  일괄 조정 ({selectedItems.size}개)
                </button>
                
                {bulkAdjustmentMode && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={adjustmentType}
                      onChange={(e) => setAdjustmentType(e.target.value as 'percentage' | 'fixed')}
                      className="px-2 py-1 border border-input rounded-lg bg-background text-foreground text-xs"
                    >
                      <option value="percentage">증감률 (%)</option>
                      <option value="fixed">고정금액 (원)</option>
                    </select>
                    
                    <input
                      type="number"
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                      placeholder={adjustmentType === 'percentage' ? '5' : '1000'}
                      className="w-20 px-2 py-1 border border-input rounded-lg bg-background text-foreground text-xs"
                    />
                    
                    <button
                      onClick={handleBulkAdjust}
                      disabled={saving}
                      className="px-2 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-muted transition-colors text-xs whitespace-nowrap"
                    >
                      적용
                    </button>
                    
                    <button
                      onClick={() => setBulkAdjustmentMode(false)}
                      className="px-2 py-1 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-xs whitespace-nowrap"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
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
                저장된 품목
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {summaryStats.savedItems.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                미저장 품목
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {summaryStats.unsavedItems.toLocaleString('ko-KR')}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                수정된 품목
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {summaryStats.modifiedItems.toLocaleString('ko-KR')}
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
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-input"
                      />
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      품목코드
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      품목명
                    </th>
                    <th className="hidden md:table-cell px-2 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      규격
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      단위
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      분류
                    </th>
                    <th className="hidden lg:table-cell px-2 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      차종
                    </th>
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      현재고
                    </th>
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      단가 (₩)
                    </th>
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      재고금액 (₩)
                    </th>
                    {/* BOM 원가 컬럼 추가 */}
                    <th className="hidden xl:table-cell px-2 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      BOM 원가 (₩)
                    </th>
                    {/* 실제 수익 컬럼 추가 */}
                    <th className="hidden xl:table-cell px-2 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      실제 수익 (₩)
                    </th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {paginatedData.map((item) => (
                    <tr
                      key={item.price_history_id || item.item_id}
                      className={`hover:bg-muted/50 transition-colors ${
                        !item.is_saved ? 'bg-gray-50 dark:bg-gray-800/50' : ''
                      } ${
                        item.is_modified ? 'bg-gray-100 dark:bg-gray-800' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.item_id)}
                          onChange={(e) => handleSelectItem(item.item_id, e.target.checked)}
                          className="rounded border-input"
                        />
                      </td>
                      <td className="px-2 py-4 truncate text-sm font-medium text-foreground">
                        {item.item?.item_code || '-'}
                      </td>
                      <td className="px-2 py-4 truncate text-sm text-foreground">
                        {item.item?.item_name || '-'}
                      </td>
                      <td className="hidden md:table-cell px-2 py-4 truncate text-sm text-muted-foreground">
                        {item.item?.spec || '-'}
                      </td>
                      <td className="px-2 py-4 text-sm text-center text-muted-foreground">
                        {(item.item?.current_stock || 0).toLocaleString('ko-KR')}{item.item?.unit || '개'}
                      </td>
                      <td className="px-2 py-4 truncate text-sm text-muted-foreground">
                        {item.item?.category || '-'}
                      </td>
                      <td className="hidden lg:table-cell px-2 py-4 truncate text-sm text-muted-foreground">
                        {item.item?.vehicle_model || '-'}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-right font-medium text-foreground">
                        {(item.item?.current_stock ?? 0).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-right">
                        {editingId === (item.price_history_id || item.item_id) ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => {
                              setEditPrice(e.target.value);
                              const newPrice = parseFloat(e.target.value);
                              if (!isNaN(newPrice)) {
                                handlePriceChange(item.item_id, newPrice);
                              }
                            }}
                            onKeyDown={(e) => handleKeyDown(e, item)}
                            className="w-full max-w-28 px-2 py-1 border border-primary rounded bg-background text-foreground text-right focus:ring-2 focus:ring-ring focus:border-transparent"
                            autoFocus
                            disabled={saving}
                          />
                        ) : (
                          <span
                            className="text-foreground cursor-pointer hover:text-primary"
                            onClick={() => handleEditClick(item)}
                          >
                            {!item.is_saved && (
                              <span className="text-xs text-gray-800 dark:text-gray-700 mr-2">●</span>
                            )}
                            {item.unit_price.toLocaleString('ko-KR')}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-right font-medium text-foreground">
                        {((item.item?.current_stock ?? 0) * item.unit_price).toLocaleString('ko-KR')}
                      </td>
                      {/* BOM 원가 컬럼 추가 */}
                      <td className="hidden xl:table-cell px-2 py-4 whitespace-nowrap text-sm text-right">
                        {item.has_bom && item.bom_cost_breakdown ? (
                          <div className="relative group">
                            <span className="text-gray-700 dark:text-gray-300 font-semibold cursor-help">
                              {item.bom_cost_breakdown.net_cost.toLocaleString('ko-KR')}
                            </span>
                            <div className="hidden group-hover:block absolute z-10 bg-gray-900 text-white text-xs rounded p-2 w-48 right-0 top-0 transform -translate-y-full">
                              <div className="font-semibold mb-1">원가 구성</div>
                              <div>재료비: ₩{item.bom_cost_breakdown.material_cost.toLocaleString()}</div>
                              <div>가공비: ₩{item.bom_cost_breakdown.labor_cost.toLocaleString()}</div>
                              <div>간접비: ₩{item.bom_cost_breakdown.overhead_cost.toLocaleString()}</div>
                              <div className="text-gray-300">스크랩: -₩{item.bom_cost_breakdown.scrap_revenue.toLocaleString()}</div>
                              <div className="border-t border-gray-600 mt-1 pt-1 font-semibold">
                                순원가: ₩{item.bom_cost_breakdown.net_cost.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ) : item.has_bom ? (
                          <span className="text-gray-700 dark:text-gray-300 font-semibold">
                            {item.bom_cost?.toLocaleString('ko-KR') || '계산중...'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* 실제 수익 컬럼 추가 */}
                      <td className="hidden xl:table-cell px-2 py-4 whitespace-nowrap text-sm text-right">
                        {(() => {
                          const stock = item.item?.current_stock ?? 0;
                          const unitPrice = item.unit_price || 0;
                          const bomCost = item.has_bom && item.bom_cost_breakdown 
                            ? item.bom_cost_breakdown.net_cost 
                            : (item.bom_cost || 0);
                          
                          // 실제 수익 = (단가 - BOM 원가) × 재고수량
                          // BOM이 없는 경우는 계산하지 않음
                          if (!item.has_bom || bomCost === 0) {
                            return <span className="text-muted-foreground">-</span>;
                          }
                          
                          const profit = (unitPrice - bomCost) * stock;
                          const profitColor = profit >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400';
                          
                          return (
                            <span className={`font-semibold ${profitColor}`}>
                              {profit.toLocaleString('ko-KR')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-center">
                        {editingId === (item.price_history_id || item.item_id) ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSavePrice(item)}
                              disabled={saving}
                              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:bg-muted text-white rounded transition-colors text-xs"
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
              
              {/* 페이지네이션 컨트롤 */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-card">
                {/* 페이지당 항목 수 선택 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">페이지당:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1); // 첫 페이지로 리셋
                    }}
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-background text-foreground"
                  >
                    <option value={30}>30개</option>
                    <option value={50}>50개</option>
                    <option value={70}>70개</option>
                    <option value={100}>100개</option>
                  </select>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    총 {filteredData.length.toLocaleString()}개 중 {((currentPage - 1) * itemsPerPage + 1).toLocaleString()}-{Math.min(currentPage * itemsPerPage, filteredData.length).toLocaleString()}개 표시
                  </span>
                </div>

                {/* 페이지 이동 버튼 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground hover:bg-muted"
                  >
                    처음
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground hover:bg-muted"
                  >
                    이전
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground hover:bg-muted"
                  >
                    다음
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground hover:bg-muted"
                  >
                    마지막
                  </button>
                </div>
              </div>
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
