/**
 * Price Comparison Table Component
 * Displays comparative price analysis across items
 */

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PriceCalculationModal, { PriceCalcResult } from '@/components/forms/PriceCalculationModal';
import { useToastNotification } from '@/hooks/useToast';
import {
  Search,
  Minus,
  ArrowUpDown,
  Calculator
} from 'lucide-react';

interface ComparisonData {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  current_price: number;
  avg_price_3m: number;
  avg_price_6m: number;
  min_price_6m: number;
  max_price_6m: number;
  price_variance: number;
  price_volatility: number;
  trend_direction: 'UP' | 'DOWN' | 'STABLE';
}

interface ComparisonTableProps {
  data: ComparisonData[];
  loading: boolean;
  className?: string;
}

type SortField = 'item_name' | 'current_price' | 'price_variance' | 'price_volatility';
type SortDirection = 'asc' | 'desc';

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  data,
  loading,
  className = ''
}) => {
  const toast = useToastNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [trendFilter, setTrendFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('item_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ComparisonData | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data.filter(item => {
      const matchesSearch =
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTrend =
        trendFilter === 'all' || item.trend_direction === trendFilter;

      return matchesSearch && matchesTrend;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'item_name') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue, 'ko')
          : bValue.localeCompare(aValue, 'ko');
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [data, searchTerm, trendFilter, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get trend badge variant
  const getTrendBadgeVariant = (trend: string) => {
    switch (trend) {
      case 'UP': return 'destructive';
      case 'DOWN': return 'default';
      case 'STABLE': return 'secondary';
      default: return 'outline';
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'UP': return ;
      case 'DOWN': return ;
      case 'STABLE': return <Minus className="h-3 w-3 mr-1" />;
      default: return null;
    }
  };

  // Get trend label
  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'UP': return '상승';
      case 'DOWN': return '하락';
      case 'STABLE': return '안정';
      default: return trend;
    }
  };

  // Get volatility color
  const getVolatilityColor = (volatility: number) => {
    if (volatility < 5) return 'text-gray-600';
    if (volatility < 15) return 'text-gray-600';
    return 'text-gray-600';
  };

  // Handle individual item price calculation
  const handleCalculatePrice = (item: ComparisonData) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  // Handle price calculation submission
  const handlePriceCalcSubmit = async (result: PriceCalcResult) => {
    try {
      if (selectedItems.size === 0 && selectedItem) {
        // Single item update
        const response = await fetch('/api/price-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: selectedItem.item_id,
            price_month: new Date().toISOString().slice(0, 7),
            unit_price: result.new_price,
            notes: `가격 계산 적용 (${result.increase_rate.toFixed(2)}% 인상)`
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '가격 업데이트 실패');
        }

        toast.저장완료(`${selectedItem.item_name} 가격이 업데이트되었습니다.`);
        setTimeout(() => window.location.reload(), 1000);
      } else if (selectedItems.size > 0) {
        // Bulk update
        const updates = Array.from(selectedItems).map(itemId => {
          const item = data.find(d => d.item_id === itemId);
          if (!item) return null;

          return {
            item_id: itemId,
            price_month: new Date().toISOString().slice(0, 7),
            unit_price: Math.round(item.current_price * (1 + result.increase_rate / 100)),
            notes: `일괄 가격 계산 (${result.increase_rate.toFixed(2)}% 인상)`
          };
        }).filter(u => u !== null);

        const response = await fetch('/api/price-history/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates,
            override_existing: false
          })
        });

        if (!response.ok) {
          throw new Error('일괄 업데이트 실패');
        }

        const result_data = await response.json();
        toast.저장완료(`${result_data.data.successful}개 품목 업데이트 완료`);
        if (result_data.data.failed > 0) {
          toast.경고(`${result_data.data.failed}개 품목 실패`);
        }
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error: any) {
      toast.저장실패(error.message || '가격 업데이트 중 오류가 발생했습니다.');
    }
  };

  // Sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDirection === 'asc' ?  : ;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-700 dark:border-gray-300"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedItems.size > 0 ? (
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {selectedItems.size}개 선택됨
            </span>
          ) : (
            <span>품목을 선택하여 일괄 가격 계산을 수행하세요</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (selectedItems.size === 0) {
                toast.입력오류('품목을 선택하세요.');
                return;
              }
              setSelectedItem(null);
              setShowModal(true);
            }}
            disabled={selectedItems.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Calculator className="w-4 h-4" />
            선택 품목 일괄 계산 ({selectedItems.size})
          </button>
          {selectedItems.size > 0 && (
            <button
              onClick={() => setSelectedItems(new Set())}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              선택 해제
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="품목명, 품목코드로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={trendFilter} onValueChange={setTrendFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="추세 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 추세</SelectItem>
            <SelectItem value="UP">상승 추세</SelectItem>
            <SelectItem value="DOWN">하락 추세</SelectItem>
            <SelectItem value="STABLE">안정 추세</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {processedData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          
          <p>비교할 데이터가 없습니다</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === processedData.length && processedData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(new Set(processedData.map(d => d.item_id)));
                      } else {
                        setSelectedItems(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-gray-800 focus:ring-2 focus:ring-gray-400 dark:text-gray-200 dark:focus:ring-gray-600"
                  />
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('item_name')}
                    className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
                  >
                    품목정보
                    <SortIndicator field="item_name" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('current_price')}
                    className="flex items-center gap-1 ml-auto hover:text-gray-900 dark:hover:text-white"
                  >
                    현재가
                    <SortIndicator field="current_price" />
                  </button>
                </TableHead>
                <TableHead className="text-right">3개월 평균</TableHead>
                <TableHead className="text-right">6개월 평균</TableHead>
                <TableHead className="text-right">가격 범위</TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('price_variance')}
                    className="flex items-center gap-1 ml-auto hover:text-gray-900 dark:hover:text-white"
                  >
                    편차율
                    <SortIndicator field="price_variance" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('price_volatility')}
                    className="flex items-center gap-1 ml-auto hover:text-gray-900 dark:hover:text-white"
                  >
                    변동성
                    <SortIndicator field="price_volatility" />
                  </button>
                </TableHead>
                <TableHead className="w-[100px]">추세</TableHead>
                <TableHead className="w-[120px] text-center">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.map((item) => (
                <TableRow key={item.item_id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.item_id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedItems);
                        if (e.target.checked) {
                          newSelected.add(item.item_id);
                        } else {
                          newSelected.delete(item.item_id);
                        }
                        setSelectedItems(newSelected);
                      }}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-gray-800 focus:ring-2 focus:ring-gray-400 dark:text-gray-200 dark:focus:ring-gray-600"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-xs text-muted-foreground">
                        [{item.item_code}] {item.spec}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      
                      <span className="font-semibold">
                        {item.current_price.toLocaleString('ko-KR')}
                      </span>
                      <span className="text-xs text-muted-foreground">/{item.unit}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-medium">
                    ₩{item.avg_price_3m.toLocaleString('ko-KR')}
                  </TableCell>

                  <TableCell className="text-right font-medium">
                    ₩{item.avg_price_6m.toLocaleString('ko-KR')}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="text-xs space-y-1">
                      <div className="text-gray-600">
                        최저: ₩{item.min_price_6m.toLocaleString('ko-KR')}
                      </div>
                      <div className="text-gray-600">
                        최고: ₩{item.max_price_6m.toLocaleString('ko-KR')}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <span className={`font-semibold ${
                      item.price_variance >= 0 ? 'text-gray-600' : 'text-gray-600'
                    }`}>
                      {item.price_variance >= 0 ? '+' : ''}
                      {item.price_variance.toFixed(2)}%
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    <span className={`font-semibold ${getVolatilityColor(item.price_volatility)}`}>
                      {item.price_volatility.toFixed(2)}%
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge variant={getTrendBadgeVariant(item.trend_direction)} className="flex items-center w-fit">
                      {getTrendIcon(item.trend_direction)}
                      {getTrendLabel(item.trend_direction)}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <button
                      onClick={() => handleCalculatePrice(item)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
                    >
                      <Calculator className="w-3 h-3" />
                      가격 계산
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Price Calculation Modal */}
      <PriceCalculationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedItem(null);
        }}
        onSubmit={handlePriceCalcSubmit}
        basePrice={selectedItem?.current_price || 0}
        itemName={selectedItem ? selectedItem.item_name : selectedItems.size > 0 ? `${selectedItems.size}개 품목` : ''}
      />

      {/* Summary */}
      {processedData.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pt-2">
          <div>
            총 <span className="font-semibold text-gray-900 dark:text-white">{processedData.length}</span>개 품목
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              
              <span>상승: {processedData.filter(i => i.trend_direction === 'UP').length}</span>
            </div>
            <div className="flex items-center gap-1">
              
              <span>하락: {processedData.filter(i => i.trend_direction === 'DOWN').length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Minus className="h-3 w-3 text-gray-600" />
              <span>안정: {processedData.filter(i => i.trend_direction === 'STABLE').length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonTable;
