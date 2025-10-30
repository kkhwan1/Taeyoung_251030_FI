import React from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { BOMCheckResponse, BOMCheckItem } from '@/types/inventory';
import BOMStatusBadge from './BOMStatusBadge';

interface BOMPreviewPanelProps {
  bomCheckData: BOMCheckResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

/**
 * BOM Preview Panel Component
 *
 * Displays real-time BOM material availability check results with:
 * - Summary cards showing key metrics (total items, sufficient, insufficient, can produce)
 * - Detailed materials table with stock status for each BOM item
 * - Color-coded visual indicators for material availability
 * - Warning banner when production cannot proceed due to insufficient materials
 *
 * @param bomCheckData - BOM check API response data
 * @param loading - Loading state during API call
 * @param error - Error message if API call fails
 * @param onRefresh - Optional callback to refresh BOM check
 *
 * @example
 * const { data, loading, error, checkBom } = useBomCheck();
 *
 * <BOMPreviewPanel
 *   bomCheckData={data}
 *   loading={loading}
 *   error={error}
 *   onRefresh={() => checkBom(productItemId, quantity)}
 * />
 */
export default function BOMPreviewPanel({
  bomCheckData,
  loading,
  error,
  onRefresh
}: BOMPreviewPanelProps) {
  // Loading state with skeleton loaders
  if (loading) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            BOM 자재 확인
          </h3>
          <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/20">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 mb-1">
              BOM 확인 오류
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-400">{error}</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-2 text-sm text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 underline"
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no BOM check performed yet
  if (!bomCheckData) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 bg-gray-50 dark:bg-gray-800/50 text-center">
        
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          BOM 자재 확인 대기 중
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          제품과 생산수량을 선택하면 자재 소요량을 확인할 수 있습니다.
        </p>
      </div>
    );
  }

  const { product_info, production_quantity, can_produce, bom_items, summary } = bomCheckData;

  // Determine stock status for badge
  const getStockStatus = (item: BOMCheckItem) => {
    if (item.sufficient) return 'sufficient';
    if (item.available_stock > 0) return 'warning';
    return 'insufficient';
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            BOM 자재 확인
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {product_info.item_name} ({product_info.item_code}) - 생산수량: {production_quantity}{product_info.unit}
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Warning Banner - Only show when cannot produce */}
      {!can_produce && (
        <div className="mx-4 mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">
                재고 부족으로 생산 불가능
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                현재 재고로는 <span className="font-bold">{summary.max_producible_quantity.toLocaleString('ko-KR')} {product_info.unit}</span>까지만 생산 가능합니다.
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                희망 수량: <span className="font-semibold">{production_quantity.toLocaleString('ko-KR')} {product_info.unit}</span> → 
                부족 수량: <span className="font-bold text-red-600 dark:text-red-400">{summary.shortage_quantity.toLocaleString('ko-KR')} {product_info.unit}</span>
              </p>
              {summary.bottleneck_item && (
                <p className="text-xs text-orange-600 dark:text-orange-500 mt-2">
                  병목 자재: <span className="font-medium">{summary.bottleneck_item.item_name}</span> 
                  (현재재고: {summary.bottleneck_item.available_stock.toLocaleString('ko-KR')} EA, 
                  필요량: {summary.bottleneck_item.required_for_requested.toLocaleString('ko-KR')} EA)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
        {/* Total BOM Items */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">총 자재 수</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.total_bom_items}
          </p>
        </div>

        {/* Sufficient Items */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-xs text-gray-700 dark:text-gray-400">충족 품목</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-300">
            {summary.sufficient_items}
          </p>
        </div>

        {/* Insufficient Items */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-xs text-gray-700 dark:text-gray-400">부족 품목</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-300">
            {summary.insufficient_items}
          </p>
        </div>
      </div>

      {/* Production Capacity Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 pb-4">
        {/* Requested Quantity */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-blue-700 dark:text-blue-400">희망 생산수량</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
            {production_quantity.toLocaleString('ko-KR')}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">
            {product_info.unit}
          </p>
        </div>

        {/* Max Producible Quantity */}
        <div className={`p-3 rounded-lg border ${
          summary.max_producible_quantity >= production_quantity
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs ${
              summary.max_producible_quantity >= production_quantity
                ? 'text-green-700 dark:text-green-400'
                : 'text-orange-700 dark:text-orange-400'
            }`}>
              최대 생산가능
            </span>
          </div>
          <p className={`text-2xl font-bold ${
            summary.max_producible_quantity >= production_quantity
              ? 'text-green-900 dark:text-green-300'
              : 'text-orange-900 dark:text-orange-300'
          }`}>
            {summary.max_producible_quantity.toLocaleString('ko-KR')}
          </p>
          <p className={`text-xs mt-0.5 ${
            summary.max_producible_quantity >= production_quantity
              ? 'text-green-600 dark:text-green-500'
              : 'text-orange-600 dark:text-orange-500'
          }`}>
            {product_info.unit}
          </p>
        </div>

        {/* Shortage Quantity */}
        {summary.shortage_quantity > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-red-700 dark:text-red-400">부족 수량</span>
            </div>
            <p className="text-2xl font-bold text-red-900 dark:text-red-300">
              {summary.shortage_quantity.toLocaleString('ko-KR')}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              {product_info.unit}
            </p>
          </div>
        )}
      </div>

      {/* Materials Table */}
      <div className="p-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle">
                  품목코드
                </th>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle">
                  품목명
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle">
                  소요량(U/S)
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle whitespace-nowrap">
                  필요수량
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle whitespace-nowrap">
                  현재재고
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle whitespace-nowrap">
                  부족량
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle whitespace-nowrap">
                  이 자재로 생산가능
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-700 dark:text-gray-300 align-middle">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {bom_items.map((item) => {
                const status = getStockStatus(item);
                const rowBgClass = status === 'insufficient'
                  ? 'bg-gray-50 dark:bg-gray-900/10'
                  : status === 'warning'
                  ? 'bg-gray-50 dark:bg-gray-900/10'
                  : '';

                return (
                  <tr
                    key={item.bom_id}
                    className={`border-b border-gray-100 dark:border-gray-700 last:border-0 ${rowBgClass}`}
                  >
                    <td className="py-2 px-3 text-gray-900 dark:text-white font-mono text-xs align-middle">
                      {item.item_code}
                    </td>
                    <td className="py-2 px-3 text-gray-900 dark:text-white align-middle">
                      <div className="font-medium">{item.item_name}</div>
                      {item.spec && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.spec}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-700 dark:text-gray-300 align-middle whitespace-nowrap">
                      {(item.required_quantity / production_quantity).toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900 dark:text-white font-medium whitespace-nowrap">
                      {item.required_quantity.toLocaleString('ko-KR')} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {item.available_stock.toLocaleString('ko-KR')} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {item.shortage > 0 ? (
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          {item.shortage.toLocaleString('ko-KR')} {item.unit}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className={`py-2 px-3 text-right whitespace-nowrap ${
                      item.max_producible_by_this_item === summary.max_producible_quantity
                        ? 'font-bold text-orange-600 dark:text-orange-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {item.max_producible_by_this_item.toLocaleString('ko-KR')} {product_info.unit}
                    </td>
                    <td className="py-2 px-3 text-center align-middle">
                      <BOMStatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">총 소요 금액:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                ₩{summary.total_required_value.toLocaleString('ko-KR')}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">총 재고 금액:</span>
              <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                ₩{summary.total_available_value.toLocaleString('ko-KR')}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">충족률:</span>
              <span className={`ml-2 font-semibold ${
                summary.fulfillment_rate >= 100
                  ? 'text-gray-600 dark:text-gray-400'
                  : summary.fulfillment_rate >= 80
                  ? 'text-gray-600 dark:text-gray-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {summary.fulfillment_rate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
