'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Search,
  Download,
  History,
  RotateCcw,
  Trash2
} from 'lucide-react';

interface StockHistoryItem {
  transaction_id: number;
  transaction_date: string;
  created_at?: string; // 생성 시간 (시간 정보 포함)
  item_code: string;
  item_name: string;
  transaction_type: string;
  quantity_change: number;
  stock_balance: number;
  shortage?: number; // 부족 수량 (새 필드)
  company_name?: string;
  reference_number?: string;
  reference_no?: string; // Alternative field name
  notes?: string;
}

interface StockItem {
  item_id: number;
  item_code: string;
  item_name: string;
}

export default function StockHistoryPage() {
  const [stockHistory, setStockHistory] = useState<StockHistoryItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Initialize date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch stock items for dropdown
  useEffect(() => {
    const fetchStockItems = async () => {
      try {
        const response = await fetch('/api/stock/items');
        const result = await response.json();

        if (result.success) {
          setStockItems(result.data || []);
        }
      } catch (error) {
        console.error('품목 조회 오류:', error);
      }
    };

    fetchStockItems();
  }, []);

  // Fetch stock history
  const fetchStockHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedItem) params.append('item_id', selectedItem);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const response = await fetch(`/api/stock/history?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setStockHistory(result.data.history || []);
      } else {
        alert(`재고 이력 조회 실패: ${result.error}`);
        setStockHistory([]);
      }
    } catch (error) {
      console.error('재고 이력 조회 오류:', error);
      alert('재고 이력 조회 중 오류가 발생했습니다.');
      setStockHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when filters change
  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchStockHistory();
    }
  }, [selectedItem, dateFrom, dateTo]);

  // Filter history by search term
  const filteredHistory = stockHistory.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.company_name && item.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get transaction type display info
  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case 'IN':
      case '입고':
        return { label: '입고', color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
      case 'OUT':
      case '출고':
        return { label: '출고', color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
      case '생산입고':
        return { label: '생산입고', color: 'border-2 border-blue-600 text-blue-600 bg-transparent dark:border-blue-400 dark:text-blue-400' };
      case '생산출고':
        return { label: '생산출고', color: 'border-2 border-orange-600 text-orange-600 bg-transparent dark:border-orange-400 dark:text-orange-400' };
      case 'BOM차감':
        return { label: 'BOM차감', color: 'border-2 border-red-600 text-red-600 bg-transparent dark:border-red-400 dark:text-red-400' };
      case 'ADJUST':
      case '조정':
        return { label: '조정', color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
      default:
        return { label: type, color: 'border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300' };
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    const csvContent = [
      ['일자', '품목코드', '품목명', '거래유형', '변동수량', '재고잔량', '거래처', '참조번호', '비고'],
      ...filteredHistory.map(item => [
        new Date(item.transaction_date).toLocaleDateString(),
        item.item_code,
        item.item_name,
        getTransactionTypeInfo(item.transaction_type).label,
        item.quantity_change,
        item.stock_balance,
        item.company_name || '',
        item.reference_no || '',
        item.notes || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `재고이력_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">재고 이력</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">품목별 재고 변동 이력을 조회합니다</p>
          </div>

          <button
            onClick={exportToCsv}
            disabled={filteredHistory.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-5 h-5" />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 sm:w-8 sm:h-8 text-gray-800 dark:text-gray-100" />
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">총 거래 건수</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{filteredHistory.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">입고 건수</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {filteredHistory.filter(item => 
                  item.transaction_type === 'IN' || 
                  item.transaction_type === '입고' || 
                  item.transaction_type === '생산입고'
                ).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">출고 건수</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {filteredHistory.filter(item => 
                  item.transaction_type === 'OUT' || 
                  item.transaction_type === '출고' || 
                  item.transaction_type === '생산출고'
                ).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8 text-gray-800 dark:text-gray-100" />
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">조정 건수</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {filteredHistory.filter(item => 
                  item.transaction_type === 'ADJUST' || 
                  item.transaction_type === '조정'
                ).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              품목 선택
            </label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="">전체 품목</option>
              {stockItems.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_code} - {item.item_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              시작일
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              종료일
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품목명, 거래처..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button
              onClick={fetchStockHistory}
              disabled={loading}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="w-[110px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  일자
                </th>
                <th className="w-[120px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  품목코드
                </th>
                <th className="w-[200px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  품목명
                </th>
                <th className="w-[100px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  거래유형
                </th>
                <th className="w-[100px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  변동수량
                </th>
                <th className="w-[100px] px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  재고잔량
                </th>
                <th className="w-[150px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  거래처
                </th>
                <th className="w-[200px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  비고
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 sm:px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mr-3"></div>
                      <span className="text-gray-500">재고 이력을 조회하고 있습니다...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 sm:px-6 py-8 text-center">
                    <div className="text-gray-500 dark:text-gray-400">
                      <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg mb-1">재고 이력이 없습니다</p>
                      <p className="text-sm">조건을 변경하여 다시 조회해보세요</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const typeInfo = getTransactionTypeInfo(item.transaction_type);

                  return (
                    <tr key={item.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-white truncate">
                          {item.created_at 
                            ? new Date(item.created_at).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : new Date(item.transaction_date).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                          }
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.item_code}>
                          {item.item_code}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-white truncate" title={item.item_name}>
                          {item.item_name}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full truncate ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-right text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {item.quantity_change > 0 ? '+' : ''}{item.quantity_change.toLocaleString()}
                          {item.shortage && item.shortage > 0 && (
                            <span className="text-orange-600 ml-1">
                              (부족: {item.shortage.toLocaleString()})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-right text-sm text-gray-900 dark:text-white truncate">
                          {item.stock_balance.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-900 dark:text-white truncate" title={item.company_name || '-'}>
                          {item.company_name || '-'}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 overflow-hidden">
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={item.notes || '-'}>
                          {item.notes || '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}