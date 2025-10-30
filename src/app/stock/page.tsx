'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  last_transaction_date: string | null;
  last_transaction_type: string | null;
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('current');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortField, setSortField] = useState<string>('last_transaction_date');
  const [sortOrderStock, setSortOrderStock] = useState<'asc' | 'desc'>('desc');
  
  // 페이지네이션 상태
  const [currentPageCurrent, setCurrentPageCurrent] = useState(1);
  const [currentPageHistory, setCurrentPageHistory] = useState(1);
  const [currentPageAdjustment, setCurrentPageAdjustment] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // 거래 내역으로 이동하는 함수
  const handleHistoryRowClick = (history: StockHistory) => {
    // transaction_type에 따라 적절한 탭 결정
    let tab = 'receiving';
    if (history.transaction_type === '생산입고' || history.transaction_type === '생산출고' || history.transaction_type === 'BOM차감') {
      tab = 'production';
    } else if (history.transaction_type === '출고') {
      tab = 'shipping';
    } else if (history.transaction_type === '입고') {
      tab = 'receiving';
    }

    // inventory 페이지로 이동 (transaction_id를 쿼리 파라미터로 전달 가능)
    router.push(`/inventory?tab=${tab}${history.transaction_id ? `&transaction_id=${history.transaction_id}` : ''}`);
  };

  // 정렬 핸들러
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrderStock(sortOrderStock === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrderStock('asc');
    }
  };

  // 실시간 재고 현황 조회 (재시도 로직 포함)
  const fetchStockItems = async (showLoading = true, retryCount = 0) => {
    const MAX_RETRIES = 3;
    if (showLoading) {
    setLoading(true);
    }
    try {
      const response = await fetch('/api/stock', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setStockItems(result.data);
      } else {
        // 응답 구조가 예상과 다를 때만 오류 처리
        if (showLoading) {
          console.warn('재고 조회 응답 구조 이상:', result);
        }
        // 기존 데이터 유지 (빈 배열로 리셋하지 않음)
      }
    } catch (error) {
      console.error('재고 조회 오류:', error);
      
      // 재시도 로직 (최대 3회, 1초 간격)
      if (retryCount < MAX_RETRIES && error instanceof TypeError) {
        console.log(`재고 조회 재시도 ${retryCount + 1}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchStockItems(showLoading, retryCount + 1);
      }

      // 최종 실패 시 사용자 알림은 showLoading이 true일 때만
      if (showLoading) {
        alert('재고 조회 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
      }
      // 주기적 업데이트 실패 시에는 기존 데이터 유지
    } finally {
      if (showLoading) {
      setLoading(false);
      }
    }
  };

  // 재고 이동 이력 조회
  const fetchStockHistory = async (showLoading = true) => {
    if (showLoading) {
    setLoading(true);
    }
    try {
      const response = await fetch('/api/stock/history');
      const result = await response.json();

      if (result.success) {
        // API returns result.data.history, not result.data.transactions
        setStockHistory(result.data.history || []);
      } else {
        if (showLoading) {
        alert(`이력 조회 실패: ${result.error}`);
        }
        setStockHistory([]);
      }
    } catch (error) {
      console.error('이력 조회 오류:', error);
      if (showLoading) {
      alert('이력 조회 중 오류가 발생했습니다.');
      }
      setStockHistory([]);
    } finally {
      if (showLoading) {
      setLoading(false);
      }
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

  // 실시간 자동 업데이트 (5초마다) - 백그라운드 업데이트로 화면 깜빡임 방지
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'current') {
        fetchStockItems(false); // showLoading=false로 깜빡임 방지
      } else if (activeTab === 'history') {
        fetchStockHistory(false); // showLoading=false로 깜빡임 방지
      } else if (activeTab === 'adjustment') {
        fetchStockHistory(false); // showLoading=false로 깜빡임 방지
      }
    }, 5000); // 5초마다 업데이트

    return () => clearInterval(interval);
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

  // 정렬된 재고 항목 (현재재고 탭용)
  const sortedStockItems = [...filteredStockItems]
    .sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      
      // 날짜 처리
      if (sortField === 'last_transaction_date') {
        const aDate = aVal ? new Date(aVal).getTime() : 0;
        const bDate = bVal ? new Date(bVal).getTime() : 0;
        return sortOrderStock === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      // 문자열 처리
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrderStock === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      // 숫자 처리
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortOrderStock === 'asc' ? aNum - bNum : bNum - aNum;
    });

  // 현재재고 탭 페이지네이션
  const totalPagesCurrent = Math.ceil(sortedStockItems.length / itemsPerPage);
  const paginatedStockItems = sortedStockItems.slice(
    (currentPageCurrent - 1) * itemsPerPage,
    currentPageCurrent * itemsPerPage
  );

  // 재고이력 정렬 및 페이지네이션
  const sortedHistory = [...stockHistory]
    .sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at || 0).getTime();
      const dateB = new Date(b.transaction_date || b.created_at || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  
  const totalPagesHistory = Math.ceil(sortedHistory.length / itemsPerPage);
  const paginatedHistory = sortedHistory.slice(
    (currentPageHistory - 1) * itemsPerPage,
    currentPageHistory * itemsPerPage
  );

  // 최근 조정 이력 (필터링 및 정렬)
  const recentAdjustmentsAll = Array.isArray(stockHistory)
    ? stockHistory
        .filter((history) => history.transaction_type === '조정')
        .sort((a, b) => {
          const dateA = new Date(a.transaction_date || a.created_at || 0).getTime();
          const dateB = new Date(b.transaction_date || b.created_at || 0).getTime();
          return dateB - dateA; // 최신순
        })
    : [];
  
  const totalPagesAdjustment = Math.ceil(recentAdjustmentsAll.length / itemsPerPage);
  const recentAdjustments = recentAdjustmentsAll.slice(
    (currentPageAdjustment - 1) * itemsPerPage,
    currentPageAdjustment * itemsPerPage
  );

  // 페이지 변경 시 탭별로 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPageCurrent(1);
    setCurrentPageHistory(1);
    setCurrentPageAdjustment(1);
  }, [itemsPerPage]);

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
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th 
                    className="w-[110px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors align-middle"
                    onClick={() => handleSort('last_transaction_date')}
                  >
                    <div className="flex items-center gap-1">
                      거래일자
                      {sortField === 'last_transaction_date' && (
                        <span className="ml-1">
                          {sortOrderStock === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="w-[90px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                    구분
                  </th>
                  <th 
                    className="w-[180px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors align-middle"
                    onClick={() => handleSort('item_code')}
                  >
                    <div className="flex items-center gap-1">
                      품번/품명
                      {sortField === 'item_code' && (
                        <span className="ml-1">
                          {sortOrderStock === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="w-[150px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                    규격
                  </th>
                  <th 
                    className="w-[90px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors align-middle"
                    onClick={() => handleSort('current_stock')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      수량
                      {sortField === 'current_stock' && (
                        <span className="ml-1">
                          {sortOrderStock === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="w-[110px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors align-middle"
                    onClick={() => handleSort('unit_price')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      단가
                      {sortField === 'unit_price' && (
                        <span className="ml-1">
                          {sortOrderStock === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="w-[120px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors align-middle"
                    onClick={() => handleSort('stock_value')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      금액
                      {sortField === 'stock_value' && (
                        <span className="ml-1">
                          {sortOrderStock === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="w-[80px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      로딩 중...
                    </td>
                  </tr>
                ) : paginatedStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      재고 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedStockItems.map((item) => (
                    <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-3 sm:px-6 py-4 align-middle">
                        {item.last_transaction_date ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>
                                {new Date(item.last_transaction_date).getFullYear()}.
                                {String(new Date(item.last_transaction_date).getMonth() + 1).padStart(2, '0')}.
                                {String(new Date(item.last_transaction_date).getDate()).padStart(2, '0')}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {String(new Date(item.last_transaction_date).getHours()).padStart(2, '0')}:
                                {String(new Date(item.last_transaction_date).getMinutes()).padStart(2, '0')}:
                                {String(new Date(item.last_transaction_date).getSeconds()).padStart(2, '0')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 align-middle text-center">
                        {item.last_transaction_type ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {item.last_transaction_type}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.item_code}>
                            {item.item_code}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={item.item_name}>
                            {item.item_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle">
                        <div className="text-sm text-gray-900 dark:text-white truncate" title={item.spec || '-'}>
                          {item.spec || '-'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {(item.current_stock || 0).toLocaleString('ko-KR')} {item.unit}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {item.unit_price?.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {item.stock_value?.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-center align-middle">
                        {item.is_low_stock ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            부족
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
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
          
          {/* 페이지네이션 컨트롤 */}
          {paginatedStockItems.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 gap-3">
              {/* 페이지당 항목 수 선택 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">페이지당:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPageCurrent(1);
                  }}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={30}>30개</option>
                  <option value={50}>50개</option>
                  <option value={70}>70개</option>
                  <option value={100}>100개</option>
                  <option value={130}>130개</option>
                </select>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  총 {sortedStockItems.length.toLocaleString()}개 중 {((currentPageCurrent - 1) * itemsPerPage + 1).toLocaleString()}-{Math.min(currentPageCurrent * itemsPerPage, sortedStockItems.length).toLocaleString()}개 표시
                </span>
              </div>

              {/* 페이지 이동 버튼 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPageCurrent(1)}
                  disabled={currentPageCurrent === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  처음
                </button>
                <button
                  onClick={() => setCurrentPageCurrent(p => Math.max(1, p - 1))}
                  disabled={currentPageCurrent === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  이전
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {currentPageCurrent} / {totalPagesCurrent || 1}
                </span>
                <button
                  onClick={() => setCurrentPageCurrent(p => Math.min(totalPagesCurrent || 1, p + 1))}
                  disabled={currentPageCurrent >= totalPagesCurrent}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  다음
                </button>
                <button
                  onClick={() => setCurrentPageCurrent(totalPagesCurrent || 1)}
                  disabled={currentPageCurrent >= totalPagesCurrent}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  마지막
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 재고 이력 탭 */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">재고 이동 이력</h3>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th 
                    className="w-[110px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    <div className="flex items-center gap-1">
                      거래일자
                      <span className="ml-1">
                        {sortOrder === 'desc' ? '↓' : '↑'}
                      </span>
                    </div>
                  </th>
                  <th className="w-[90px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    구분
                  </th>
                  <th className="w-[180px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    품번/품명
                  </th>
                  <th className="w-[90px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="w-[110px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="w-[120px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="w-[150px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래처
                  </th>
                  <th className="w-[130px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    참조번호
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-6 py-4 text-center text-gray-500">
                      로딩 중...
                    </td>
                  </tr>
                ) : paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 sm:px-6 py-4 text-center text-gray-500">
                      재고 이력이 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedHistory.map((history) => {
                      const date = history.transaction_date || history.created_at;
                      const d = date ? new Date(date) : null;
                      const itemCode = (history as any).item_code || 'N/A';
                      const itemName = history.item_name || 'N/A';
                      return (
                    <tr 
                      key={history.transaction_id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => handleHistoryRowClick(history)}
                    >
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap align-middle">
                        {d ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>{d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, '0')}.{String(d.getDate()).padStart(2, '0')}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}:{String(d.getSeconds()).padStart(2, '0')}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 truncate">
                          {history.transaction_type}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={itemCode}>
                            {itemCode}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={itemName}>
                            {itemName}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {((history.quantity || history.quantity_change) || 0) > 0 ? '+' : ''}{((history.quantity || history.quantity_change) || 0).toLocaleString('ko-KR')} {history.unit || 'EA'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {((history as any).unit_price || 0).toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                        {((history as any).total_amount || 0).toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-sm text-gray-500 dark:text-gray-400 truncate align-middle" title={history.company_name || '-'}>
                        {history.company_name || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-sm text-gray-500 dark:text-gray-400 truncate align-middle" title={history.reference_number || history.reference_no || '-'}>
                        {history.reference_number || history.reference_no || '-'}
                      </td>
                    </tr>
                  );
                    })
                  )
                }
              </tbody>
            </table>
          </div>
          
          {/* 페이지네이션 컨트롤 */}
          {paginatedHistory.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 gap-3">
              {/* 페이지당 항목 수 선택 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">페이지당:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPageHistory(1);
                  }}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={30}>30개</option>
                  <option value={50}>50개</option>
                  <option value={70}>70개</option>
                  <option value={100}>100개</option>
                  <option value={130}>130개</option>
                </select>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  총 {sortedHistory.length.toLocaleString()}개 중 {((currentPageHistory - 1) * itemsPerPage + 1).toLocaleString()}-{Math.min(currentPageHistory * itemsPerPage, sortedHistory.length).toLocaleString()}개 표시
                </span>
              </div>

              {/* 페이지 이동 버튼 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPageHistory(1)}
                  disabled={currentPageHistory === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  처음
                </button>
                <button
                  onClick={() => setCurrentPageHistory(p => Math.max(1, p - 1))}
                  disabled={currentPageHistory === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  이전
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {currentPageHistory} / {totalPagesHistory || 1}
                </span>
                <button
                  onClick={() => setCurrentPageHistory(p => Math.min(totalPagesHistory || 1, p + 1))}
                  disabled={currentPageHistory >= totalPagesHistory}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  다음
                </button>
                <button
                  onClick={() => setCurrentPageHistory(totalPagesHistory || 1)}
                  disabled={currentPageHistory >= totalPagesHistory}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  마지막
                </button>
              </div>
            </div>
          )}
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
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-4 sm:p-6">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">최근 조정 이력</h4>
                </div>
                
                {loading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>로딩 중...</p>
                  </div>
                ) : recentAdjustments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>조정 이력이 없습니다.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="w-[110px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              거래일자
                            </th>
                            <th className="w-[100px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              구분
                            </th>
                            <th className="w-[180px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              품번/품명
                            </th>
                            <th className="w-[100px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              수량
                            </th>
                            <th className="w-[120px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              단가
                            </th>
                            <th className="w-[130px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              금액
                            </th>
                            <th className="w-[150px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              거래처
                            </th>
                            <th className="w-[130px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider align-middle">
                              참조번호
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {recentAdjustments.map((adjustment) => {
                            const date = adjustment.transaction_date || adjustment.created_at;
                            const d = date ? new Date(date) : null;
                            const itemCode = (adjustment as any).item_code || 'N/A';
                            const itemName = adjustment.item_name || 'N/A';
                            const quantity = (adjustment.quantity || adjustment.quantity_change) || 0;
                            const unitPrice = (adjustment as any).unit_price || 0;
                            const totalAmount = (adjustment as any).total_amount || 0;
                            const companyName = adjustment.company_name || '-';
                            
                            return (
                              <tr 
                                key={adjustment.transaction_id} 
                                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap align-middle">
                                  {d ? (
                                    <div className="text-sm text-gray-900 dark:text-white">
                                      <div className="flex flex-col">
                                        <span>
                                          {d.getFullYear()}.{String(d.getMonth() + 1).padStart(2, '0')}.{String(d.getDate()).padStart(2, '0')}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}:{String(d.getSeconds()).padStart(2, '0')}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle">
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 truncate">
                                    조정
                                  </span>
                                </td>
                                <td className="px-3 sm:px-6 py-4 overflow-hidden align-middle">
                                  <div className="flex flex-col">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={itemCode}>
                                      {itemCode}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={itemName}>
                                      {itemName}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                                  {quantity > 0 ? '+' : ''}{quantity.toLocaleString('ko-KR')} {adjustment.unit || 'EA'}
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                                  {unitPrice?.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right align-middle">
                                  {totalAmount?.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }) || '₩0'}
                                </td>
                                <td className="px-3 sm:px-6 py-4 overflow-hidden text-sm text-gray-500 dark:text-gray-400 truncate align-middle" title={companyName}>
                                  {companyName}
                                </td>
                                <td className="px-3 sm:px-6 py-4 overflow-hidden text-sm text-gray-500 dark:text-gray-400 truncate align-middle" title={adjustment.reference_number || adjustment.reference_no || '-'}>
                                  {adjustment.reference_number || adjustment.reference_no || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {recentAdjustments.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 gap-3">
                      {/* 페이지당 항목 수 선택 */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">페이지당:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPageAdjustment(1);
                          }}
                          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value={30}>30개</option>
                          <option value={50}>50개</option>
                          <option value={70}>70개</option>
                          <option value={100}>100개</option>
                          <option value={130}>130개</option>
                        </select>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          총 {recentAdjustmentsAll.length.toLocaleString()}개 중 {((currentPageAdjustment - 1) * itemsPerPage + 1).toLocaleString()}-{Math.min(currentPageAdjustment * itemsPerPage, recentAdjustmentsAll.length).toLocaleString()}개 표시
                        </span>
                      </div>

                      {/* 페이지 이동 버튼 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPageAdjustment(1)}
                          disabled={currentPageAdjustment === 1}
                          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          처음
                        </button>
                        <button
                          onClick={() => setCurrentPageAdjustment(p => Math.max(1, p - 1))}
                          disabled={currentPageAdjustment === 1}
                          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          이전
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {currentPageAdjustment} / {totalPagesAdjustment || 1}
                        </span>
                        <button
                          onClick={() => setCurrentPageAdjustment(p => Math.min(totalPagesAdjustment || 1, p + 1))}
                          disabled={currentPageAdjustment >= totalPagesAdjustment}
                          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          다음
                        </button>
                        <button
                          onClick={() => setCurrentPageAdjustment(totalPagesAdjustment || 1)}
                          disabled={currentPageAdjustment >= totalPagesAdjustment}
                          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          마지막
                        </button>
                      </div>
                    </div>
                  )}
                  </>
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