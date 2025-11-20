'use client';

import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import ProcessStatusBadge from '@/components/process/ProcessStatusBadge';
import type { CoilTraceabilityChain } from '@/types/coil';

export default function CoilTraceabilityView() {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [traceabilityChain, setTraceabilityChain] = useState<CoilTraceabilityChain | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchTraceability = async (itemId: number) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/coil/traceability/${itemId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '추적성 정보를 불러올 수 없습니다.');
      }

      setTraceabilityChain(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemSelect = () => {
    // TODO: Open ItemSelector modal
    const itemId = prompt('품목 ID를 입력하세요:');
    if (itemId) {
      const id = parseInt(itemId);

      // Fetch item details
      fetch(`/api/items/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setSelectedItem(data.data);
            setSelectedItemId(id);
            fetchTraceability(id);
          }
        })
        .catch(() => setError('품목 정보를 불러올 수 없습니다.'));
    }
  };

  const formatNumber = (value: number) => value.toLocaleString('ko-KR');

  const getYieldRateColor = (yieldRate: number) => {
    if (yieldRate >= 95) return 'text-green-600 dark:text-green-400';
    if (yieldRate >= 90) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">공정 추적성</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          품목의 상류/하류 공정 이력을 추적합니다.
        </p>
      </div>

      {/* 품목 선택 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">추적할 품목 선택</label>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={selectedItem ? `${selectedItem.item_code} - ${selectedItem.item_name}` : ''}
            onClick={handleItemSelect}
            placeholder="품목을 선택하려면 클릭하세요"
            readOnly
            className="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 cursor-pointer bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
          <button
            onClick={handleItemSelect}
            className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap"
          >
            조회
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          추적성 정보를 불러오는 중...
        </div>
      )}

      {/* 추적성 체인 표시 */}
      {!isLoading && traceabilityChain && (
        <>
          {/* 통계 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">선택된 품목</div>
              <div className="text-lg font-bold mt-1 text-gray-900 dark:text-gray-100">
                {traceabilityChain.item_code} {traceabilityChain.item_name}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">상류 공정 (이 품목을 생산)</div>
              <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {traceabilityChain.upstream.length}개
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">하류 공정 (이 품목을 사용)</div>
              <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                {traceabilityChain.downstream.length}개
              </div>
            </div>
          </div>

          {/* 상류/하류 공정 표시 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 상류 공정 (Upstream) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-blue-600 dark:text-blue-400">⬆</span>
                상류 공정 (이 품목을 생산한 공정)
              </h2>

              {traceabilityChain.upstream.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  상류 공정이 없습니다.
                  <br />
                  <span className="text-sm">이 품목은 최초 투입 자재입니다.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {traceabilityChain.upstream.map((process) => (
                    <div
                      key={process.process_id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* 공정 헤더 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            #{process.process_id} {process.process_type}
                          </span>
                          <ProcessStatusBadge status={process.status as any} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(process.process_date).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      {/* 투입 정보 */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 mb-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">투입 (소스)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{process.source_item_name}</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.input_quantity)}
                        </div>
                      </div>

                      {/* 화살표 */}
                      <div className="text-center text-2xl text-gray-400 dark:text-gray-500 my-1">↓</div>

                      {/* 산출 정보 (현재 품목) */}
                      <div className="bg-blue-50 dark:bg-blue-900 rounded p-3">
                        <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">산출 (타겟)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {traceabilityChain.item_code} {traceabilityChain.item_name}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.output_quantity)}
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                          <span className="text-sm text-gray-900 dark:text-gray-100">수율: </span>
                          <span className={`text-sm font-semibold ${getYieldRateColor(process.yield_rate)}`}>
                            {process.yield_rate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 하류 공정 (Downstream) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-green-600 dark:text-green-400">⬇</span>
                하류 공정 (이 품목을 사용한 공정)
              </h2>

              {traceabilityChain.downstream.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  하류 공정이 없습니다.
                  <br />
                  <span className="text-sm">이 품목은 최종 제품이거나 아직 사용되지 않았습니다.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {traceabilityChain.downstream.map((process) => (
                    <div
                      key={process.process_id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* 공정 헤더 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            #{process.process_id} {process.process_type}
                          </span>
                          <ProcessStatusBadge status={process.status as any} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(process.process_date).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      {/* 투입 정보 (현재 품목) */}
                      <div className="bg-green-50 dark:bg-green-900 rounded p-3 mb-2">
                        <div className="text-xs text-green-600 dark:text-green-400 mb-1">투입 (소스)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {traceabilityChain.item_code} {traceabilityChain.item_name}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.input_quantity)}
                        </div>
                      </div>

                      {/* 화살표 */}
                      <div className="text-center text-2xl text-gray-400 dark:text-gray-500 my-1">↓</div>

                      {/* 산출 정보 */}
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">산출 (타겟)</div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{process.target_item_name}</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          수량: {formatNumber(process.output_quantity)}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-sm text-gray-900 dark:text-gray-100">수율: </span>
                          <span className={`text-sm font-semibold ${getYieldRateColor(process.yield_rate)}`}>
                            {process.yield_rate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 초기 상태 (품목 미선택) */}
      {!isLoading && !traceabilityChain && !error && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-4">
            <BarChart3 className="w-20 h-20 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            추적성을 확인할 품목을 선택하세요.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            선택한 품목의 상류/하류 공정 이력을 조회할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
