'use client';

import { useState, useEffect } from 'react';
import { Calendar, Search, Download, History, Package, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';

interface StockHistoryItem {
  transaction_id: number;
  transaction_date: string;
  item_code: string;
  item_name: string;
  transaction_type: string;
  quantity_change: number;
  stock_balance: number;
  company_name?: string;
  reference_number?: string;
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
        return { label: '입고', color: 'bg-blue-100 text-blue-800', icon: TrendingUp };
      case 'OUT':
        return { label: '출고', color: 'bg-red-100 text-red-800', icon: TrendingDown };
      case 'ADJUST':
        return { label: '조정', color: 'bg-yellow-100 text-yellow-800', icon: RotateCcw };
      default:
        return { label: type, color: 'bg-gray-100 text-gray-800', icon: Package };
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">재고 이력</h1>
          <p className="text-gray-600 dark:text-gray-400">품목별 재고 변동 이력을 조회합니다</p>
        </div>

        <button
          onClick={exportToCsv}
          disabled={filteredHistory.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          CSV 내보내기
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <History className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">총 거래 건수</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredHistory.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">입고 건수</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredHistory.filter(item => item.transaction_type === 'IN').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">출고 건수</p>
              <p className="text-2xl font-bold text-red-600">
                {filteredHistory.filter(item => item.transaction_type === 'OUT').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">조정 건수</p>
              <p className="text-2xl font-bold text-yellow-600">
                {filteredHistory.filter(item => item.transaction_type === 'ADJUST').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Item Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              품목 선택
            </label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <button
              onClick={fetchStockHistory}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  일자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  품목코드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  품목명
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  거래유형
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  변동수량
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  재고잔량
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  거래처
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  비고
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                      <span className="text-gray-500">재고 이력을 조회하고 있습니다...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
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
                  const TypeIcon = typeInfo.icon;

                  return (
                    <tr key={item.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {new Date(item.transaction_date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {item.item_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.item_name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TypeIcon className="w-4 h-4" />
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <span className={`font-medium ${
                          item.quantity_change > 0 ? 'text-green-600' :
                          item.quantity_change < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {item.quantity_change > 0 ? '+' : ''}{item.quantity_change.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                        {item.stock_balance.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {item.notes || '-'}
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