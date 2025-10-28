'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Plus
} from 'lucide-react';
import StockAdjustmentForm from '@/components/StockAdjustmentForm';
import { StockExportButton } from '@/components/ExcelExportButton';

interface StockItem {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  item_type: string;
  current_stock: number;
  unit_price: number;
  stock_value: number;
  safety_stock: number;
  is_low_stock: boolean;
}

interface StockHistory {
  transaction_id: number;
  transaction_date: string;
  transaction_type: string;
  item_name?: string;
  item_code?: string;
  quantity: number;
  quantity_change?: number;
  stock_balance?: number;
  reference_number?: string;
  reference_no?: string;
  company_name?: string;
  notes?: string;
}

export default function StockPage() {
  const [activeTab, setActiveTab] = useState('current');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);

  // 실시간 재고 현황 조회
  const fetchStockItems = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stock');
      const result = await response.json();

      if (result.success) {
        setStockItems(Array.isArray(result.data) ? result.data : []);
      } else {
        alert(`재고 조회 실패: ${result.error}`);
        setStockItems([]);
      }
    } catch (error) {
      console.error('재고 조회 오류:', error);
      alert('재고 조회 중 오류가 발생했습니다.');
      setStockItems([]);
    } finally {
      setLoading(false);
    }
  };

  // 재고 이동 이력 조회
  const fetchStockHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stock/history');
      const result = await response.json();

      if (result.success) {
        // API returns result.data.history, not result.data.transactions
        setStockHistory(result.data.history || []);
      } else {
        alert(`이력 조회 실패: ${result.error}`);
        setStockHistory([]);
      }
    } catch (error) {
      console.error('이력 조회 오류:', error);
      alert('이력 조회 중 오류가 발생했습니다.');
      setStockHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'current') {
      fetchStockItems();
    } else if (activeTab === 'history') {
      fetchStockHistory();
    } else if (activeTab === 'adjustment') {
      // 재고 조정 탭이 활성화되면 이력도 로드
      fetchStockHistory();
    }
  }, [activeTab]);

  // 필터링된 재고 항목
  const filteredStockItems = Array.isArray(stockItems) ? stockItems.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.item_code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = stockFilter === 'all' ||
                         (stockFilter === 'low' && item.is_low_stock) ||
                         (stockFilter === 'normal' && !item.is_low_stock);

    return matchesSearch && matchesFilter;
  }) : [];

  // 최근 조정 이력 (최대 5건)
  const recentAdjustments = Array.isArray(stockHistory)
    ? stockHistory
        .filter((history) => history.transaction_type === '조정')
        .slice(0, 5)
    : [];

  // 통계 계산
  const totalItems = Array.isArray(stockItems) ? stockItems.length : 0;
  const lowStockItems = Array.isArray(stockItems) ? stockItems.filter(item => item.is_low_stock).length : 0;
  const totalValue = Array.isArray(stockItems) ? stockItems.reduce((sum, item) => sum + item.stock_value, 0) : 0;

  // 재고 조정 처리
  const handleAdjustmentSubmit = async (formData: any) => {
    try {
      const response = await fetch('/api/stock/adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        alert('재고 조정이 성공적으로 완료되었습니다.');
        setShowAdjustmentForm(false);
        // 양쪽 탭 모두 새로고침
        fetchStockItems();
        fetchStockHistory();
      } else {
        alert(`재고 조정 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('재고 조정 오류:', error);
      alert('재고 조정 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">재고 현황</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">실시간 재고 모니터링 및 이력 관리</p>
          </div>

          {activeTab === 'current' && (
            <StockExportButton
              stockData={filteredStockItems}
              className="text-sm bg-gray-800 text-white hover:bg-gray-700 whitespace-nowrap"
            />
          )}
        </div>
      </div>

      {/* 통계 위젯 */}
      {activeTab === 'current' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              
              <div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">총 품목 수</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{totalItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              
              <div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">재고 부족 품목</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{lowStockItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              
              <div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">총 재고 금액</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                  ₩{(totalValue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'current'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            현재 재고
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            재고 이력
          </button>
          <button
            onClick={() => setActiveTab('adjustment')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'adjustment'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            재고 조정
          </button>
        </div>
      </div>

      {/* 현재 재고 탭 */}
      {activeTab === 'current' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* 검색 및 필터 */}
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="품번 또는 품명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-600"
                  />
                </div>
              </div>

              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-600"
              >
                <option value="all">전체</option>
                <option value="normal">정상 재고</option>
                <option value="low">재고 부족</option>
              </select>
            </div>
          </div>

          {/* 재고 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="w-[200px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    품번/품명
                  </th>
                  <th className="w-[200px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    규격
                  </th>
                  <th className="w-[120px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    현재고
                  </th>
                  <th className="w-[120px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="w-[140px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    재고금액
                  </th>
                  <th className="w-[100px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      로딩 중...
                    </td>
                  </tr>
                ) : filteredStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      재고 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredStockItems.map((item) => (
                    <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={item.item_code}>
                          {item.item_code}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={item.item_name}>
                          {item.item_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-800 dark:text-gray-100 truncate" title={item.spec || '-'}>
                          {item.spec || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-right text-sm text-gray-800 dark:text-gray-100 truncate">
                          {(item.current_stock || 0).toLocaleString()} {item.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-right text-sm text-gray-800 dark:text-gray-100 truncate">
                          ₩{(item.unit_price || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-right text-sm text-gray-800 dark:text-gray-100 truncate">
                          ₩{(item.stock_value || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden text-center">
                        {item.is_low_stock ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 truncate">
                            부족
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 truncate">
                            정상
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 재고 이력 탭 */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">재고 이동 이력</h3>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="w-[120px] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    일시
                  </th>
                  <th className="w-[90px] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    구분
                  </th>
                  <th className="w-[200px] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    품목
                  </th>
                  <th className="w-[100px] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="w-[150px] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    거래처
                  </th>
                  <th className="w-[130px] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    참조번호
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      로딩 중...
                    </td>
                  </tr>
                ) : stockHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      재고 이력이 없습니다.
                    </td>
                  </tr>
                ) : (
                  stockHistory.map((history) => (
                    <tr key={history.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-800 dark:text-gray-100 truncate">
                          {new Date(history.transaction_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 truncate">
                          {history.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-800 dark:text-gray-100 truncate" title={history.item_name}>
                          {history.item_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-right text-sm text-gray-800 dark:text-gray-100 truncate">
                          {((history.quantity || history.quantity_change) || 0) > 0 ? '+' : ''}{((history.quantity || history.quantity_change) || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-800 dark:text-gray-100 truncate" title={history.company_name || '-'}>
                          {history.company_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-800 dark:text-gray-100 truncate" title={history.reference_number || history.reference_no || '-'}>
                          {history.reference_number || history.reference_no || '-'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 재고 조정 탭 */}
      {activeTab === 'adjustment' && (
        <div className="space-y-6">
          {!showAdjustmentForm ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">재고 조정</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">재고 수량을 조정합니다.</p>
                </div>
                <button
                  onClick={() => setShowAdjustmentForm(true)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">재고 조정</span>
                  <span className="sm:hidden">조정</span>
                </button>
              </div>

              {/* 최근 조정 이력 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-3">최근 조정 이력</h4>
                
                {loading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    
                    <p>로딩 중...</p>
                  </div>
                ) : recentAdjustments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    
                    <p>조정 이력이 없습니다.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <thead>
                        <tr className="border-b border-gray-300 dark:border-gray-600">
                          <th className="w-[120px] text-left py-2 px-2 text-xs font-medium text-gray-700 dark:text-gray-300">날짜</th>
                          <th className="w-[250px] text-left py-2 px-2 text-xs font-medium text-gray-700 dark:text-gray-300">품목</th>
                          <th className="w-[100px] text-right py-2 px-2 text-xs font-medium text-gray-700 dark:text-gray-300">수량</th>
                          <th className="w-[150px] text-left py-2 px-2 text-xs font-medium text-gray-700 dark:text-gray-300">참조번호</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAdjustments.map((adjustment) => (
                          <tr key={adjustment.transaction_id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                            <td className="py-2 px-2 overflow-hidden">
                              <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {new Date(adjustment.transaction_date).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-2 px-2 overflow-hidden">
                              <div className="text-sm text-gray-700 dark:text-gray-300 truncate" title={adjustment.item_name || adjustment.item_code || '-'}>
                                {adjustment.item_name || adjustment.item_code || '-'}
                              </div>
                            </td>
                            <td className="py-2 px-2 overflow-hidden">
                              <div className="text-sm text-right text-gray-700 dark:text-gray-300 font-medium truncate">
                                {((adjustment.quantity || adjustment.quantity_change) || 0) > 0 ? '+' : ''}
                                {((adjustment.quantity || adjustment.quantity_change) || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="py-2 px-2 overflow-hidden">
                              <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={adjustment.reference_number || adjustment.reference_no || '-'}>
                                {adjustment.reference_number || adjustment.reference_no || '-'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">새 재고 조정</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">재고 수량을 조정합니다.</p>
              </div>

              <StockAdjustmentForm
                onSubmit={handleAdjustmentSubmit}
                onCancel={() => setShowAdjustmentForm(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}