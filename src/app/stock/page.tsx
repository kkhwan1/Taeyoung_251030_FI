'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Package, AlertTriangle, Search, Plus } from 'lucide-react';
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
  item_name: string;
  quantity: number;
  reference_no: string;
  company_name: string;
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
        setStockHistory(result.data.transactions || []);
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
        // 현재 재고 정보 새로고침
        if (activeTab === 'current') {
          fetchStockItems();
        }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">재고 현황</h1>
          <p className="text-gray-600 dark:text-gray-400">실시간 재고 모니터링 및 이력 관리</p>
        </div>

        {activeTab === 'current' && (
          <StockExportButton
            stockData={filteredStockItems}
            className="bg-green-500 text-white hover:bg-green-600"
          />
        )}
      </div>

      {/* 통계 위젯 */}
      {activeTab === 'current' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">총 품목 수</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">재고 부족 품목</p>
                <p className="text-2xl font-bold text-red-600">{lowStockItems}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">총 재고 금액</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₩{(totalValue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('current')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'current'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            현재 재고
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            재고 이력
          </button>
          <button
            onClick={() => setActiveTab('adjustment')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'adjustment'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            재고 조정
          </button>
        </nav>
      </div>

      {/* 현재 재고 탭 */}
      {activeTab === 'current' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {/* 검색 및 필터 */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="품번 또는 품명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="normal">정상 재고</option>
                <option value="low">재고 부족</option>
              </select>
            </div>
          </div>

          {/* 재고 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    품번/품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    규격
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    현재고
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    재고금액
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
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
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.item_code}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {item.item_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.spec || '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        {(item.current_stock || 0).toLocaleString()} {item.unit}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        ₩{(item.unit_price || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        ₩{(item.stock_value || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.is_low_stock ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            부족
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">재고 이동 이력</h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    일시
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    구분
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    품목
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    거래처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
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
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {new Date(history.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          history.transaction_type === '입고' ? 'bg-blue-100 text-blue-800' :
                          history.transaction_type === '생산' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {history.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {history.item_name}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        {(history.quantity || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {history.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {history.reference_no || '-'}
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">재고 조정</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">재고 수량을 조정합니다.</p>
                </div>
                <button
                  onClick={() => setShowAdjustmentForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  재고 조정
                </button>
              </div>

              {/* 최근 조정 이력 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">최근 조정 이력</h4>
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>조정 이력이 없습니다.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">새 재고 조정</h3>
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