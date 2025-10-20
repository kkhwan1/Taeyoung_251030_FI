'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Dynamic import to prevent SSR issues
import dynamic from 'next/dynamic';
import { Package, TrendingUp, Truck, Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import Modal from '@/components/Modal';
import ReceivingForm from '@/components/ReceivingForm';
import ProductionForm from '@/components/ProductionForm';
import ShippingForm from '@/components/ShippingForm';
import { TransactionsExportButton, StockExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';
import {
  InventoryTransaction,
  StockInfo,
  InventoryTab,
  StockStatus,
  ReceivingFormData,
  ProductionFormData,
  ShippingFormData,
  TRANSACTION_TYPES
} from '@/types/inventory';

// Search params를 사용하는 내부 컴포넌트
function InventoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL 파라미터에서 탭 가져오기, 기본값은 'receiving'
  const tabFromUrl = searchParams?.get('tab') as 'receiving' | 'production' | 'shipping' | null;
  const initialTab = tabFromUrl || 'receiving';

  const [activeTab, setActiveTab] = useState<'receiving' | 'production' | 'shipping'>(initialTab);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [stockInfo, setStockInfo] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs: InventoryTab[] = [
    {
      id: 'receiving',
      label: '입고 관리',
      icon: Package,
      description: '자재 및 제품 입고 처리',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      id: 'production',
      label: '생산 관리',
      icon: TrendingUp,
      description: 'BOM 기반 생산 처리',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      id: 'shipping',
      label: '출고 관리',
      icon: Truck,
      description: '제품 출고 및 배송',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    }
  ];

  const activeTabInfo = tabs.find(tab => tab.id === activeTab)!;

  // 인쇄용 컬럼 정의 - 거래 내역
  const transactionPrintColumns = [
    { key: 'transaction_date', label: '거래일', align: 'center' as const, width: '12%', type: 'date' as const },
    { key: 'transaction_type', label: '구분', align: 'center' as const, width: '8%' },
    { key: 'item_code', label: '품번', align: 'left' as const, width: '12%' },
    { key: 'item_name', label: '품명', align: 'left' as const, width: '18%' },
    { key: 'quantity', label: '수량', align: 'right' as const, width: '10%', type: 'number' as const },
    { key: 'unit_price', label: '단가', align: 'right' as const, width: '12%', type: 'currency' as const },
    { key: 'total_amount', label: '금액', align: 'right' as const, width: '12%', type: 'currency' as const },
    { key: 'company_name', label: '거래처', align: 'left' as const, width: '12%' },
    { key: 'reference_no', label: '참조번호', align: 'left' as const, width: '14%' }
  ];

  // 인쇄용 컬럼 정의 - 재고 현황
  const stockPrintColumns = [
    { key: 'item_code', label: '품번', align: 'left' as const, width: '15%' },
    { key: 'item_name', label: '품명', align: 'left' as const, width: '25%' },
    { key: 'current_stock', label: '현재고', align: 'right' as const, width: '12%', type: 'number' as const },
    { key: 'min_stock_level', label: '최소재고', align: 'right' as const, width: '12%', type: 'number' as const },
    { key: 'stock_value', label: '재고금액', align: 'right' as const, width: '15%', type: 'currency' as const },
    { key: 'location', label: '위치', align: 'left' as const, width: '10%' },
    { key: 'status', label: '상태', align: 'center' as const, width: '11%' }
  ];

  // URL 파라미터가 변경되면 activeTab 업데이트
  useEffect(() => {
    const tab = searchParams?.get('tab') as 'receiving' | 'production' | 'shipping' | null;
    if (tab && ['receiving', 'production', 'shipping'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // activeTab이 변경되면 URL 업데이트
  const handleTabChange = (tab: 'receiving' | 'production' | 'shipping') => {
    setActiveTab(tab);
    router.push(`/inventory?tab=${tab}`);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTransactions(),
        fetchStockInfo()
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      let url = '/api/inventory';
      const params = new URLSearchParams();

      switch (activeTab) {
        case 'receiving':
          params.append('type', '입고');
          break;
        case 'production':
          url = '/api/inventory/production';
          break;
        case 'shipping':
          url = '/api/inventory/shipping';
          break;
      }

      const response = await fetch(`${url}?${params}`);
      const data = await response.json();

      if (data.success) {
        // Handle paginated response structure
        const transactionsData = data.data?.data || data.data?.transactions || data.data || [];
        setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchStockInfo = async () => {
    try {
      const response = await fetch('/api/stock');
      const data = await response.json();

      if (data.success) {
        setStockInfo(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch stock info:', error);
    }
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      let url = '';
      switch (activeTab) {
        case 'receiving':
          url = '/api/inventory/receiving';
          break;
        case 'production':
          url = '/api/inventory/production';
          break;
        case 'shipping':
          url = '/api/inventory/shipping';
          break;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowModal(false);
        setRefreshKey(prev => prev + 1);

        // Show success notification
        alert(`${activeTabInfo.label} 처리가 완료되었습니다.`);
      } else {
        alert(`오류: ${data.error || '처리에 실패했습니다'}`);
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
      alert('처리 중 오류가 발생했습니다');
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case '입고':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case '생산입고':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case '생산출고':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case '출고':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStockStatus = (item: StockInfo) => {
    if (!item.min_stock_level) return 'normal';
    if (item.current_stock <= 0) return 'empty';
    if (item.current_stock <= item.min_stock_level) return 'low';
    return 'normal';
  };

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'empty':
        return '재고없음';
      case 'low':
        return '재고부족';
      case 'normal':
        return '정상';
      default:
        return '정상';
    }
  };

  // 인쇄용 재고 데이터 변환
  const printableStockData = stockInfo.map(item => {
    const status = getStockStatus(item);
    return {
      ...item,
      status: getStockStatusLabel(status),
      stock_value: (item.current_stock * (item.unit_price || 0)),
      location: item.location || '-'
    };
  });

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'empty':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'low':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const renderForm = () => {
    switch (activeTab) {
      case 'receiving':
        return (
          <ReceivingForm
            onSubmit={handleFormSubmit}
            onCancel={() => setShowModal(false)}
          />
        );
      case 'production':
        return (
          <ProductionForm
            onSubmit={handleFormSubmit}
            onCancel={() => setShowModal(false)}
          />
        );
      case 'shipping':
        return (
          <ShippingForm
            onSubmit={handleFormSubmit}
            onCancel={() => setShowModal(false)}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">재고 관리</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">입고, 생산, 출고 통합 관리</p>
            </div>
          </div>
          <div className="flex gap-2">
            <PrintButton
              data={printableStockData}
              columns={stockPrintColumns}
              title="재고 현황 보고서"
              orientation="landscape"
              variant="icon"
              className="bg-purple-500 hover:bg-purple-600"
            />
            <StockExportButton
              stockData={stockInfo}
              className="text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
        <div className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content */}
      <div className={`rounded-lg p-6 shadow-sm ${activeTabInfo.bgColor}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <activeTabInfo.icon className={`w-6 h-6 ${activeTabInfo.color}`} />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {activeTabInfo.label}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {activeTabInfo.description}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <PrintButton
              data={transactions}
              columns={transactionPrintColumns}
              title={`${activeTabInfo.label} 거래 내역`}
              orientation="landscape"
              variant="icon"
              className="bg-purple-500 hover:bg-purple-600"
            />
            <TransactionsExportButton
              transactions={transactions}
              type={activeTabInfo.label}
              className="text-sm"
            />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'receiving' && '입고 등록'}
              {activeTab === 'production' && '생산 등록'}
              {activeTab === 'shipping' && '출고 등록'}
            </button>
          </div>
        </div>

        {/* Real-time Stock Display */}
        {stockInfo.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">실시간 재고 현황</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {stockInfo.slice(0, 8).map((item) => {
                const status = getStockStatus(item);
                return (
                  <div
                    key={item.item_id}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.item_code}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.item_name}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {(item.current_stock || 0).toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {item.unit}
                          </span>
                        </div>
                        {item.min_stock_level && (
                          <p className="text-xs text-gray-400">
                            최소: {item.min_stock_level.toLocaleString()} {item.unit}
                          </p>
                        )}
                      </div>
                      <div className="ml-2">
                        {getStockStatusIcon(status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">최근 거래 내역</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래일자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    구분
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    품번/품명
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    참조번호
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      데이터를 불러오는 중...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      거래 내역이 없습니다
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 10).map((transaction) => (
                    <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(transaction.transaction_date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTransactionTypeColor(transaction.transaction_type)}`}>
                          {transaction.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {transaction.item_code}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {transaction.item_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {parseFloat(transaction.quantity.toString()).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        ₩{parseFloat(transaction.unit_price.toString()).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        ₩{parseFloat(transaction.total_amount.toString()).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {transaction.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {transaction.reference_no || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for Forms */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          activeTab === 'receiving' ? '입고 등록' :
          activeTab === 'production' ? '생산 등록' :
          '출고 등록'
        }
        size="xl"
      >
        {renderForm()}
      </Modal>
    </div>
  );
}

// 메인 페이지 컴포넌트 - Suspense로 감싸기
export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
      </div>
    }>
      <InventoryContent />
    </Suspense>
  );
}