'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Dynamic import to prevent SSR issues
import dynamic from 'next/dynamic';
import {
  Plus,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
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
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [selectedTransactionForShortage, setSelectedTransactionForShortage] = useState<any>(null);

  const tabs: InventoryTab[] = [
    {
      id: 'receiving',
      label: '입고 관리',
      description: '자재 및 제품 입고 처리',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
    },
    {
      id: 'production',
      label: '생산 관리',
      description: 'BOM 기반 생산 처리',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
    },
    {
      id: 'shipping',
      label: '출고 관리',
      description: '제품 출고 및 배송',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
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

  const handleShowShortageDetail = async (transaction: any) => {
    // 해당 거래의 BOM 차감 로그를 가져옴
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: bomLogs } = await supabase
        .from('bom_deduction_log')
        .select(`
          quantity_required,
          deducted_quantity,
          items!child_item_id (
            item_code,
            item_name
          )
        `)
        .eq('transaction_id', transaction.transaction_id);

      setSelectedTransactionForShortage({
        ...transaction,
        bomLogs: bomLogs || []
      });
      setShowShortageModal(true);
    } catch (error) {
      console.error('Failed to fetch shortage details:', error);
      alert('부족 상세 정보를 불러올 수 없습니다.');
    }
  };

  const handleFormSubmit = async (formData: ReceivingFormData | ProductionFormData | ShippingFormData) => {
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

      // Handle shipping form with multiple items
      if (activeTab === 'shipping' && 'items' in formData && Array.isArray(formData.items)) {
        const shippingData = formData as ShippingFormData;
        
        // Submit each item as a separate transaction
        const promises = shippingData.items.map(async (item) => {
          const singleItemData = {
            transaction_date: shippingData.transaction_date,
            company_id: shippingData.customer_id,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            reference_number: shippingData.reference_no || `SHP-${Date.now()}`,
            location: shippingData.delivery_address,
            notes: shippingData.notes,
            created_by: shippingData.created_by || 1
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(singleItemData),
          });

          const data = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || '처리에 실패했습니다');
          }
          
          return data;
        });

        await Promise.all(promises);
        
        setShowModal(false);
        setRefreshKey(prev => prev + 1);
        alert(`${activeTabInfo.label} 처리가 완료되었습니다.`);
        return { success: true };
      } else {
        // Standard submission for receiving and production
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
          return data; // Return the response data
        } else {
          alert(`오류: ${data.error || '처리에 실패했습니다'}`);
          throw new Error(data.error || '처리에 실패했습니다');
        }
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
      alert('처리 중 오류가 발생했습니다');
      throw error;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case '입고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case '생산입고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case '생산출고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case '출고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
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
        return <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
      case 'low':
        return <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
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
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">재고 관리</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">입고, 생산, 출고 통합 관리</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintButton
              data={printableStockData}
              columns={stockPrintColumns}
              title="재고 현황 보고서"
              orientation="landscape"
              variant="icon"
              className="bg-gray-800 hover:bg-gray-700 text-white"
            />
            <StockExportButton
              stockData={stockInfo}
              className="text-sm bg-gray-800 hover:bg-gray-700 text-white"
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          {tabs.map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

              {/* Active Tab Content */}
      <div className={`rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700 ${activeTabInfo.bgColor}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeTabInfo.label}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {activeTabInfo.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintButton
              data={transactions}
              columns={transactionPrintColumns}
              title={`${activeTabInfo.label} 거래 내역`}
              orientation="landscape"
              variant="icon"
              className="bg-gray-800 hover:bg-gray-700"
            />
            <TransactionsExportButton
              transactions={transactions}
              type={activeTabInfo.label}
              className="text-sm"
            />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">
                {activeTab === 'receiving' && '입고 등록'}
                {activeTab === 'production' && '생산 등록'}
                {activeTab === 'shipping' && '출고 등록'}
              </span>
              <span className="sm:hidden">등록</span>
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
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">최근 거래 내역</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="w-[110px] px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    거래일자
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
                  {activeTab === 'production' && (
                    <th className="w-[110px] px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      재고상태
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === 'production' ? 9 : 8} className="px-3 sm:px-6 py-12 text-center text-gray-500">
                      데이터를 불러오는 중...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'production' ? 9 : 8} className="px-3 sm:px-6 py-12 text-center text-gray-500">
                      거래 내역이 없습니다
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 10).map((transaction) => {
                    const shortageTotal = (transaction as any).shortage_total || 0;
                    return (
                      <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-gray-900 dark:text-white truncate">
                            {transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString('ko-KR') : '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full truncate ${getTransactionTypeColor(transaction.transaction_type || '')}`}>
                            {transaction.transaction_type || '-'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={transaction.item_code || (transaction as any).items?.item_code || '-'}>
                            {transaction.item_code || (transaction as any).items?.item_code || '-'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={transaction.item_name || (transaction as any).items?.item_name || '-'}>
                            {transaction.item_name || (transaction as any).items?.item_name || '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                            {(transaction.quantity || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                            ₩{(transaction.unit_price || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                            ₩{(transaction.total_amount || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={transaction.company_name || (transaction as any).companies?.company_name || '-'}>
                            {transaction.company_name || (transaction as any).companies?.company_name || '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={transaction.reference_no || transaction.reference_number || '-'}>
                            {transaction.reference_no || transaction.reference_number || '-'}
                          </div>
                        </td>
                        {activeTab === 'production' && (
                          <td className="px-3 sm:px-6 py-4 overflow-hidden">
                            {shortageTotal > 0 ? (
                              <button
                                onClick={() => handleShowShortageDetail(transaction)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline text-sm"
                              >
                                부족 {shortageTotal.toLocaleString()}개
                              </button>
                            ) : (
                              <span className="text-green-600 dark:text-green-400 text-sm">정상</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
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

      {/* Shortage Detail Modal */}
      {showShortageModal && selectedTransactionForShortage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  재고 부족 상세
                </h3>
                <button
                  onClick={() => setShowShortageModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  거래일자: {selectedTransactionForShortage.transaction_date}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  생산품목: {selectedTransactionForShortage.item_code || selectedTransactionForShortage.items?.item_code} - {selectedTransactionForShortage.item_name || selectedTransactionForShortage.items?.item_name}
                </p>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">원자재</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">필요 수량</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">차감 수량</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">부족 수량</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransactionForShortage.bomLogs
                    ?.filter((log: any) => {
                      const required = parseFloat(log.quantity_required || 0);
                      const deducted = parseFloat(log.deducted_quantity || 0);
                      return required > deducted;
                    })
                    .map((log: any, index: number) => {
                      const required = parseFloat(log.quantity_required || 0);
                      const deducted = parseFloat(log.deducted_quantity || 0);
                      const shortage = required - deducted;
                      return (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">
                            {log.items?.item_code} - {log.items?.item_name}
                          </td>
                          <td className="py-2 px-3 text-sm text-right text-gray-900 dark:text-white">
                            {required.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-sm text-right text-gray-900 dark:text-white">
                            {deducted.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-sm text-right text-red-600 dark:text-red-400 font-semibold">
                            {shortage.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {selectedTransactionForShortage.bomLogs?.filter((log: any) => {
                const required = parseFloat(log.quantity_required || 0);
                const deducted = parseFloat(log.deducted_quantity || 0);
                return required > deducted;
              }).length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  부족한 자재가 없습니다.
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowShortageModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
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