import React from 'react';
import { RefreshCw, Package, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
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
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
      <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
              BOM 확인 오류
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-2 text-sm text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 underline"
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
        <Package className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
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
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">
                생산 불가능
              </h4>
              <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
                {summary.insufficient_items}개 자재의 재고가 부족하여 생산할 수 없습니다. 자재를 입고한 후 다시 시도해주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {/* Total BOM Items */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">총 자재 수</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.total_bom_items}
          </p>
        </div>

        {/* Sufficient Items */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-green-700 dark:text-green-400">충족 품목</span>
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300">
            {summary.sufficient_items}
          </p>
        </div>

        {/* Insufficient Items */}
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-xs text-red-700 dark:text-red-400">부족 품목</span>
          </div>
          <p className="text-2xl font-bold text-red-900 dark:text-red-300">
            {summary.insufficient_items}
          </p>
        </div>

        {/* Can Produce */}
        <div className={`p-3 rounded-lg border ${
          can_produce
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {can_produce ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
            <span className={`text-xs ${
              can_produce
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }`}>
              생산가능여부
            </span>
          </div>
          <p className={`text-2xl font-bold ${
            can_produce
              ? 'text-green-900 dark:text-green-300'
              : 'text-red-900 dark:text-red-300'
          }`}>
            {can_produce ? '가능' : '불가'}
          </p>
        </div>
      </div>

      {/* Materials Table */}
      <div className="p-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                  품목코드
                </th>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                  품목명
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                  소요량(U/S)
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                  필요수량
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                  현재재고
                </th>
                <th className="text-right py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                  부족량
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {bom_items.map((item) => {
                const status = getStockStatus(item);
                const rowBgClass = status === 'insufficient'
                  ? 'bg-red-50 dark:bg-red-900/10'
                  : status === 'warning'
                  ? 'bg-yellow-50 dark:bg-yellow-900/10'
                  : '';

                return (
                  <tr
                    key={item.bom_id}
                    className={`border-b border-gray-100 dark:border-gray-700 last:border-0 ${rowBgClass}`}
                  >
                    <td className="py-2 px-3 text-gray-900 dark:text-white font-mono text-xs">
                      {item.item_code}
                    </td>
                    <td className="py-2 px-3 text-gray-900 dark:text-white">
                      <div className="font-medium">{item.item_name}</div>
                      {item.spec && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.spec}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-700 dark:text-gray-300">
                      {(item.required_quantity / production_quantity).toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900 dark:text-white font-medium">
                      {item.required_quantity.toLocaleString('ko-KR')} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                      {item.available_stock.toLocaleString('ko-KR')} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {item.shortage > 0 ? (
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {item.shortage.toLocaleString('ko-KR')} {item.unit}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
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
                  ? 'text-green-600 dark:text-green-400'
                  : summary.fulfillment_rate >= 80
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
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
